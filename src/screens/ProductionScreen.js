import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Animated,
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
import SectionDivider from '../components/SectionDivider';
import InlineBanner from '../components/InlineBanner';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, iconSizes, shadows } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { productionService } from '../services/productionService';
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

export default function ProductionScreen({ refreshSignal }) {
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const { user, roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const isGeneralManager = roles?.includes('general_manager');
  const isProductionManager = roles?.includes('production_manager');
  const canChangeDate = isAdmin || isGeneralManager;
  const { emitRefresh } = useRefreshBus();

  const [materials, setMaterials] = useState([]);
  const [entriesByShift, setEntriesByShift] = useState({ day: null, night: null });
  const [drafts, setDrafts] = useState({ day: { quantities: {}, notes: '' }, night: { quantities: {}, notes: '' } });
  const [profilesById, setProfilesById] = useState({});
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [tempDate, setTempDate] = useState(fromDateOnlyString(getTodayIST()));
  const [loading, setLoading] = useState(true);
  const [savingShift, setSavingShift] = useState({ day: false, night: false });
  const [endingShift, setEndingShift] = useState({ day: false, night: false });
  const [materialsModalVisible, setMaterialsModalVisible] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editingMaterialName, setEditingMaterialName] = useState('');
  const [banner, setBanner] = useState({ visible: false, message: '', type: 'success' });
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  const todayString = getTodayIST();
  const completedCount = [entriesByShift.day, entriesByShift.night].filter((e) => e?.ended_at).length;
  const activeShiftLabel = isAdmin
    ? 'Admin View'
    : completedCount === 2
      ? 'Completed'
      : completedCount === 0
        ? 'Day Shift'
        : 'Night Shift';
  const activeMaterialsCount = materials.filter((m) => m.is_active).length;

  const showBanner = (message, type = 'success') => {
    setBanner({ visible: true, message, type });
  };

  const loadProfiles = useCallback(async (ids) => {
    if (!ids.length) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role, roles')
      .in('id', ids);
    if (!error && data) {
      const map = {};
      data.forEach((p) => { map[p.id] = p; });
      setProfilesById(map);
    }
  }, []);

  const hydrateDrafts = useCallback((materialsList, entries) => {
    const nextDrafts = { day: { quantities: {}, notes: '' }, night: { quantities: {}, notes: '' } };
    ['day', 'night'].forEach((shift) => {
      const entry = entries?.[shift];
      const quantities = {};
      materialsList.forEach((m) => { quantities[m.id] = ''; });
      if (entry?.materials?.length) {
        entry.materials.forEach((item) => {
          if (item?.material_id) {
            quantities[item.material_id] = typeof item.quantity === 'number' ? String(item.quantity) : String(item.quantity || '');
          }
        });
      }
      nextDrafts[shift] = { quantities, notes: entry?.notes || '' };
    });
    setDrafts(nextDrafts);
  }, []);

  const refreshData = useCallback(async (dateString) => {
    setLoading(true);
    const [materialsResult, entriesResult] = await Promise.all([
      productionService.fetchMaterials(),
      productionService.fetchEntriesByDate(dateString),
    ]);

    if (materialsResult.error) Alert.alert('Error', materialsResult.error.message || 'Failed to load raw materials.');
    if (entriesResult.error) Alert.alert('Error', entriesResult.error.message || 'Failed to load shift entries.');

    const normalizedMaterials = Array.isArray(materialsResult.data) ? materialsResult.data : [];
    const entries = Array.isArray(entriesResult.data) ? entriesResult.data : [];

    const byShift = { day: null, night: null };
    entries.forEach((entry) => {
      if (entry?.shift_type === 'day') byShift.day = entry;
      if (entry?.shift_type === 'night') byShift.night = entry;
    });

    setMaterials(normalizedMaterials);
    setEntriesByShift(byShift);
    hydrateDrafts(normalizedMaterials, byShift);

    const profileIds = [byShift.day?.created_by, byShift.day?.ended_by, byShift.night?.created_by, byShift.night?.ended_by].filter(Boolean);
    await loadProfiles([...new Set(profileIds)]);
    setLoading(false);
  }, [hydrateDrafts, loadProfiles]);

  useEffect(() => { refreshData(selectedDate); }, [refreshData, selectedDate]);

  useRefreshOnFocus(
    () => refreshData(selectedDate),
    [refreshData, selectedDate],
    'raw_materials',
    refreshSignal
  );

  useEffect(() => {
    if (!canChangeDate && selectedDate !== todayString) setSelectedDate(todayString);
  }, [canChangeDate, selectedDate, todayString]);

  const getProfileLabel = (id) => {
    if (!id) return '—';
    const profile = profilesById[id];
    if (!profile) return `User ${id.slice(0, 6)}`;
    if (profile.full_name) return profile.full_name;
    return profile.role ? profile.role.replace('_', ' ') : `User ${id.slice(0, 6)}`;
  };

  const updateQuantity = (shiftType, materialId, value) => {
    setDrafts((prev) => ({
      ...prev,
      [shiftType]: { ...prev[shiftType], quantities: { ...prev[shiftType].quantities, [materialId]: value } },
    }));
  };

  const updateNotes = (shiftType, value) => {
    setDrafts((prev) => ({ ...prev, [shiftType]: { ...prev[shiftType], notes: value } }));
  };

  const canEditEntry = (entry) => {
    if (!entry) return true;
    return !entry.ended_at && entry.created_by === user?.id;
  };

  const canEndEntry = (entry) => {
    if (!entry) return isAdmin || isProductionManager || isGeneralManager;
    if (entry.ended_at) return false;
    return entry.created_by === user?.id || isAdmin || isGeneralManager;
  };

  const canRestartEntry = (entry) => !!(entry?.ended_at && (isAdmin || isGeneralManager));

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

  const handleSaveShift = async (shiftType) => {
    const entry = entriesByShift[shiftType];
    if (!canEditEntry(entry)) {
      Alert.alert('Not allowed', 'You can only edit your own shift until it is ended.');
      return;
    }
    if (materials.length === 0) {
      Alert.alert('Missing materials', 'No raw materials are configured yet.');
      return;
    }

    haptic('medium');
    setSavingShift((prev) => ({ ...prev, [shiftType]: true }));

    try {
      const draft = drafts[shiftType];
      const materialPayload = materials.map((m) => {
        const parsed = parseFloat(draft.quantities[m.id]);
        return { material_id: m.id, name: m.name, quantity: Number.isFinite(parsed) ? parsed : 0 };
      });

      const payload = {
        shift_date: selectedDate,
        shift_type: shiftType,
        materials: materialPayload,
        unit: 'kg',
        notes: draft.notes?.trim() || null,
        updated_at: new Date().toISOString(),
        updated_by: user?.id || null,
      };

      let result;
      if (entry?.id) {
        result = await productionService.updateShiftEntry(entry.id, payload);
      } else {
        result = await productionService.createShiftEntry(payload);
      }

      if (result.error) throw result.error;

      const savedEntry = result.data;
      setEntriesByShift((prev) => ({ ...prev, [shiftType]: savedEntry }));
      await loadProfiles([savedEntry?.created_by].filter(Boolean));

      await logService.logEvent({
        action: entry ? 'production.shift.update' : 'production.shift.create',
        entityType: 'production_shift',
        entityId: savedEntry?.id,
        metadata: { shift_type: shiftType, shift_date: selectedDate },
      });

      // Keep the other production sub-tab and Reports in sync with the save.
      emitRefresh('raw_materials');
      emitRefresh('reports');

      haptic('light');
      showBanner(`${shiftType === 'day' ? 'Day' : 'Night'} shift saved successfully.`, 'success');
    } catch (error) {
      haptic('heavy');
      Alert.alert('Error', error?.message || 'Failed to save shift entry.');
    } finally {
      setSavingShift((prev) => ({ ...prev, [shiftType]: false }));
    }
  };

  const handleEndShift = async (shiftType) => {
    const entry = entriesByShift[shiftType];
    if (!canEndEntry(entry)) {
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
              const draft = drafts[shiftType];
              const materialPayload = materials.map((m) => {
                const parsed = parseFloat(draft.quantities[m.id]);
                return { material_id: m.id, name: m.name, quantity: Number.isFinite(parsed) ? parsed : 0 };
              });

              const endPayload = {
                shift_date: selectedDate,
                shift_type: shiftType,
                materials: materialPayload,
                unit: 'kg',
                notes: draft.notes?.trim() || null,
                ended_at: new Date().toISOString(),
                ended_by: user?.id || null,
                updated_at: new Date().toISOString(),
                updated_by: user?.id || null,
              };

              let result;
              if (entry?.id) {
                result = await productionService.endShift(entry.id, endPayload);
              } else {
                result = await productionService.createShiftEntry(endPayload);
              }
              if (result.error) throw result.error;

              const savedEntry = result.data;
              setEntriesByShift((prev) => ({ ...prev, [shiftType]: savedEntry }));
              await loadProfiles([savedEntry?.ended_by, savedEntry?.created_by].filter(Boolean));

              if (!entry?.id) {
                await logService.logEvent({ action: 'production.shift.create', entityType: 'production_shift', entityId: savedEntry?.id, metadata: { shift_type: shiftType, shift_date: selectedDate } });
              }
              await logService.logEvent({ action: 'production.shift.end', entityType: 'production_shift', entityId: savedEntry?.id, metadata: { shift_type: shiftType, shift_date: selectedDate } });

              emitRefresh('raw_materials');
              emitRefresh('reports');
              showBanner(`${shiftType === 'day' ? 'Day' : 'Night'} shift ended.`, 'info');
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
    const entry = entriesByShift[shiftType];
    if (!canRestartEntry(entry)) return;

    Alert.alert('Restart Shift', 'Restarting will allow editing again. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        onPress: async () => {
          haptic('medium');
          setEndingShift((prev) => ({ ...prev, [shiftType]: true }));
          try {
            const result = await productionService.restartShift(entry.id);
            if (result.error) throw result.error;
            setEntriesByShift((prev) => ({ ...prev, [shiftType]: result.data }));
            await logService.logEvent({ action: 'production.shift.restart', entityType: 'production_shift', entityId: result.data?.id, metadata: { shift_type: shiftType, shift_date: selectedDate } });
            emitRefresh('raw_materials');
            emitRefresh('reports');
            showBanner('Shift restarted — editing enabled.', 'warning');
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to restart shift.');
          } finally {
            setEndingShift((prev) => ({ ...prev, [shiftType]: false }));
          }
        },
      },
    ]);
  };

  const handleAddMaterial = async () => {
    const name = newMaterialName.trim();
    if (!name) { Alert.alert('Missing name', 'Enter a material name to add.'); return; }
    try {
      const result = await productionService.addMaterial(name);
      if (result.error) throw result.error;
      setMaterials((prev) => [...prev, result.data]);
      setDrafts((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((shift) => {
          next[shift] = { ...next[shift], quantities: { ...next[shift].quantities, [result.data.id]: '' } };
        });
        return next;
      });
      setNewMaterialName('');
      await logService.logEvent({ action: 'production.material.add', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { name } });
      emitRefresh('raw_materials');
      emitRefresh('reports');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to add material.');
    }
  };

  const startEditingMaterial = (material) => {
    setEditingMaterialId(material.id);
    setEditingMaterialName(material.name);
  };

  const handleSaveMaterialName = async () => {
    const nextName = editingMaterialName.trim();
    if (!nextName) { Alert.alert('Missing name', 'Enter a new material name.'); return; }
    const current = materials.find((m) => m.id === editingMaterialId);
    if (!current) return;
    try {
      const result = await productionService.updateMaterial(editingMaterialId, { name: nextName });
      if (result.error) throw result.error;
      setMaterials((prev) => prev.map((m) => (m.id === editingMaterialId ? result.data : m)));
      setEditingMaterialId(null);
      setEditingMaterialName('');
      await logService.logEvent({ action: 'production.material.rename', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { from: current.name, to: nextName } });
      emitRefresh('raw_materials');
      emitRefresh('reports');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to rename material.');
    }
  };

  const handleDisableMaterial = async (material) => {
    Alert.alert('Disable material', `Disable ${material.name}? It will no longer appear for new entries.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disable',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await productionService.updateMaterial(material.id, { is_active: false });
            if (result.error) throw result.error;
            setMaterials((prev) => prev.map((m) => (m.id === material.id ? result.data : m)));
            await logService.logEvent({ action: 'production.material.disable', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { name: material.name } });
            emitRefresh('raw_materials');
            emitRefresh('reports');
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to disable material.');
          }
        },
      },
    ]);
  };

  const handleEnableMaterial = async (material) => {
    Alert.alert('Enable material', `Enable ${material.name}? It will appear for new entries.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Enable',
        onPress: async () => {
          try {
            const result = await productionService.updateMaterial(material.id, { is_active: true });
            if (result.error) throw result.error;
            setMaterials((prev) => prev.map((m) => (m.id === material.id ? result.data : m)));
            await logService.logEvent({ action: 'production.material.enable', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { name: material.name } });
            emitRefresh('raw_materials');
            emitRefresh('reports');
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to enable material.');
          }
        },
      },
    ]);
  };

  // Compute total for a shift
  const computeTotal = (shiftKey) => {
    const quantities = drafts[shiftKey]?.quantities || {};
    return materials.reduce((sum, m) => {
      const parsed = parseFloat(quantities[m.id]);
      return sum + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
  };

  const renderShiftCard = (shift) => {
    const entry = entriesByShift[shift.key];
    const editable = canEditEntry(entry);
    const canEnd = canEndEntry(entry);
    const canRestart = canRestartEntry(entry);
    const total = computeTotal(shift.key);
    const activeMaterials = materials.filter((m) => m.is_active);
    const inactiveMaterials = materials.filter((m) => !m.is_active);

    return (
      <AnimatedCard key={shift.key} variant="elevated" style={styles.shiftCard}>
        {/* Shift header with accent color */}
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
                {entry?.created_by && (
                  <Text style={styles.shiftMeta}>by {getProfileLabel(entry.created_by)}</Text>
                )}
              </View>
            </View>
            <ShiftStatusBadge entry={entry} />
          </View>

          {entry?.ended_at && entry?.ended_by && (
            <View style={styles.endedByRow}>
              <Ionicons name="lock-closed" size={12} color={colors.success[600]} />
              <Text style={styles.endedByText}>Ended by {getProfileLabel(entry.ended_by)}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Total KPI Strip */}
        <View style={styles.totalStrip}>
          <View style={styles.totalStripLeft}>
            <Ionicons name="cube" size={18} color={colors.primary[700]} />
            <Text style={styles.totalStripLabel}>Total Raw Material</Text>
          </View>
          <Text style={[styles.totalStripValue, total > 0 && styles.totalStripValueActive]}>
            {total > 0 ? `${total.toFixed(1)} kg` : '—'}
          </Text>
        </View>

        {/* Materials section */}
        <SectionDivider
          label={`Materials (${activeMaterials.length})`}
          right={
            total > 0 ? (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{total.toFixed(1)} kg</Text>
              </View>
            ) : null
          }
        />

        {activeMaterials.length === 0 && (
          <View style={styles.emptyMaterials}>
            <Ionicons name="cube-outline" size={32} color={colors.neutral[300]} />
            <Text style={styles.emptyMaterialsText}>No materials configured</Text>
          </View>
        )}

        {activeMaterials.map((material, index) => {
          const value = drafts[shift.key]?.quantities?.[material.id] ?? '';
          const disabled = !editable;
          const isEven = index % 2 === 0;
          const hasFilled = !disabled && value && parseFloat(value) > 0;

          return (
            <View
              key={material.id}
              style={[styles.materialRow, isEven && styles.materialRowEven, hasFilled && styles.materialRowFilled]}
            >
              <View style={styles.materialInfo}>
                <View style={styles.materialNameRow}>
                  <Ionicons
                    name={hasFilled ? 'checkmark-circle' : 'ellipse-outline'}
                    size={18}
                    color={hasFilled ? colors.success[500] : colors.neutral[300]}
                  />
                  <Text style={styles.materialName}>{material.name}</Text>
                </View>
                <Text style={styles.materialUnit}>kg</Text>
              </View>
              <TextInput
                style={[
                  styles.materialInput,
                  disabled && styles.inputDisabled,
                  hasFilled && styles.inputFilled,
                ]}
                value={value}
                onChangeText={(text) => updateQuantity(shift.key, material.id, text)}
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                editable={!disabled}
                returnKeyType="done"
                accessibilityLabel={`${material.name} quantity in kg for ${shift.label}`}
                accessibilityHint={disabled ? 'This field is locked' : 'Enter quantity in kilograms'}
              />
            </View>
          );
        })}

        {/* Inactive materials (collapsed) */}
        {inactiveMaterials.length > 0 && isAdmin && (
          <View style={styles.inactiveMaterialsNote}>
            <Ionicons name="eye-off-outline" size={13} color={colors.neutral[400]} />
            <Text style={styles.inactiveMaterialsText}>{inactiveMaterials.length} inactive material(s) hidden</Text>
          </View>
        )}

        {/* Notes - collapsible */}
        <TouchableOpacity
          style={styles.notesToggle}
          onPress={() => {
            const notesKey = `showNotes_${shift.key}`;
            setDrafts((prev) => ({
              ...prev,
              [shift.key]: { ...prev[shift.key], _showNotes: !prev[shift.key]?._showNotes },
            }));
          }}
          accessibilityLabel="Toggle notes section"
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={16} color={colors.neutral[500]} />
          <Text style={styles.notesToggleText}>
            {drafts[shift.key]?.notes ? 'Edit Notes' : 'Add Notes'}
          </Text>
          <Ionicons
            name={drafts[shift.key]?._showNotes ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.neutral[400]}
          />
        </TouchableOpacity>
        {drafts[shift.key]?._showNotes && (
          <TextInput
            style={[styles.notesInput, !editable && styles.inputDisabled]}
            value={drafts[shift.key]?.notes || ''}
            onChangeText={(text) => updateNotes(shift.key, text)}
            placeholder="Add any notes for this shift…"
            placeholderTextColor={colors.neutral[400]}
            editable={editable}
            multiline
            returnKeyType="done"
            blurOnSubmit
            accessibilityLabel={`Notes for ${shift.label}`}
          />
        )}

        {/* Action buttons */}
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

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Raw Material"
        icon="cube-outline"
        right={
          (isAdmin || isGeneralManager) ? (
            <TouchableOpacity
              style={styles.headerAction}
              onPress={() => { haptic('light'); setMaterialsModalVisible(true); }}
              accessibilityLabel="Manage raw materials"
              accessibilityRole="button"
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
        {/* Inline banner */}
        <InlineBanner
          visible={banner.visible}
          message={banner.message}
          type={banner.type}
          onHide={() => setBanner((b) => ({ ...b, visible: false }))}
        />

        {/* Date navigator */}
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
            <Text style={styles.loadingText}>Loading production entries…</Text>
          </View>
        ) : (
          <>
            {!isAdmin && entriesByShift.day?.ended_at && entriesByShift.night?.ended_at ? (
              <AnimatedCard variant="elevated" style={styles.completedCard}>
                <Ionicons name="checkmark-circle" size={48} color={colors.success[400]} />
                <Text style={styles.completedTitle}>All shifts completed</Text>
                <Text style={styles.completedText}>No active shifts for {formatDateLabel(selectedDate)}.</Text>
              </AnimatedCard>
            ) : (
              (isAdmin
                ? SHIFT_TYPES
                : (entriesByShift.day?.ended_at
                  ? [SHIFT_TYPES.find((s) => s.key === 'night')]
                  : [SHIFT_TYPES.find((s) => s.key === 'day')])
              ).filter(Boolean).map(renderShiftCard)
            )}
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>

      {/* Manage Materials Modal */}
      <Modal
        visible={materialsModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMaterialsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Raw Materials</Text>
                <Text style={styles.modalSubtitle}>{activeMaterialsCount} active material(s)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setMaterialsModalVisible(false)}
                style={styles.modalCloseButton}
                accessibilityLabel="Close modal"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={22} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>

            {/* Add new material */}
            <View style={styles.addMaterialRow}>
              <TextInput
                style={styles.addMaterialInput}
                placeholder="New material name (e.g. LL, LD)"
                placeholderTextColor={colors.neutral[400]}
                value={newMaterialName}
                onChangeText={setNewMaterialName}
                returnKeyType="done"
                onSubmitEditing={handleAddMaterial}
                accessibilityLabel="New material name"
              />
              <TouchableOpacity
                style={styles.addMaterialButton}
                onPress={handleAddMaterial}
                accessibilityLabel="Add material"
                accessibilityRole="button"
              >
                <Ionicons name="add" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            {materials.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="cube-outline" size={40} color={colors.neutral[300]} />
                <Text style={styles.modalEmptyText}>No materials yet. Add one above.</Text>
              </View>
            ) : (
              <ScrollView style={styles.materialList} showsVerticalScrollIndicator={false}>
                {materials.map((material) => (
                  <View key={material.id} style={styles.materialItem}>
                    {editingMaterialId === material.id ? (
                      <>
                        <TextInput
                          style={styles.editMaterialInput}
                          value={editingMaterialName}
                          onChangeText={setEditingMaterialName}
                          returnKeyType="done"
                          onSubmitEditing={handleSaveMaterialName}
                          autoFocus
                          accessibilityLabel="Edit material name"
                        />
                        <View style={styles.materialActions}>
                          <TouchableOpacity
                            style={styles.saveTag}
                            onPress={handleSaveMaterialName}
                            accessibilityLabel="Save material name"
                          >
                            <Ionicons name="checkmark" size={14} color={colors.success[600]} />
                            <Text style={styles.saveTagText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelTag}
                            onPress={() => { setEditingMaterialId(null); setEditingMaterialName(''); }}
                            accessibilityLabel="Cancel editing"
                          >
                            <Text style={styles.cancelTagText}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.materialInfoBlock}>
                          <Text style={styles.materialItemName}>{material.name}</Text>
                          {!material.is_active && (
                            <View style={styles.disabledBadge}>
                              <Text style={styles.disabledBadgeText}>Disabled</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.materialActions}>
                          <TouchableOpacity
                            style={styles.editTag}
                            onPress={() => startEditingMaterial(material)}
                            accessibilityLabel={`Rename ${material.name}`}
                          >
                            <Ionicons name="pencil" size={13} color={colors.primary[700]} />
                            <Text style={styles.editTagText}>Rename</Text>
                          </TouchableOpacity>
                          {material.is_active && (
                            <TouchableOpacity
                              style={styles.disableTag}
                              onPress={() => handleDisableMaterial(material)}
                              accessibilityLabel={`Disable ${material.name}`}
                            >
                              <Text style={styles.disableTagText}>Disable</Text>
                            </TouchableOpacity>
                          )}
                          {!material.is_active && (
                            <TouchableOpacity
                              style={styles.enableTag}
                              onPress={() => handleEnableMaterial(material)}
                              accessibilityLabel={`Enable ${material.name}`}
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
            )}
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAction: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radii.md,
  },
  headerActionText: { marginLeft: spacingSizes.xs, color: colors.white, fontWeight: '600' },
  listContent: { paddingTop: spacingSizes.lg, gap: spacingSizes.sm },
  dateNavigator: { marginBottom: spacingSizes.sm },
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

  // Shift card
  shiftCard: { borderRadius: 18, overflow: 'hidden', padding: 0, backgroundColor: colors.white, ...shadows.medium },
  shiftHeaderGradient: { padding: spacingSizes.lg, paddingBottom: spacingSizes.md },
  shiftHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  shiftTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.md },
  shiftIconBadge: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  shiftTitle: { fontSize: textSizes.large, fontWeight: '700', color: colors.text.primary },
  shiftMeta: { fontSize: textSizes.small, color: colors.neutral[500], marginTop: 1 },
  endedByRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: spacingSizes.xs,
  },
  endedByText: { fontSize: textSizes.small, color: colors.success[600], fontWeight: '500' },

  // Total KPI Strip
  totalStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacingSizes.lg, paddingVertical: spacingSizes.md,
    backgroundColor: colors.primary[50], borderBottomWidth: 1, borderBottomColor: colors.primary[100],
  },
  totalStripLeft: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  totalStripLabel: { fontSize: textSizes.medium, fontWeight: '600', color: colors.primary[700] },
  totalStripValue: { fontSize: textSizes.large, fontWeight: '700', color: colors.neutral[400] },
  totalStripValueActive: { color: colors.primary[700] },

  // Materials
  materialNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  materialRowFilled: { backgroundColor: colors.success[50] },
  materialRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacingSizes.md, paddingHorizontal: spacingSizes.lg,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  materialRowEven: { backgroundColor: colors.neutral[50] },
  materialInfo: { flex: 1 },
  materialName: { fontSize: textSizes.medium, color: colors.text.primary, fontWeight: '600' },
  materialUnit: { fontSize: textSizes.tiny, color: colors.neutral[400], marginTop: 2 },
  materialInput: {
    width: 120, height: 48, backgroundColor: colors.white,
    borderRadius: 12, paddingHorizontal: spacingSizes.md,
    textAlign: 'right', fontSize: textSizes.large, fontWeight: '600',
    borderWidth: 1.5, borderColor: colors.neutral[200], color: colors.text.primary,
  },
  inputDisabled: {
    backgroundColor: colors.neutral[100], borderColor: colors.neutral[200],
    color: colors.neutral[400],
  },
  inputFilled: { borderColor: colors.primary[300], backgroundColor: colors.primary[50] },
  inactiveMaterialsNote: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacingSizes.lg, paddingVertical: spacingSizes.sm,
  },
  inactiveMaterialsText: { fontSize: textSizes.tiny, color: colors.neutral[400] },
  emptyMaterials: { alignItems: 'center', paddingVertical: spacingSizes.xl, gap: spacingSizes.sm },
  emptyMaterialsText: { fontSize: textSizes.medium, color: colors.neutral[400] },
  totalBadge: {
    backgroundColor: colors.primary[100], paddingHorizontal: spacingSizes.sm,
    paddingVertical: 3, borderRadius: 8,
  },
  totalBadgeText: { fontSize: textSizes.tiny, fontWeight: '700', color: colors.primary[700] },

  // Notes
  notesToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm,
    marginHorizontal: spacingSizes.lg, marginTop: spacingSizes.sm,
    paddingVertical: spacingSizes.md, paddingHorizontal: spacingSizes.md,
    backgroundColor: colors.neutral[50], borderRadius: 12,
    borderWidth: 1, borderColor: colors.neutral[150] || colors.neutral[200],
  },
  notesToggleText: {
    flex: 1, fontSize: textSizes.medium, color: colors.neutral[500], fontWeight: '600',
  },
  notesInput: {
    marginHorizontal: spacingSizes.lg, marginBottom: spacingSizes.md, marginTop: spacingSizes.sm,
    minHeight: 80, backgroundColor: colors.neutral[50],
    borderRadius: 12, padding: spacingSizes.md,
    borderWidth: 1.5, borderColor: colors.neutral[200],
    textAlignVertical: 'top', fontSize: textSizes.medium, color: colors.text.primary,
  },

  // Action buttons
  actionsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingHorizontal: spacingSizes.lg, paddingBottom: spacingSizes.md, gap: spacingSizes.sm,
  },
  primaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary[600], paddingVertical: spacingSizes.md,
    borderRadius: 14, gap: spacingSizes.xs, minHeight: 52,
  },
  secondaryButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary[50], paddingVertical: spacingSizes.md,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.primary[200],
    gap: spacingSizes.xs, minHeight: 52,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: textSizes.medium },
  secondaryButtonText: { color: colors.primary[600], fontWeight: '700', fontSize: textSizes.medium },
  restartButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: spacingSizes.lg, marginBottom: spacingSizes.md,
    backgroundColor: colors.warning[50], paddingVertical: spacingSizes.sm,
    borderRadius: 12, borderWidth: 1, borderColor: colors.warning[200], gap: spacingSizes.xs,
  },
  restartButtonText: { color: colors.warning[700], fontWeight: '700', fontSize: textSizes.small },
  buttonDisabled: { opacity: 0.5 },

  // Loading / completed
  loadingContainer: { marginTop: spacingSizes.huge, alignItems: 'center', gap: spacingSizes.sm },
  loadingText: { color: colors.neutral[500], fontSize: textSizes.medium },
  completedCard: {
    alignItems: 'center', padding: spacingSizes.xxl, gap: spacingSizes.sm,
    backgroundColor: colors.white, borderRadius: 18,
  },
  completedTitle: { fontSize: textSizes.large, fontWeight: '700', color: colors.text.primary },
  completedText: { fontSize: textSizes.medium, color: colors.neutral[500], textAlign: 'center' },
  bottomSpacer: { height: 120 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacingSizes.xl, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacingSizes.lg,
  },
  modalTitle: { fontSize: textSizes.large, fontWeight: '700', color: colors.text.primary },
  modalSubtitle: { fontSize: textSizes.small, color: colors.neutral[400], marginTop: 2 },
  modalCloseButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center',
  },
  addMaterialRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacingSizes.lg, gap: spacingSizes.sm },
  addMaterialInput: {
    flex: 1, backgroundColor: colors.neutral[50], borderRadius: 14,
    paddingHorizontal: spacingSizes.md, height: 48,
    borderWidth: 1.5, borderColor: colors.neutral[200], fontSize: textSizes.medium,
  },
  addMaterialButton: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center',
  },
  materialList: { marginTop: spacingSizes.sm },
  materialItem: {
    paddingVertical: spacingSizes.md, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  materialInfoBlock: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm, marginBottom: spacingSizes.sm },
  materialItemName: { fontSize: textSizes.medium, fontWeight: '600', color: colors.text.primary },
  disabledBadge: {
    backgroundColor: colors.neutral[100], paddingHorizontal: spacingSizes.sm,
    paddingVertical: 2, borderRadius: 6,
  },
  disabledBadgeText: { fontSize: textSizes.tiny, color: colors.neutral[500], fontWeight: '600' },
  materialActions: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  editTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.primary[50], minHeight: 36,
  },
  editTagText: { color: colors.primary[700], fontWeight: '600', fontSize: textSizes.small },
  disableTag: {
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.error[50], minHeight: 36,
    justifyContent: 'center',
  },
  disableTagText: { color: colors.error[600], fontWeight: '600', fontSize: textSizes.small },
  enableTag: {
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.success[50], minHeight: 36,
    justifyContent: 'center',
  },
  enableTagText: { color: colors.success[700], fontWeight: '600', fontSize: textSizes.small },
  editMaterialInput: {
    backgroundColor: colors.neutral[50], borderRadius: 12, padding: spacingSizes.md,
    borderWidth: 1.5, borderColor: colors.primary[300], marginBottom: spacingSizes.sm,
    fontSize: textSizes.medium,
  },
  saveTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.success[50], minHeight: 36,
  },
  saveTagText: { color: colors.success[600], fontWeight: '600', fontSize: textSizes.small },
  cancelTag: {
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.neutral[100], minHeight: 36, justifyContent: 'center',
  },
  cancelTagText: { color: colors.neutral[700], fontWeight: '600', fontSize: textSizes.small },
  modalEmpty: { alignItems: 'center', paddingVertical: spacingSizes.xxl, gap: spacingSizes.md },
  modalEmptyText: { fontSize: textSizes.medium, color: colors.neutral[400] },
});
