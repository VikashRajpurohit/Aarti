//Challan Context - Supabase Integration
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import { Challan, CHALLAN_STATUS } from '../models/Challan';
import { incrementChallanCount } from '../services/analyticsService';
import { storageService } from '../services/storage';
import { useAuth } from './AuthContext';
import { logService } from '../services/logService';
import { useRefreshBus } from './RefreshBusContext';

const ChallanContext = createContext();
const ACTIVE_CHALLAN_KEY = '@active_challan_id';
const CHALLAN_SYNC_QUEUE_KEY = '@challan_sync_queue';

// PostgREST silently caps unbounded selects at 1000 rows. Set an explicit,
// higher cap (newest-first) so history isn't silently truncated as data grows.
// TODO: replace with real pagination / a recency window once volume warrants it.
const CHALLAN_FETCH_LIMIT = 3000;

// How long to wait after the last scan before persisting the challan to disk and
// syncing to Supabase. Rapid scans keep resetting this timer, so a burst does zero
// heavy I/O; a single coalesced flush runs once the user pauses. Backstops (20s
// interval, AppState changes, focus refresh) force a flush so nothing is ever lost.
const FLUSH_DEBOUNCE_MS = 700;

export const useChallan = () => {
  const context = useContext(ChallanContext);
  if (!context) {
    throw new Error('useChallan must be used within ChallanProvider');
  }
  return context;
};

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const getStartOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDaysBetween = (fromDate, toDate) => {
  const fromStart = getStartOfDay(fromDate);
  const toStart = getStartOfDay(toDate);
  return Math.floor((fromStart - toStart) / MS_IN_DAY);
};

const isDepartedVisible = (challan) => {
  const departedAt = challan.statusChangedAt || challan.createdAt || challan.date;
  if (!departedAt) return false;
  const departedDate = new Date(departedAt);
  if (Number.isNaN(departedDate.getTime())) return false;
  const daysSince = getDaysBetween(new Date(), departedDate);
  return daysSince <= 2; // visible on departure day + next 2 days
};

const normalizeChallans = (items) => {
  const list = Array.isArray(items) ? items : [];
  return list.map((item) => (item instanceof Challan ? item : Challan.fromJSON(item)));
};

const sortChallans = (items) => {
  const list = Array.isArray(items) ? [...items] : [];
  return list.sort((a, b) => {
    const aDate = new Date(a?.createdAt || 0).getTime();
    const bDate = new Date(b?.createdAt || 0).getTime();
    return bDate - aDate;
  });
};

export const ChallanProvider = ({ children }) => {
  const { user, roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const [challans, setChallans] = useState([]);
  const [activeChallanId, setActiveChallanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { emitRefresh } = useRefreshBus();
  const syncInProgressRef = useRef(false);
  // Mirror of `challans` kept in sync so the scan hot-path (mutateActiveItems) can
  // read the latest items synchronously without waiting for a re-render. This is
  // what prevents dropped boxes when two scans land before React re-renders.
  const challansRef = useRef([]);
  // Write-behind buffer: challanId -> latest Challan snapshot awaiting persist/sync.
  const pendingFlushRef = useRef(new Map());
  const flushTimerRef = useRef(null);

  useEffect(() => {
    challansRef.current = challans;
  }, [challans]);

  const filterVisibleChallans = useCallback((list) => {
    const normalized = normalizeChallans(list);
    if (isAdmin) return normalized;
    return normalized.filter((challan) => {
      if (challan.status === CHALLAN_STATUS.DEPARTED) {
        return isDepartedVisible(challan);
      }
      return challan.status !== CHALLAN_STATUS.DELETED;
    });
  }, [isAdmin]);

  const updateChallansState = useCallback((nextList) => {
    const filtered = filterVisibleChallans(nextList);
    setChallans(sortChallans(filtered));
  }, [filterVisibleChallans]);

  const upsertChallanInState = useCallback((nextChallan) => {
    if (!nextChallan?.id) return;
    setChallans((prev) => {
      const list = normalizeChallans(prev);
      const idx = list.findIndex((c) => c.id === nextChallan.id);
      if (idx >= 0) {
        list[idx] = nextChallan;
      } else {
        list.unshift(nextChallan);
      }
      return sortChallans(filterVisibleChallans(list));
    });
  }, [filterVisibleChallans]);

  const persistChallan = useCallback(async (challan) => {
    try {
      if (!challan?.id) return;
      await storageService.saveChallan(challan);
    } catch (error) {
      console.error('Error saving challan locally:', error);
    }
  }, []);

  // Load challans when user changes or component mounts
  useEffect(() => {
    if (user) {
      loadChallans();
      loadActiveChallan();
      processChallanSyncQueue();
    } else {
      setChallans([]);
      setActiveChallanId(null);
      setLoading(false);
    }
  }, [loadActiveChallan, loadChallans, processChallanSyncQueue, user]);

  // Refresh active challan data when ID changes
  useEffect(() => {
    if (activeChallanId) {
      // We could fetch just the active one, but for now refreshing list is safer to keep sync
      // Optimization: Could implement subscription here for real-time updates
    }
  }, [activeChallanId]);

  useEffect(() => {
    if (!user) return;

    const handleAppState = () => {
      // On any transition (foregrounding to sync, or backgrounding/inactive to
      // persist buffered scans immediately) force a flush so nothing is lost.
      void flushPending();
    };

    const subscription = AppState.addEventListener('change', handleAppState);
    const interval = setInterval(() => {
      void flushPending();
    }, 20000);

    return () => {
      subscription?.remove?.();
      clearInterval(interval);
    };
  }, [flushPending, user]);

  const loadChallans = useCallback(async (options = {}) => {
    const { preferLocal = false } = options;
    try {
      setLoading(true);
      if (!user) {
        setLoading(false);
        return;
      }

      const localChallans = await storageService.getChallans();
      if (localChallans?.length) {
        updateChallansState(localChallans);
      }

      if (preferLocal) return;

      let query = supabase
        .from('challans')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(CHALLAN_FETCH_LIMIT);

      if (!isAdmin) {
        query = query.neq('status', CHALLAN_STATUS.DELETED);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('Loaded challans:', data?.length);
      const loadedChallans = normalizeChallans(data);
      await storageService.saveChallans(loadedChallans);
      updateChallansState(loadedChallans);
    } catch (error) {
      console.error('Error loading challans from Supabase:', error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, updateChallansState, user]);

  const loadActiveChallan = useCallback(async () => {
    try {
      const id = await AsyncStorage.getItem(ACTIVE_CHALLAN_KEY);
      if (!id) {
        setActiveChallanId(null);
        return;
      }

      const localChallan = await storageService.getChallanById(id);
      if (localChallan?.status === CHALLAN_STATUS.IN_PROGRESS) {
        setActiveChallanId(id);
      }

      if (!user) return;

      const { data, error } = await supabase
        .from('challans')
        .select('*')
        .eq('id', id)
        .single();

      if (!error && data && data.status === CHALLAN_STATUS.IN_PROGRESS) {
        setActiveChallanId(id);
        return;
      }

      if (error) {
        console.error('Error loading active challan from Supabase:', error);
        return;
      }

      await AsyncStorage.removeItem(ACTIVE_CHALLAN_KEY);
      setActiveChallanId(null);
    } catch (error) {
      console.error('Error loading active challan ID:', error);
    }
  }, [user]);

  const readSyncQueue = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(CHALLAN_SYNC_QUEUE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      console.error('Error reading challan sync queue:', error);
      return {};
    }
  }, []);

  const writeSyncQueue = useCallback(async (queue) => {
    try {
      await AsyncStorage.setItem(CHALLAN_SYNC_QUEUE_KEY, JSON.stringify(queue || {}));
    } catch (error) {
      console.error('Error writing challan sync queue:', error);
    }
  }, []);

  const enqueueChallanSync = useCallback(async (challan) => {
    if (!challan?.id) return;
    const queue = await readSyncQueue();
    queue[challan.id] = {
      items: (challan.items || []).map((item) => (item?.toJSON ? item.toJSON() : item)),
      updated_at: new Date().toISOString(),
    };
    await writeSyncQueue(queue);
  }, [readSyncQueue, writeSyncQueue]);

  const processChallanSyncQueue = useCallback(async () => {
    if (!user?.id) return;
    if (syncInProgressRef.current) return;

    syncInProgressRef.current = true;
    try {
      const queue = await readSyncQueue();
      const entries = Object.entries(queue);
      if (entries.length === 0) return;

      let updatedQueue = { ...queue };
      for (const [challanId, payload] of entries) {
        try {
          const { error } = await supabase
            .from('challans')
            .update({ items: payload.items })
            .eq('id', challanId);

          if (!error) {
            delete updatedQueue[challanId];
          }
        } catch (err) {
          console.log('Challan sync error:', err?.message || err);
        }
      }

      if (Object.keys(updatedQueue).length !== Object.keys(queue).length) {
        await writeSyncQueue(updatedQueue);
      }
    } finally {
      syncInProgressRef.current = false;
    }
  }, [readSyncQueue, user?.id, writeSyncQueue]);

  // Persist every pending challan to local storage and enqueue it for Supabase
  // sync, then drain the sync queue. Coalesces a burst of scans into a single
  // round of heavy I/O. Safe to call redundantly (cheap no-op when nothing pending).
  const flushPending = useCallback(async () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const pending = pendingFlushRef.current;
    if (pending.size > 0) {
      const batch = Array.from(pending.values());
      pending.clear();
      try {
        for (const challan of batch) {
          await storageService.saveChallan(challan);
          await enqueueChallanSync(challan);
        }
      } catch (error) {
        console.error('Error persisting challan changes:', error);
        // Re-queue the batch so the next flush retries; don't clobber newer edits.
        for (const challan of batch) {
          if (!pending.has(challan.id)) pending.set(challan.id, challan);
        }
      }
    }
    await processChallanSyncQueue();
  }, [enqueueChallanSync, processChallanSyncQueue]);

  // Record the latest snapshot of a challan and (re)arm the debounce timer. The
  // scan UI never waits on this — memory is already updated by mutateActiveItems.
  const queueFlush = useCallback((challan) => {
    if (!challan?.id) return;
    pendingFlushRef.current.set(challan.id, challan);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushPending();
    }, FLUSH_DEBOUNCE_MS);
  }, [flushPending]);

  const refreshChallans = useCallback(async () => {
    // Force any buffered scans to disk + Supabase before reloading, otherwise the
    // reload could overwrite in-memory edits that haven't been synced yet.
    await flushPending();
    await loadChallans();
    await loadActiveChallan();
  }, [flushPending, loadActiveChallan, loadChallans]);

  const getActiveChallan = () => {
    return challans.find(c => c.id === activeChallanId);
  };

  const challanNumberExists = (challanNumber) => {
    return challans.some(c => c.challanNumber === challanNumber && c.status !== CHALLAN_STATUS.DELETED);
  };

  const createChallan = async (challanNumber) => {
    try {
      if (!user) throw new Error('User not authenticated');

      // Validation
      if (!challanNumber || challanNumber.trim() === '') {
        throw new Error('Challan number is required');
      }
      const trimmedNumber = challanNumber.trim();
      if (!/^\d{1,6}$/.test(trimmedNumber)) {
        throw new Error('Challan number must be 1-6 digits');
      }
      if (challanNumberExists(trimmedNumber)) {
        throw new Error(`Challan #${trimmedNumber} already exists`);
      }

      const newChallan = new Challan({
        challanNumber: trimmedNumber,
        status: CHALLAN_STATUS.IN_PROGRESS,
        createdAt: new Date().toISOString(),
      });

      // Exclude temporary ID so Supabase generates a UUID
      const { id, ...challanData } = newChallan.toJSON();

      const { data, error } = await supabase
        .from('challans')
        .insert({
          ...challanData,
          created_by: user.id
        })
        .select()
        .single();

      if (error) {
        // 23505 = unique_violation on challans_number_active_uq. The in-memory
        // check can miss departed challans that are hidden from non-admins, so
        // surface a friendly message instead of the raw Postgres error.
        if (error.code === '23505') {
          throw new Error(`Challan #${trimmedNumber} already exists`);
        }
        throw error;
      }

      const createdChallan = Challan.fromJSON(data);
      await persistChallan(createdChallan);
      upsertChallanInState(createdChallan);
      emitRefresh('challans');
      emitRefresh('reports');
      
      // Set as active
      setActiveChallanId(createdChallan.id);
      await AsyncStorage.setItem(ACTIVE_CHALLAN_KEY, createdChallan.id);
      incrementChallanCount();

      await logService.logEvent({
        action: 'challan.create',
        entityType: 'challan',
        entityId: createdChallan.id,
        metadata: { challan_number: createdChallan.challanNumber },
      });

      return createdChallan;
    } catch (error) {
      console.error('Error creating challan:', error);
      throw error;
    }
  };

  const checkItemExists = async (boxNo) => {
    try {
      if (!activeChallanId) return null;
      
      // Check local state first for speed
      const currentChallan = getActiveChallan();
      if (currentChallan) {
        return currentChallan.items.find(i => i.boxNo === boxNo) || null;
      }
      return null;
    } catch (error) {
      console.error('Error checking item:', error);
      return null;
    }
  };

  // Fast, race-free update of ONLY the active challan's items. Reads and writes
  // challansRef synchronously so back-to-back scans chain off each other's result
  // instead of a stale render snapshot (no dropped boxes), and skips the whole-list
  // normalize/filter/sort — an item edit never changes a challan's visibility or
  // sort position. `mutator(items)` returns the next items array, or a falsy value
  // to signal "no change". Returns the rebuilt Challan (to buffer for I/O) or null.
  const mutateActiveItems = (mutator) => {
    const prev = challansRef.current;
    const idx = prev.findIndex((c) => c.id === activeChallanId);
    if (idx < 0) return null;
    const current = prev[idx];
    const nextItems = mutator(current.items);
    if (!nextItems) return null;
    const updatedChallan = new Challan({
      id: current.id,
      challanNumber: current.challanNumber,
      date: current.date,
      items: nextItems,
      status: current.status,
      noNetWeightRequired: current.noNetWeightRequired,
      productDeductions: current.productDeductions,
      createdAt: current.createdAt,
      statusChangedAt: current.statusChangedAt,
      deletedAt: current.deletedAt,
    });
    const next = [...prev];
    next[idx] = updatedChallan;
    challansRef.current = next; // keep the mirror ahead of the async re-render
    setChallans(next);
    return updatedChallan;
  };

  const addItemToActiveChallan = async (item) => {
    try {
      if (!activeChallanId) return false;

      // Instant, race-free in-memory add. The duplicate guard runs inside the
      // updater so it sees the very latest items even in the middle of a burst.
      const updatedChallan = mutateActiveItems((items) => {
        if (items.some((i) => i.boxNo === item.boxNo)) return null;
        return [...items, item];
      });
      if (!updatedChallan) return false;

      // Heavy work (disk write + Supabase sync) is deferred and coalesced so the
      // scan path never blocks; see queueFlush/flushPending. No emitRefresh here —
      // context state already updated the focused screen, and other screens
      // refresh on focus. Emitting would make the focused scanner reload the whole
      // challans table from Supabase on every scan.
      queueFlush(updatedChallan);

      void logService.logEvent({
        action: 'challan.item.add',
        entityType: 'challan',
        entityId: activeChallanId,
        metadata: {
          challan_number: updatedChallan.challanNumber,
          box_no: item.boxNo,
          item_name: item.itemName,
          weight: item.weight,
          pieces: item.pieces,
        },
      });
      return true;
    } catch (error) {
      console.error('Error adding item to challan:', error);
      return false;
    }
  };

  const removeItemFromActiveChallan = async (boxNo) => {
    try {
      if (!activeChallanId) return;

      const updatedChallan = mutateActiveItems((items) => {
        if (!items.some((i) => i.boxNo === boxNo)) return null;
        return items.filter((i) => i.boxNo !== boxNo);
      });
      if (!updatedChallan) return;

      queueFlush(updatedChallan);

      void logService.logEvent({
        action: 'challan.item.remove',
        entityType: 'challan',
        entityId: activeChallanId,
        metadata: { box_no: boxNo, challan_number: updatedChallan.challanNumber },
      });
    } catch (error) {
      console.error('Error removing item:', error);
      throw error;
    }
  };

  const clearActiveChallanItems = async () => {
    try {
      if (!activeChallanId) return;

      let removedCount = 0;
      const updatedChallan = mutateActiveItems((items) => {
        if (!items.length) return null;
        removedCount = items.length;
        return [];
      });
      if (!updatedChallan) return;

      queueFlush(updatedChallan);

      void logService.logEvent({
        action: 'challan.items.clear',
        entityType: 'challan',
        entityId: activeChallanId,
        metadata: { removed_count: removedCount, challan_number: updatedChallan.challanNumber },
      });
    } catch (error) {
      console.error('Error clearing items:', error);
      throw error;
    }
  };

  const setActiveChallan = async (challanId) => {
    try {
      // Verify existence and status locally or remotely
      const challan = challans.find(c => c.id === challanId);
      if (!challan) throw new Error('Challan not found');
      
      if (challan.status !== CHALLAN_STATUS.IN_PROGRESS) {
        throw new Error('Only IN_PROGRESS challans can be set as active');
      }
      
      setActiveChallanId(challanId);
      await AsyncStorage.setItem(ACTIVE_CHALLAN_KEY, challanId);
    } catch (error) {
      console.error('Error setting active challan:', error);
      throw error;
    }
  };

  const updateChallanStatus = async (challanId, status) => {
    try {
      const current = challans.find(c => c.id === challanId);
      const updates = {
        status,
        status_changed_at: new Date().toISOString(),
      };
      if (status === CHALLAN_STATUS.DELETED) {
        updates.deleted_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('challans')
        .update(updates)
        .eq('id', challanId);

      if (error) throw error;
      if (current) {
        const updatedChallan = new Challan({
          id: current.id,
          challanNumber: current.challanNumber,
          date: current.date,
          items: current.items,
          status: updates.status,
          noNetWeightRequired: current.noNetWeightRequired,
          productDeductions: current.productDeductions,
          createdAt: current.createdAt,
          statusChangedAt: updates.status_changed_at,
          deletedAt: updates.deleted_at || current.deletedAt,
        });
        upsertChallanInState(updatedChallan);
        await persistChallan(updatedChallan);
      } else {
        await loadChallans({ preferLocal: true });
      }
      emitRefresh('challans');
      emitRefresh('reports');

      if ((status === CHALLAN_STATUS.DEPARTED || status === CHALLAN_STATUS.DELETED) && challanId === activeChallanId) {
        setActiveChallanId(null);
        await AsyncStorage.removeItem(ACTIVE_CHALLAN_KEY);
      }

      const action = status === CHALLAN_STATUS.DEPARTED
        ? 'challan.departed'
        : status === CHALLAN_STATUS.DELETED
          ? 'challan.deleted'
          : 'challan.status.change';

      void logService.logEvent({
        action,
        entityType: 'challan',
        entityId: challanId,
        metadata: { from_status: current?.status, to_status: status, challan_number: current?.challanNumber },
      });
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  const deleteChallan = async (challanId) => {
    await updateChallanStatus(challanId, CHALLAN_STATUS.DELETED);
  };

  const updateProductDeductions = async (challanId, productDeductions) => {
    try {
      const { data, error } = await supabase
        .from('challans')
        .update({ product_deductions: productDeductions })
        .eq('id', challanId)
        .select()
        .single();

      if (error) throw error;

      const updatedChallan = Challan.fromJSON(data);
      upsertChallanInState(updatedChallan);
      await persistChallan(updatedChallan);
      emitRefresh('challans');
      return updatedChallan;
    } catch (error) {
      console.error('Error updating deductions:', error);
      throw error;
    }
  };

  const toggleNetWeightRequired = async (challanId, noNetWeightRequired) => {
    try {
      const challan = challans.find(c => c.id === challanId);
      const updates = {
        no_net_weight_required: noNetWeightRequired,
        product_deductions: noNetWeightRequired ? {} : (challan?.productDeductions || {})
      };

      const { data, error } = await supabase
        .from('challans')
        .update(updates)
        .eq('id', challanId)
        .select()
        .single();

      if (error) throw error;

      const updatedChallan = Challan.fromJSON(data);
      upsertChallanInState(updatedChallan);
      await persistChallan(updatedChallan);
      emitRefresh('challans');
      return updatedChallan;
    } catch (error) {
      console.error('Error toggling net weight:', error);
      throw error;
    }
  };

  /**
   * Update the pieces count for a specific item/box in the active challan
   * @param {string} boxNo - The box number to update
   * @param {number} pieces - The new pieces count
   */
  const updateItemPieces = async (boxNo, pieces) => {
    try {
      if (!activeChallanId) {
        throw new Error('No active challan selected');
      }

      const updatedChallan = mutateActiveItems((items) => {
        const itemIndex = items.findIndex((i) => i.boxNo === boxNo);
        if (itemIndex < 0) return null;
        const nextItems = [...items];
        nextItems[itemIndex] = { ...nextItems[itemIndex], pieces };
        return nextItems;
      });
      if (!updatedChallan) {
        throw new Error('Item not found in challan');
      }

      queueFlush(updatedChallan);
      return true;
    } catch (error) {
      console.error('Error updating item pieces:', error);
      throw error;
    }
  };

  const activeChallan = getActiveChallan();

  return (
    <ChallanContext.Provider
      value={{
        challans,
        activeChallan,
        activeChallanId,
        loading,
        challanNumberExists,
        setActiveChallan,
        createChallan,
        checkItemExists,
        addItemToActiveChallan,
        removeItemFromActiveChallan,
        clearActiveChallanItems,
        updateChallanStatus,
        deleteChallan,
        updateProductDeductions,
        toggleNetWeightRequired,
        updateItemPieces,
        loadChallans,
        refreshChallans,
      }}
    >
      {children}
    </ChallanContext.Provider>
  );
};
