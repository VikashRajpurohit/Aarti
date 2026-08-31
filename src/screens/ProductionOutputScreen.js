import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../components/GradientBackground';
import AnimatedCard from '../components/AnimatedCard';
import ResponsiveText from '../components/ResponsiveText';
import ScreenHeader from '../components/ScreenHeader';
import DateNavigator from '../components/DateNavigator';
import ShiftStatusBadge from '../components/ShiftStatusBadge';
import InlineBanner from '../components/InlineBanner';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, iconSizes, shadows } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { productionOutputService } from '../services/productionOutputService';
import { logService } from '../services/logService';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useRefreshBus } from '../context/RefreshBusContext';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { toDateOnlyString, fromDateOnlyString, addDaysToDateOnly, getTodayIST } from '../utils/dateOnly';

let Haptics = null;
try { Haptics = require('expo-haptics'); } catch (_) {}
const haptic = (style = 'medium') => {
  try {
    const s = Haptics?.ImpactFeedbackStyle;
    const fn = style === 'light' ? s?.Light : style === 'heavy' ? s?.Heavy : s?.Medium;
    Haptics?.impactAsync?.(fn);
  } catch (_) {}
};

const SHIFT_TYPES = [
  { key: 'day', label: 'Day Shift', icon: 'sunny', accentColor: '#D97706', accentLight: '#FFFBEB' },
  { key: 'night', label: 'Night Shift', icon: 'moon', accentColor: colors.primary[700], accentLight: colors.primary[50] },
];

const CATEGORY_CONFIG = [
  { key: 'stretch', label: 'Stretch Film', unitLabel: 'Boxes', avgLabel: 'Avg Weight (kg)', icon: 'film-outline', color: '#6366F1' },
  { key: 'bubble', label: 'Bubble Roll', unitLabel: 'Rolls', avgLabel: 'Avg Weight (kg)', icon: 'ellipse-outline', color: '#10B981' },
  { key: 'pouch', label: 'Pouch', unitLabel: 'Pieces', avgLabel: null, icon: 'bag-outline', color: '#F59E0B' },
  { key: 'baby', label: 'Baby Product', unitLabel: 'Boxes', avgLabel: null, icon: 'happy-outline', color: '#EF4444' },
];

const formatDateLabel = (dateString) => {
  if (!dateString) return '';
  try {
    // Anchor at IST so the label matches the queried day on any device timezone.
    const date = new Date(`${dateString}T12:00:00+05:30`);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return dateString;
  }
};

const shiftDateByDays = (dateString, delta) => {
  return addDaysToDateOnly(dateString, delta);
};

const getStatusMeta = (entry) => {
  if (!entry) {
    return { label: 'Not Started', color: colors.neutral[400], icon: 'time-outline' };
  }
  if (entry.ended_at) {
    return { label: 'Ended', color: colors.success[500], icon: 'checkmark-circle' };
  }
  return { label: 'In Progress', color: colors.warning[500], icon: 'play-circle' };
};

const parseNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toDisplayValue = (value) => (value === null || value === undefined ? '' : String(value));

export default function ProductionOutputScreen({ refreshSignal }) {
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const { user, roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const isGeneralManager = roles?.includes('general_manager');
  const isProductionManager = roles?.includes('production_manager');
  const canChangeDate = isAdmin || isGeneralManager;
  const { emitRefresh } = useRefreshBus();

  const [products, setProducts] = useState([]);
  const [shiftsByType, setShiftsByType] = useState({ day: null, night: null });
  const [outputsByShift, setOutputsByShift] = useState({ day: {}, night: {} });
  const [drafts, setDrafts] = useState({
    day: { counts: {}, pouchLines: {} },
    night: { counts: {}, pouchLines: {} },
  });
  const [profilesById, setProfilesById] = useState({});
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [tempDate, setTempDate] = useState(fromDateOnlyString(getTodayIST()));
  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState({ day: false, night: false });
  const [endingShift, setEndingShift] = useState({ day: false, night: false });
  const [banner, setBanner] = useState({ visible: false, message: '', type: 'success' });
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const [productsModalVisible, setProductsModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('stretch');
  const [newProductName, setNewProductName] = useState('');
  const [newAvgWeight, setNewAvgWeight] = useState('');
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingProductName, setEditingProductName] = useState('');
  const [editingAvgWeight, setEditingAvgWeight] = useState('');
  const [categoryModal, setCategoryModal] = useState({ visible: false, shiftKey: null, categoryKey: null });

  const showBanner = (message, type = 'success') => {
    setBanner({ visible: true, message, type });
  };

  const todayString = getTodayIST();
  const completedCount = [shiftsByType.day, shiftsByType.night].filter((shift) => shift?.ended_at).length;
  const activeShiftLabel = isAdmin
    ? 'Admin View'
    : completedCount === 2
      ? 'Completed'
      : completedCount === 0
        ? 'Day Shift'
        : 'Night Shift';
  const activeProductsCount = products.filter((product) => product.is_active).length;

  const loadProfiles = useCallback(async (ids) => {
    if (!ids.length) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, roles')
      .in('id', ids);
    if (!error && data) {
      const map = {};
      data.forEach((profile) => {
        map[profile.id] = profile;
      });
      setProfilesById(map);
    }
  }, []);

  const hydrateDrafts = useCallback((productsList, outputsMap) => {
    const nextDrafts = {
      day: { counts: {}, pouchLines: {} },
      night: { counts: {}, pouchLines: {} },
    };

    ['day', 'night'].forEach((shiftType) => {
      const outputForShift = outputsMap[shiftType] || {};
      productsList.forEach((product) => {
        const existingOutput = outputForShift[product.id];
        if (product.category === 'pouch') {
          const lines = Array.isArray(existingOutput?.pouch_lines) && existingOutput.pouch_lines.length > 0
            ? existingOutput.pouch_lines.map((line) => ({
                boxes: toDisplayValue(line?.boxes),
                pieces: toDisplayValue(line?.pieces_per_box),
              }))
            : [{ boxes: '', pieces: '' }];
          nextDrafts[shiftType].pouchLines[product.id] = lines;
        } else {
          nextDrafts[shiftType].counts[product.id] = toDisplayValue(existingOutput?.output_count);
        }
      });
    });

    setDrafts(nextDrafts);
  }, []);

  const refreshData = useCallback(async (dateString) => {
    setLoading(true);
    const [productsResult, shiftsResult] = await Promise.all([
      productionOutputService.fetchProducts(),
      productionOutputService.fetchShiftsByDate(dateString),
    ]);

    if (productsResult.error) {
      Alert.alert('Error', productsResult.error.message || 'Failed to load products.');
    }
    if (shiftsResult.error) {
      Alert.alert('Error', shiftsResult.error.message || 'Failed to load shifts.');
    }

    const productsData = Array.isArray(productsResult.data) ? productsResult.data : [];
    const shiftsData = Array.isArray(shiftsResult.data) ? shiftsResult.data : [];

    const shiftMap = { day: null, night: null };
    const outputMap = { day: {}, night: {} };
    shiftsData.forEach((shift) => {
      if (shift?.shift_type === 'day') shiftMap.day = shift;
      if (shift?.shift_type === 'night') shiftMap.night = shift;
      const shiftKey = shift?.shift_type;
      if (shiftKey && Array.isArray(shift.production_outputs)) {
        shift.production_outputs.forEach((output) => {
          if (output?.product_id) {
            outputMap[shiftKey][output.product_id] = output;
          }
        });
      }
    });

    setProducts(productsData);
    setShiftsByType(shiftMap);
    setOutputsByShift(outputMap);
    hydrateDrafts(productsData, outputMap);

    const profileIds = [shiftMap.day?.created_by, shiftMap.night?.created_by].filter(Boolean);
    await loadProfiles([...new Set(profileIds)]);

    setLoading(false);
  }, [hydrateDrafts, loadProfiles]);

  useEffect(() => {
    refreshData(selectedDate);
  }, [refreshData, selectedDate]);

  useRefreshOnFocus(
    () => refreshData(selectedDate),
    [refreshData, selectedDate],
    'production',
    refreshSignal
  );

  useEffect(() => {
    if (!canChangeDate && selectedDate !== todayString) {
      setSelectedDate(todayString);
    }
  }, [canChangeDate, selectedDate, todayString]);

  const productsByCategory = useMemo(() => {
    const map = {
      stretch: [],
      bubble: [],
      pouch: [],
      baby: [],
    };
    products.forEach((product) => {
      if (map[product.category]) {
        map[product.category].push(product);
      }
    });
    return map;
  }, [products]);

  const openCategoryModal = (shiftKey, categoryKey) => {
    haptic('light');
    setCategoryModal({ visible: true, shiftKey, categoryKey });
  };

  const closeCategoryModal = () => {
    setCategoryModal({ visible: false, shiftKey: null, categoryKey: null });
  };

  const getProfileLabel = (id) => {
    if (!id) return 'Unknown';
    const profile = profilesById[id];
    if (!profile) return `User ${id.slice(0, 6)}`;
    if (profile.full_name) return profile.full_name;
    return profile.role ? profile.role.replace('_', ' ') : `User ${id.slice(0, 6)}`;
  };

  const canEditShift = (shift) => {
    if (!shift) return true;
    return !shift.ended_at && shift.created_by === user?.id;
  };

  const canEndShift = (shift) => {
    if (!shift) return isAdmin || isProductionManager || isGeneralManager;
    if (shift.ended_at) return false;
    return shift.created_by === user?.id || isAdmin || isGeneralManager;
  };

  const canRestartShift = (shift) => !!(shift?.ended_at && (isAdmin || isGeneralManager));

  const openDatePicker = () => {
    const baseDate = fromDateOnlyString(selectedDate);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: baseDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            setSelectedDate(toDateOnlyString(date));
          }
        },
      });
      return;
    }
    setTempDate(baseDate);
    setDatePickerVisible(true);
  };

  const updateCount = (shiftType, productId, value) => {
    setDrafts((prev) => ({
      ...prev,
      [shiftType]: {
        ...prev[shiftType],
        counts: {
          ...prev[shiftType].counts,
          [productId]: value,
        },
      },
    }));
  };

  const updatePouchLine = (shiftType, productId, index, field, value) => {
    setDrafts((prev) => {
      const lines = prev[shiftType].pouchLines[productId] || [];
      const nextLines = lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line
      );
      return {
        ...prev,
        [shiftType]: {
          ...prev[shiftType],
          pouchLines: {
            ...prev[shiftType].pouchLines,
            [productId]: nextLines,
          },
        },
      };
    });
  };

  const addPouchLine = (shiftType, productId) => {
    setDrafts((prev) => {
      const lines = prev[shiftType].pouchLines[productId] || [];
      return {
        ...prev,
        [shiftType]: {
          ...prev[shiftType],
          pouchLines: {
            ...prev[shiftType].pouchLines,
            [productId]: [...lines, { boxes: '', pieces: '' }],
          },
        },
      };
    });
  };

  const removePouchLine = (shiftType, productId, index) => {
    setDrafts((prev) => {
      const lines = prev[shiftType].pouchLines[productId] || [];
      const nextLines = lines.filter((_, lineIndex) => lineIndex !== index);
      return {
        ...prev,
        [shiftType]: {
          ...prev[shiftType],
          pouchLines: {
            ...prev[shiftType].pouchLines,
            [productId]: nextLines.length ? nextLines : [{ boxes: '', pieces: '' }],
          },
        },
      };
    });
  };

  const buildOutputRows = (shiftId, shiftType) => {
    const rows = [];
    const draft = drafts[shiftType];

    products.forEach((product) => {
      const existingOutput = outputsByShift[shiftType]?.[product.id];
      const includeRow = product.is_active || !!existingOutput;
      if (!includeRow) return;

      if (product.category === 'pouch') {
        const lines = (draft.pouchLines[product.id] || []).map((line) => ({
          boxes: parseNumber(line.boxes),
          pieces_per_box: parseNumber(line.pieces),
        }));
        const totalPieces = lines.reduce((sum, line) => sum + line.boxes * line.pieces_per_box, 0);
        rows.push({
          shift_id: shiftId,
          product_id: product.id,
          category: 'pouch',
          pouch_lines: lines,
          total_pieces: Math.round(totalPieces),
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        });
        return;
      }

      const count = Math.round(parseNumber(draft.counts[product.id]));
      if (product.category === 'stretch' || product.category === 'bubble') {
        const avgWeight = parseNumber(product.avg_weight);
        rows.push({
          shift_id: shiftId,
          product_id: product.id,
          category: product.category,
          output_count: count,
          avg_weight: avgWeight,
          total_weight: avgWeight * count,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        });
        return;
      }

      rows.push({
        shift_id: shiftId,
        product_id: product.id,
        category: product.category,
        output_count: count,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      });
    });

    return rows;
  };

  const ensureShift = async (shiftType) => {
    let shift = shiftsByType[shiftType];
    if (shift?.id) return { shift, created: false };

    const result = await productionOutputService.createShift({
      shift_date: selectedDate,
      shift_type: shiftType,
    });

    if (result.error) throw result.error;

    shift = result.data;
    setShiftsByType((prev) => ({ ...prev, [shiftType]: shift }));
    await loadProfiles([shift.created_by].filter(Boolean));

    return { shift, created: true };
  };

  const handleSaveShift = async (shiftType) => {
    const shift = shiftsByType[shiftType];
    if (!canEditShift(shift)) {
      Alert.alert('Not allowed', 'You can only edit your own shift until it is ended.');
      return;
    }

    if (products.length === 0) {
      Alert.alert('Missing products', 'No production products configured yet.');
      return;
    }

    haptic('medium');
    setSavingShift((prev) => ({ ...prev, [shiftType]: true }));

    try {
      const { shift: ensuredShift, created } = await ensureShift(shiftType);
      const rows = buildOutputRows(ensuredShift.id, shiftType);

      const outputsResult = rows.length
        ? await productionOutputService.upsertOutputs(rows)
        : { data: [] };

      if (outputsResult.error) throw outputsResult.error;

      const nextOutputMap = { ...outputsByShift[shiftType] };
      outputsResult.data?.forEach((row) => {
        nextOutputMap[row.product_id] = row;
      });
      setOutputsByShift((prev) => ({ ...prev, [shiftType]: nextOutputMap }));

      await logService.logEvent({
        action: created ? 'production_output.shift.create' : 'production_output.shift.update',
        entityType: 'production_output_shift',
        entityId: ensuredShift.id,
        metadata: { shift_type: shiftType, shift_date: selectedDate },
      });

      // Keep the other production sub-tab and Reports in sync with the save.
      emitRefresh('production');
      emitRefresh('reports');

      haptic('light');
      showBanner(`${shiftType === 'night' ? 'Night' : 'Day'} shift saved successfully.`, 'success');
    } catch (error) {
      haptic('heavy');
      Alert.alert('Error', error?.message || 'Failed to save shift.');
    } finally {
      setSavingShift((prev) => ({ ...prev, [shiftType]: false }));
    }
  };

  const handleEndShift = async (shiftType) => {
    const shift = shiftsByType[shiftType];
    if (!canEndShift(shift)) {
      Alert.alert('Not allowed', 'Only the creator, admin, or general manager can end this shift.');
      return;
    }

    Alert.alert(
      'End Shift',
      'Are you sure you want to end this shift? You will not be able to edit after ending.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Shift',
          style: 'destructive',
          onPress: async () => {
            haptic('heavy');
            setEndingShift((prev) => ({ ...prev, [shiftType]: true }));
            try {
              const { shift: ensuredShift, created } = await ensureShift(shiftType);

              if (products.length > 0) {
                const rows = buildOutputRows(ensuredShift.id, shiftType);
                const outputsResult = rows.length
                  ? await productionOutputService.upsertOutputs(rows)
                  : { data: [] };
                if (outputsResult.error) throw outputsResult.error;
              }

              const endResult = await productionOutputService.updateShift(ensuredShift.id, {
                ended_at: new Date().toISOString(),
                ended_by: user?.id || null,
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null,
              });
              if (endResult.error) throw endResult.error;

              const updatedShift = endResult.data;
              setShiftsByType((prev) => ({ ...prev, [shiftType]: updatedShift }));

              if (created) {
                await logService.logEvent({
                  action: 'production_output.shift.create',
                  entityType: 'production_output_shift',
                  entityId: ensuredShift.id,
                  metadata: { shift_type: shiftType, shift_date: selectedDate },
                });
              }

              await logService.logEvent({
                action: 'production_output.shift.end',
                entityType: 'production_output_shift',
                entityId: ensuredShift.id,
                metadata: { shift_type: shiftType, shift_date: selectedDate },
              });
              emitRefresh('production');
              emitRefresh('reports');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to end shift.');
            } finally {
              setEndingShift((prev) => ({ ...prev, [shiftType]: false }));
            }
          },
        },
      ]
    );
  };

  const handleRestartShift = async (shiftType) => {
    const shift = shiftsByType[shiftType];
    if (!canRestartShift(shift)) return;

    Alert.alert(
      'Restart Shift',
      'Restarting will allow editing again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restart',
          onPress: async () => {
            haptic('medium');
            setEndingShift((prev) => ({ ...prev, [shiftType]: true }));
            try {
              const result = await productionOutputService.restartShift(shift.id);
              if (result.error) throw result.error;

              const updatedShift = result.data;
              setShiftsByType((prev) => ({ ...prev, [shiftType]: updatedShift }));

              await logService.logEvent({
                action: 'production_output.shift.restart',
                entityType: 'production_output_shift',
                entityId: shift.id,
                metadata: { shift_type: shiftType, shift_date: selectedDate },
              });
              emitRefresh('production');
              emitRefresh('reports');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to restart shift.');
            } finally {
              setEndingShift((prev) => ({ ...prev, [shiftType]: false }));
            }
          },
        },
      ]
    );
  };

  const handleAddProduct = async () => {
    const name = newProductName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Enter a product name to add.');
      return;
    }

    const needsAvg = ['stretch', 'bubble'].includes(selectedCategory);
    const avgWeightValue = needsAvg ? parseNumber(newAvgWeight) : null;

    if (needsAvg && !avgWeightValue) {
      Alert.alert('Missing average weight', 'Enter a valid average weight.');
      return;
    }

    try {
      const payload = {
        category: selectedCategory,
        name,
        avg_weight: needsAvg ? avgWeightValue : null,
      };
      const result = await productionOutputService.addProduct(payload);
      if (result.error) throw result.error;

      setProducts((prev) => [...prev, result.data]);
      setDrafts((prev) => {
        const next = { ...prev };
        ['day', 'night'].forEach((shiftType) => {
          if (result.data.category === 'pouch') {
            next[shiftType] = {
              ...next[shiftType],
              pouchLines: {
                ...next[shiftType].pouchLines,
                [result.data.id]: [{ boxes: '', pieces: '' }],
              },
            };
          } else {
            next[shiftType] = {
              ...next[shiftType],
              counts: {
                ...next[shiftType].counts,
                [result.data.id]: '',
              },
            };
          }
        });
        return next;
      });
      setNewProductName('');
      setNewAvgWeight('');

      await logService.logEvent({
        action: 'production_output.product.add',
        entityType: 'production_output_product',
        entityId: result.data.id,
        metadata: { category: selectedCategory, name },
      });
      emitRefresh('production');
      emitRefresh('reports');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to add product.');
    }
  };

  const startEditingProduct = (product) => {
    setEditingProductId(product.id);
    setEditingProductName(product.name);
    setEditingAvgWeight(product.avg_weight ? String(product.avg_weight) : '');
  };

  const handleSaveProduct = async () => {
    const name = editingProductName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Enter a product name.');
      return;
    }

    const current = products.find((product) => product.id === editingProductId);
    if (!current) return;

    const needsAvg = ['stretch', 'bubble'].includes(current.category);
    const avgWeightValue = needsAvg ? parseNumber(editingAvgWeight) : null;

    if (needsAvg && !avgWeightValue) {
      Alert.alert('Missing average weight', 'Enter a valid average weight.');
      return;
    }

    try {
      const payload = {
        name,
        avg_weight: needsAvg ? avgWeightValue : null,
      };
      const result = await productionOutputService.updateProduct(editingProductId, payload);
      if (result.error) throw result.error;

      setProducts((prev) => prev.map((product) => (product.id === editingProductId ? result.data : product)));
      setEditingProductId(null);
      setEditingProductName('');
      setEditingAvgWeight('');

      await logService.logEvent({
        action: 'production_output.product.rename',
        entityType: 'production_output_product',
        entityId: result.data.id,
        metadata: { from: current.name, to: name },
      });
      emitRefresh('production');
      emitRefresh('reports');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to update product.');
    }
  };

  const handleDisableProduct = async (product) => {
    Alert.alert(
      'Disable product',
      `Disable ${product.name}? It will not appear for new entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await productionOutputService.updateProduct(product.id, { is_active: false });
              if (result.error) throw result.error;

              setProducts((prev) => prev.map((item) => (item.id === product.id ? result.data : item)));

              await logService.logEvent({
                action: 'production_output.product.disable',
                entityType: 'production_output_product',
                entityId: result.data.id,
                metadata: { name: product.name, category: product.category },
              });
              emitRefresh('production');
              emitRefresh('reports');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to disable product.');
            }
          },
        },
      ]
    );
  };

  const handleEnableProduct = async (product) => {
    Alert.alert(
      'Enable product',
      `Enable ${product.name}? It will appear for new entries.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Enable',
          onPress: async () => {
            try {
              const result = await productionOutputService.updateProduct(product.id, { is_active: true });
              if (result.error) throw result.error;

              setProducts((prev) => prev.map((item) => (item.id === product.id ? result.data : item)));

              await logService.logEvent({
                action: 'production_output.product.enable',
                entityType: 'production_output_product',
                entityId: result.data.id,
                metadata: { name: product.name, category: product.category },
              });
              emitRefresh('production');
              emitRefresh('reports');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to enable product.');
            }
          },
        },
      ]
    );
  };

  const renderStretchBubbleRow = (shiftType, product) => {
    const editable = canEditShift(shiftsByType[shiftType]);
    const isEditable = editable && (product.is_active || isAdmin);
    const countValue = drafts[shiftType].counts[product.id] || '';
    const count = parseNumber(countValue);
    const avgWeight = parseNumber(product.avg_weight);
    const totalWeight = avgWeight * count;
    const unitLabel = product.category === 'stretch' ? 'Boxes' : 'Rolls';

    return (
      <View key={product.id} style={styles.productRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>{unitLabel} • Avg {avgWeight} kg</Text>
          {!product.is_active && <Text style={styles.productInactive}>Inactive</Text>}
        </View>
        <View style={styles.productInputCol}>
          <TextInput
            style={[styles.productInput, !isEditable && styles.inputDisabled, isEditable && countValue && styles.inputFilled]}
            value={countValue}
            onChangeText={(text) => updateCount(shiftType, product.id, text)}
            editable={isEditable}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            placeholder="0"
            placeholderTextColor={colors.neutral[400]}
            returnKeyType="done"
            accessibilityLabel={`${product.name} count in ${unitLabel} for ${shiftType} shift`}
            accessibilityHint={isEditable ? `Enter number of ${unitLabel}` : 'This field is locked'}
          />
          {count > 0 && <Text style={styles.totalText}>Total {totalWeight.toFixed(2)} kg</Text>}
        </View>
      </View>
    );
  };

  const renderBabyRow = (shiftType, product) => {
    const editable = canEditShift(shiftsByType[shiftType]);
    const isEditable = editable && (product.is_active || isAdmin);
    const countValue = drafts[shiftType].counts[product.id] || '';
    const count = Math.round(parseNumber(countValue));

    return (
      <View key={product.id} style={styles.productRow}>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>Boxes</Text>
          {!product.is_active && <Text style={styles.productInactive}>Inactive</Text>}
        </View>
        <View style={styles.productInputCol}>
          <TextInput
            style={[styles.productInput, !isEditable && styles.inputDisabled, isEditable && countValue && styles.inputFilled]}
            value={countValue}
            onChangeText={(text) => updateCount(shiftType, product.id, text)}
            editable={isEditable}
            keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
            placeholder="0"
            placeholderTextColor={colors.neutral[400]}
            returnKeyType="done"
            accessibilityLabel={`${product.name} count in boxes for ${shiftType} shift`}
          />
          {count > 0 && <Text style={styles.totalText}>Total {count} boxes</Text>}
        </View>
      </View>
    );
  };

  const renderPouchRow = (shiftType, product) => {
    const editable = canEditShift(shiftsByType[shiftType]);
    const isEditable = editable && (product.is_active || isAdmin);
    const lines = drafts[shiftType].pouchLines[product.id] || [{ boxes: '', pieces: '' }];

    const totalPieces = lines.reduce((sum, line) => {
      const boxes = parseNumber(line.boxes);
      const pieces = parseNumber(line.pieces);
      return sum + boxes * pieces;
    }, 0);

    return (
      <View key={product.id} style={styles.pouchBlock}>
        <View style={styles.pouchHeader}>
          <View>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productMeta}>Total {Math.round(totalPieces)} pieces</Text>
            {!product.is_active && <Text style={styles.productInactive}>Inactive</Text>}
          </View>
          <TouchableOpacity
            style={[styles.addLineButton, !isEditable && styles.buttonDisabled]}
            onPress={() => addPouchLine(shiftType, product.id)}
            disabled={!isEditable}
          >
            <Ionicons name="add" size={18} color={colors.primary[600]} />
            <Text style={styles.addLineText}>Add Line</Text>
          </TouchableOpacity>
        </View>

        {lines.map((line, index) => (
          <View key={`${product.id}-${index}`} style={styles.pouchLine}>
            <View style={styles.pouchLineNumber}>
              <Text style={styles.pouchLineNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.pouchInputGroup}>
              <Text style={styles.pouchLabel}>Boxes</Text>
              <TextInput
                style={[styles.pouchInput, !isEditable && styles.inputDisabled]}
                value={line.boxes}
                onChangeText={(text) => updatePouchLine(shiftType, product.id, index, 'boxes', text)}
                editable={isEditable}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                returnKeyType="next"
                accessibilityLabel={`Line ${index + 1} boxes for ${product.name}`}
              />
            </View>
            <View style={styles.pouchInputGroup}>
              <Text style={styles.pouchLabel}>Pcs/Box</Text>
              <TextInput
                style={[styles.pouchInput, !isEditable && styles.inputDisabled]}
                value={line.pieces}
                onChangeText={(text) => updatePouchLine(shiftType, product.id, index, 'pieces', text)}
                editable={isEditable}
                keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                returnKeyType="done"
                accessibilityLabel={`Line ${index + 1} pieces per box for ${product.name}`}
              />
            </View>
            {isEditable && (
              <TouchableOpacity
                style={styles.removeLineButton}
                onPress={() => removePouchLine(shiftType, product.id, index)}
                accessibilityLabel={`Remove line ${index + 1}`}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash" size={18} color={colors.error[500]} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    );
  };

  const getCategorySummary = (shiftType, categoryKey) => {
    const categoryProducts = (productsByCategory[categoryKey] || []).filter((p) => p.is_active);
    if (categoryProducts.length === 0) return { count: 0, summary: 'No products', hasData: false };

    if (categoryKey === 'pouch') {
      let totalPieces = 0;
      categoryProducts.forEach((product) => {
        const lines = drafts[shiftType].pouchLines[product.id] || [];
        lines.forEach((line) => {
          totalPieces += parseNumber(line.boxes) * parseNumber(line.pieces);
        });
      });
      return {
        count: categoryProducts.length,
        summary: totalPieces > 0 ? `${Math.round(totalPieces).toLocaleString()} pcs` : 'Tap to enter',
        hasData: totalPieces > 0,
      };
    }

    let totalUnits = 0;
    let totalWeight = 0;
    categoryProducts.forEach((product) => {
      const count = parseNumber(drafts[shiftType].counts[product.id]);
      totalUnits += count;
      if (categoryKey === 'stretch' || categoryKey === 'bubble') {
        totalWeight += count * parseNumber(product.avg_weight);
      }
    });

    const unitLabel = categoryKey === 'bubble' ? 'Rolls' : 'Boxes';
    let summary = totalUnits > 0 ? `${totalUnits} ${unitLabel}` : 'Tap to enter';
    if (totalWeight > 0) summary += ` · ${totalWeight.toFixed(1)} kg`;
    return { count: categoryProducts.length, summary, hasData: totalUnits > 0 };
  };

  const renderCategoryGrid = (shiftKey) => (
    <View style={styles.categoryGrid}>
      {CATEGORY_CONFIG.map((config) => {
        const { count, summary, hasData } = getCategorySummary(shiftKey, config.key);
        return (
          <TouchableOpacity
            key={config.key}
            style={[styles.gridCard, hasData && { borderColor: config.color, borderWidth: 2 }]}
            activeOpacity={0.8}
            onPress={() => openCategoryModal(shiftKey, config.key)}
            accessibilityLabel={`${config.label}, ${summary}`}
            accessibilityRole="button"
          >
            <View style={[styles.gridIconBadge, { backgroundColor: config.color + '18' }]}>
              <Ionicons name={config.icon} size={22} color={config.color} />
            </View>
            <Text style={styles.gridCardTitle}>{config.label}</Text>
            <Text style={[styles.gridCardSummary, hasData && { color: config.color, fontWeight: '700' }]}>
              {summary}
            </Text>
            {count > 0 && (
              <View style={[styles.gridCountBadge, { backgroundColor: config.color + '18' }]}>
                <Text style={[styles.gridCountText, { color: config.color }]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderShiftCard = (shift) => {
    const shiftEntry = shiftsByType[shift.key];
    const editable = canEditShift(shiftEntry);
    const canEnd = canEndShift(shiftEntry);
    const canRestart = canRestartShift(shiftEntry);

    return (
      <AnimatedCard key={shift.key} variant="elevated" style={styles.shiftCard}>
        <LinearGradient
          colors={[shift.accentLight, colors.white]}
          style={styles.shiftHeaderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.shiftHeader}>
            <View style={styles.shiftTitleRow}>
              <View style={[styles.shiftIconBadge, { backgroundColor: shift.accentColor }]}>
                <Ionicons name={shift.icon} size={18} color={colors.white} />
              </View>
              <View>
                <Text style={styles.shiftTitle}>{shift.label}</Text>
                {shiftEntry?.created_by && (
                  <Text style={styles.shiftMeta}>by {getProfileLabel(shiftEntry.created_by)}</Text>
                )}
              </View>
            </View>
            <ShiftStatusBadge entry={shiftEntry} />
          </View>
          {shiftEntry?.ended_at && shiftEntry?.ended_by && (
            <View style={styles.endedByRow}>
              <Ionicons name="lock-closed" size={12} color={colors.success[600]} />
              <Text style={styles.endedByText}>Ended by {getProfileLabel(shiftEntry.ended_by)}</Text>
            </View>
          )}
        </LinearGradient>

        {renderCategoryGrid(shift.key)}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.primaryButton, (!editable || savingShift[shift.key]) && styles.buttonDisabled]}
            disabled={!editable || savingShift[shift.key]}
            onPress={() => handleSaveShift(shift.key)}
            accessibilityLabel={`Save ${shift.label}`}
            accessibilityRole="button"
          >
            {savingShift[shift.key] ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={16} color={colors.white} />
                <Text style={styles.primaryButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, (!canEnd || endingShift[shift.key]) && styles.buttonDisabled]}
            disabled={!canEnd || endingShift[shift.key]}
            onPress={() => handleEndShift(shift.key)}
            accessibilityLabel={`End ${shift.label}`}
            accessibilityRole="button"
          >
            {endingShift[shift.key] ? (
              <ActivityIndicator color={colors.primary[600]} size="small" />
            ) : (
              <>
                <Ionicons name="stop-circle-outline" size={16} color={colors.primary[600]} />
                <Text style={styles.secondaryButtonText}>End Shift</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {canRestart && (
          <TouchableOpacity
            style={[styles.restartButton, endingShift[shift.key] && styles.buttonDisabled]}
            disabled={endingShift[shift.key]}
            onPress={() => handleRestartShift(shift.key)}
            accessibilityLabel={`Restart ${shift.label}`}
            accessibilityRole="button"
          >
            <Ionicons name="refresh-outline" size={15} color={colors.warning[700]} />
            <Text style={styles.restartButtonText}>Restart Shift</Text>
          </TouchableOpacity>
        )}
      </AnimatedCard>
    );
  };

  const visibleShiftCards = useMemo(() => {
    if (isAdmin) return SHIFT_TYPES;
    if (shiftsByType.day?.ended_at) {
      if (shiftsByType.night?.ended_at) return [];
      return [SHIFT_TYPES.find((shift) => shift.key === 'night')].filter(Boolean);
    }
    return [SHIFT_TYPES.find((shift) => shift.key === 'day')].filter(Boolean);
  }, [isAdmin, shiftsByType]);

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Production"
        icon="construct-outline"
        right={
          (isAdmin || isGeneralManager) ? (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => setProductsModalVisible(true)}
            >
              <Ionicons name="settings" size={iconSizes.sm} color={colors.white} />
              <Text style={styles.headerActionText}>Manage</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: scrollBottomPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <InlineBanner
          visible={banner.visible}
          message={banner.message}
          type={banner.type}
          onHide={() => setBanner((b) => ({ ...b, visible: false }))}
        />
        {canChangeDate && (
          <DateNavigator
            selectedDate={selectedDate}
            todayString={todayString}
            formatLabel={formatDateLabel}
            canGoNext={selectedDate < todayString}
            onPrev={() => setSelectedDate((prev) => shiftDateByDays(prev, -1))}
            onNext={() => setSelectedDate((prev) => shiftDateByDays(prev, 1))}
            onSelectDate={openDatePicker}
            style={styles.dateNavigator}
          />
        )}

        {Platform.OS === 'ios' && (
          <Modal
            visible={datePickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setDatePickerVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.datePickerSheet}>
                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  onChange={(event, date) => {
                    if (event.type === 'set' && date) {
                      setTempDate(date);
                    }
                  }}
                />
                <View style={styles.datePickerActions}>
                  <TouchableOpacity
                    style={[styles.datePickerClose, styles.datePickerCancel]}
                    onPress={() => setDatePickerVisible(false)}
                  >
                    <Text style={[styles.datePickerCloseText, styles.datePickerCancelText]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.datePickerClose}
                    onPress={() => {
                      setSelectedDate(toDateOnlyString(tempDate));
                      setDatePickerVisible(false);
                    }}
                  >
                    <Text style={styles.datePickerCloseText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading production output...</Text>
          </View>
        ) : visibleShiftCards.length === 0 ? (
          <AnimatedCard variant="elevated" style={styles.shiftCard}>
            <Text style={styles.completedTitle}>All shifts completed</Text>
            <Text style={styles.completedText}>No active shifts for this date.</Text>
          </AnimatedCard>
        ) : (
          visibleShiftCards.map(renderShiftCard)
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Category Entry Modal */}
      <Modal
        visible={categoryModal.visible}
        animationType="slide"
        transparent
        onRequestClose={closeCategoryModal}
      >
        <View style={styles.catModalOverlay}>
          <View style={styles.catModalContent}>
            <View style={styles.catModalHandle} />
            {(() => {
              const config = CATEGORY_CONFIG.find((c) => c.key === categoryModal.categoryKey);
              if (!config || !categoryModal.shiftKey) return null;
              const shiftType = categoryModal.shiftKey;
              const categoryProducts = productsByCategory[categoryModal.categoryKey] || [];
              const editable = canEditShift(shiftsByType[shiftType]);
              const { summary } = getCategorySummary(shiftType, categoryModal.categoryKey);

              return (
                <>
                  <View style={styles.catModalHeader}>
                    <View style={styles.catModalHeaderLeft}>
                      <View style={[styles.catModalIconBadge, { backgroundColor: config.color + '18' }]}>
                        <Ionicons name={config.icon} size={24} color={config.color} />
                      </View>
                      <View>
                        <Text style={styles.catModalTitle}>{config.label}</Text>
                        <Text style={styles.catModalSubtitle}>{config.unitLabel} · {categoryProducts.filter((p) => p.is_active).length} products</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.catModalCloseBtn} onPress={closeCategoryModal}>
                      <Ionicons name="close" size={20} color={colors.neutral[600]} />
                    </TouchableOpacity>
                  </View>

                  <ScrollView style={styles.catModalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    {categoryProducts.length === 0 ? (
                      <View style={styles.emptyCategory}>
                        <Ionicons name="cube-outline" size={36} color={colors.neutral[300]} />
                        <Text style={styles.emptyText}>No products added yet.</Text>
                        <Text style={styles.emptyHint}>Use "Manage" button to add products.</Text>
                      </View>
                    ) : (
                      categoryProducts.map((product) => {
                        if (categoryModal.categoryKey === 'stretch' || categoryModal.categoryKey === 'bubble') {
                          return renderStretchBubbleRow(shiftType, product);
                        }
                        if (categoryModal.categoryKey === 'pouch') {
                          return renderPouchRow(shiftType, product);
                        }
                        return renderBabyRow(shiftType, product);
                      })
                    )}
                  </ScrollView>

                  <View style={styles.catModalFooter}>
                    <View style={styles.catModalSummary}>
                      <Ionicons name="calculator-outline" size={16} color={config.color} />
                      <Text style={[styles.catModalSummaryText, { color: config.color }]}>{summary}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.catModalDoneBtn, { backgroundColor: config.color }]}
                      onPress={closeCategoryModal}
                      accessibilityLabel="Done editing category"
                      accessibilityRole="button"
                    >
                      <Ionicons name="checkmark" size={18} color={colors.white} />
                      <Text style={styles.catModalDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={productsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setProductsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Products</Text>
              <TouchableOpacity
                onPress={() => setProductsModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>

              <View style={styles.categoryTabs}>
                {CATEGORY_CONFIG.map((category) => (
                  <TouchableOpacity
                    key={category.key}
                    style={[
                      styles.categoryTab,
                      selectedCategory === category.key && styles.categoryTabActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(category.key);
                      setNewProductName('');
                      setNewAvgWeight('');
                    }}
                  >
                    <Text
                      style={
                        selectedCategory === category.key
                          ? styles.categoryTabTextActive
                          : styles.categoryTabText
                      }
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.addProductRow}>
                <TextInput
                  style={styles.addProductInput}
                  placeholder="New product name"
                  value={newProductName}
                  onChangeText={setNewProductName}
                />
                {['stretch', 'bubble'].includes(selectedCategory) && (
                  <TextInput
                    style={styles.addProductInput}
                    placeholder="Avg weight (kg)"
                    value={newAvgWeight}
                    onChangeText={setNewAvgWeight}
                    keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                  />
                )}
                <TouchableOpacity style={styles.addProductButton} onPress={handleAddProduct}>
                  <Ionicons name="add" size={20} color={colors.white} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.productList}>
                {(productsByCategory[selectedCategory] || []).map((product) => (
                  <View key={product.id} style={styles.materialItem}>
                    {editingProductId === product.id ? (
                      <>
                        <TextInput
                          style={styles.editMaterialInput}
                          value={editingProductName}
                          onChangeText={setEditingProductName}
                        />
                        {['stretch', 'bubble'].includes(product.category) && (
                          <TextInput
                            style={styles.editMaterialInput}
                            value={editingAvgWeight}
                            onChangeText={setEditingAvgWeight}
                            placeholder="Avg weight (kg)"
                            keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                          />
                        )}
                        <View style={styles.materialActions}>
                          <TouchableOpacity style={styles.saveTag} onPress={handleSaveProduct}>
                            <Text style={styles.saveTagText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelTag}
                            onPress={() => {
                              setEditingProductId(null);
                              setEditingProductName('');
                              setEditingAvgWeight('');
                            }}
                          >
                            <Text style={styles.cancelTagText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.materialInfoBlock}>
                          <Text style={styles.materialItemName}>{product.name}</Text>
                          {product.avg_weight ? (
                            <Text style={styles.materialSubText}>Avg {product.avg_weight} kg</Text>
                          ) : null}
                          {!product.is_active && <Text style={styles.productInactive}>Disabled</Text>}
                        </View>
                        <View style={styles.materialActions}>
                          <TouchableOpacity
                            style={styles.editTag}
                            onPress={() => startEditingProduct(product)}
                          >
                            <Text style={styles.editTagText}>Edit</Text>
                          </TouchableOpacity>
                          {product.is_active && (
                            <TouchableOpacity
                              style={styles.disableTag}
                              onPress={() => handleDisableProduct(product)}
                            >
                              <Text style={styles.disableTagText}>Disable</Text>
                            </TouchableOpacity>
                          )}
                          {!product.is_active && (
                            <TouchableOpacity
                              style={styles.enableTag}
                              onPress={() => handleEnableProduct(product)}
                            >
                              <Text style={styles.enableTagText}>Enable</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacingSizes.lg,
    gap: spacingSizes.sm,
  },
  content: {
    padding: spacingSizes.xxl,
    paddingBottom: spacingSizes.huge,
  },
  headerCard: {
    borderRadius: 24,
    padding: spacingSizes.xxl,
    ...shadows.large,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.white,
    fontSize: textSizes.xxlarge,
    fontWeight: '700',
  },
  headerSubtitle: {
    opacity: 0.8,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
  },
  headerActionText: {
    marginLeft: spacingSizes.xs,
    color: colors.white,
    fontWeight: '600',
  },
  dateRow: {
    marginTop: spacingSizes.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: spacingSizes.lg,
    ...shadows.small,
  },
  shiftCard: {
    marginTop: spacingSizes.lg,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.white,
    ...shadows.medium,
    padding: 0,
  },
  shiftHeaderGradient: {
    padding: spacingSizes.lg,
    paddingBottom: spacingSizes.md,
  },
  shiftIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacingSizes.sm,
  },
  shiftMeta: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
    marginTop: 1,
  },
  endedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacingSizes.xs,
  },
  endedByText: {
    fontSize: textSizes.small,
    color: colors.success[600],
    fontWeight: '500',
  },
  dateNavigator: {
    marginBottom: spacingSizes.sm,
  },
  datePickerSheet: {
    backgroundColor: colors.white,
    padding: spacingSizes.lg,
    borderRadius: 18,
    width: '90%',
    alignSelf: 'center',
  },
  datePickerClose: {
    marginTop: spacingSizes.md,
    alignSelf: 'flex-end',
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    backgroundColor: colors.primary[600],
    borderRadius: 12,
  },
  datePickerCloseText: { color: colors.white, fontWeight: '700' },
  datePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
  },
  datePickerCancel: {
    backgroundColor: colors.neutral[200],
  },
  datePickerCancelText: {
    color: colors.text.primary,
  },
  dateNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  dateValue: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.large,
    fontWeight: '600',
    color: colors.text.primary,
  },
  card: {
    marginTop: spacingSizes.xl,
    padding: spacingSizes.xl,
  },
  shiftHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftTitle: {
    fontSize: textSizes.large,
    fontWeight: '700',
    color: colors.text.primary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: 16,
  },
  statusText: {
    marginLeft: spacingSizes.xs,
    color: colors.white,
    fontSize: textSizes.small,
    fontWeight: '600',
  },
  metaRow: {
    marginTop: spacingSizes.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  metaValue: {
    fontSize: textSizes.small,
    fontWeight: '600',
    color: colors.neutral[700],
  },
  // Grid cards
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacingSizes.md,
    gap: spacingSizes.sm,
  },
  gridCard: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 16,
    padding: spacingSizes.md,
    borderWidth: 1.5,
    borderColor: colors.neutral[150] || colors.neutral[200],
    minHeight: 110,
    justifyContent: 'center',
  },
  gridIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingSizes.sm,
  },
  gridCardTitle: {
    fontSize: textSizes.medium,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 3,
  },
  gridCardSummary: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
    fontWeight: '500',
  },
  gridCountBadge: {
    position: 'absolute',
    top: spacingSizes.sm,
    right: spacingSizes.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCountText: {
    fontSize: textSizes.tiny,
    fontWeight: '800',
  },

  // Category Entry Modal
  catModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  catModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '50%',
  },
  catModalHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.neutral[300],
    alignSelf: 'center',
    marginTop: spacingSizes.sm,
    marginBottom: spacingSizes.sm,
  },
  catModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.xl,
    paddingBottom: spacingSizes.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  catModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.md,
    flex: 1,
  },
  catModalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catModalTitle: {
    fontSize: textSizes.large,
    fontWeight: '700',
    color: colors.text.primary,
  },
  catModalSubtitle: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
    marginTop: 1,
  },
  catModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  catModalBody: {
    paddingHorizontal: spacingSizes.lg,
    paddingTop: spacingSizes.md,
    paddingBottom: spacingSizes.xl,
  },
  catModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacingSizes.xl,
    paddingVertical: spacingSizes.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    backgroundColor: colors.white,
  },
  catModalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
  },
  catModalSummaryText: {
    fontSize: textSizes.medium,
    fontWeight: '700',
  },
  catModalDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    paddingHorizontal: spacingSizes.xl,
    paddingVertical: spacingSizes.md,
    borderRadius: 14,
  },
  catModalDoneText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: textSizes.medium,
  },
  emptyHint: {
    fontSize: textSizes.small,
    color: colors.neutral[400],
    marginTop: spacingSizes.xs,
  },
  sectionTitle: {
    fontSize: textSizes.medium,
    fontWeight: '700',
    color: colors.text.primary,
  },
  sectionSubtitle: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  emptyCategory: {
    alignItems: 'center',
    paddingVertical: spacingSizes.lg,
    gap: spacingSizes.sm,
  },
  emptyText: {
    color: colors.neutral[400],
    fontSize: textSizes.small,
    marginBottom: spacingSizes.sm,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingSizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  productInfo: {
    flex: 1,
    marginRight: spacingSizes.md,
  },
  productName: {
    fontSize: textSizes.medium,
    fontWeight: '600',
    color: colors.text.primary,
  },
  productMeta: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  productInactive: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.tiny,
    color: colors.error[500],
    fontWeight: '600',
  },
  productInputCol: {
    alignItems: 'flex-end',
  },
  productInput: {
    width: 120,
    height: 48,
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    paddingHorizontal: spacingSizes.md,
    textAlign: 'right',
    fontSize: textSizes.large,
    fontWeight: '600',
    borderWidth: 1.5,
    borderColor: colors.neutral[200],
    color: colors.text.primary,
  },
  inputFilled: {
    borderColor: colors.primary[300],
    backgroundColor: colors.primary[50],
  },
  totalText: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  pouchBlock: {
    marginTop: spacingSizes.sm,
    padding: spacingSizes.md,
    borderRadius: 16,
    backgroundColor: colors.neutral[50],
  },
  pouchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingSizes.sm,
  },
  addLineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
  },
  addLineText: {
    marginLeft: spacingSizes.xs,
    color: colors.primary[700],
    fontWeight: '600',
  },
  pouchLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacingSizes.sm,
    gap: spacingSizes.xs,
  },
  pouchLineNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingSizes.md,
  },
  pouchLineNumberText: {
    fontSize: textSizes.tiny,
    fontWeight: '700',
    color: colors.primary[700],
  },
  pouchInputGroup: {
    flex: 1,
    marginRight: spacingSizes.sm,
  },
  pouchLabel: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
    marginBottom: spacingSizes.xs,
  },
  pouchInput: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.sm,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  removeLineButton: {
    padding: spacingSizes.sm,
  },
  inputDisabled: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[200],
    color: colors.neutral[400],
  },
  actionsRow: {
    marginTop: spacingSizes.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacingSizes.lg,
    paddingBottom: spacingSizes.md,
    gap: spacingSizes.sm,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacingSizes.md,
    borderRadius: 14,
    minHeight: 52,
    gap: spacingSizes.xs,
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    paddingVertical: spacingSizes.md,
    borderRadius: 14,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.primary[200],
    gap: spacingSizes.xs,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: textSizes.medium,
  },
  secondaryButtonText: {
    color: colors.primary[600],
    fontWeight: '700',
    fontSize: textSizes.medium,
  },
  restartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacingSizes.lg,
    marginBottom: spacingSizes.md,
    backgroundColor: colors.warning[50],
    paddingVertical: spacingSizes.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warning[200],
    gap: spacingSizes.xs,
  },
  restartButtonText: {
    color: colors.warning[700],
    fontWeight: '700',
    fontSize: textSizes.small,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    marginTop: spacingSizes.huge,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacingSizes.sm,
    color: colors.neutral[500],
  },
  completedTitle: {
    fontSize: textSizes.large,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
  },
  completedText: {
    marginTop: spacingSizes.sm,
    fontSize: textSizes.medium,
    color: colors.neutral[500],
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 120,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacingSizes.xl,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacingSizes.lg,
  },
  modalTitle: {
    fontSize: textSizes.large,
    fontWeight: '700',
    color: colors.text.primary,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacingSizes.md,
  },
  categoryTab: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 14,
    backgroundColor: colors.neutral[100],
    marginRight: spacingSizes.sm,
    marginBottom: spacingSizes.sm,
  },
  categoryTabActive: {
    backgroundColor: colors.primary[600],
  },
  categoryTabText: {
    color: colors.neutral[700],
    fontWeight: '600',
    fontSize: textSizes.small,
  },
  categoryTabTextActive: {
    color: colors.white,
    fontWeight: '600',
    fontSize: textSizes.small,
  },
  addProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacingSizes.lg,
  },
  addProductInput: {
    flex: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacingSizes.md,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    marginRight: spacingSizes.sm,
  },
  addProductButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  productList: {
    marginTop: spacingSizes.sm,
  },
  materialItem: {
    paddingVertical: spacingSizes.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  materialInfoBlock: {
    marginBottom: spacingSizes.sm,
  },
  materialItemName: {
    fontSize: textSizes.medium,
    fontWeight: '600',
    color: colors.text.primary,
  },
  materialSubText: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  materialActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editTag: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.primary[50],
    marginRight: spacingSizes.sm,
  },
  editTagText: {
    color: colors.primary[700],
    fontWeight: '600',
  },
  disableTag: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.error[50],
  },
  disableTagText: {
    color: colors.error[600],
    fontWeight: '600',
  },
  enableTag: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.success[50],
  },
  enableTagText: {
    color: colors.success[700],
    fontWeight: '600',
  },
  editMaterialInput: {
    backgroundColor: colors.neutral[50],
    borderRadius: 12,
    padding: spacingSizes.md,
    borderWidth: 1,
    borderColor: colors.neutral[100],
    marginBottom: spacingSizes.sm,
  },
  saveTag: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.success[50],
    marginRight: spacingSizes.sm,
  },
  saveTagText: {
    color: colors.success[600],
    fontWeight: '600',
  },
  cancelTag: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: 12,
    backgroundColor: colors.neutral[100],
  },
  cancelTagText: {
    color: colors.neutral[700],
    fontWeight: '600',
  },
});
