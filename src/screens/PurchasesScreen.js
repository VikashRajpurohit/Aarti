import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientBackground from '../components/GradientBackground';
import AnimatedCard from '../components/AnimatedCard';
import ResponsiveText from '../components/ResponsiveText';
import ScreenHeader from '../components/ScreenHeader';
import DateNavigator from '../components/DateNavigator';
import InlineBanner from '../components/InlineBanner';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, iconSizes, shadows } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { purchaseService } from '../services/purchaseService';
import { productionService } from '../services/productionService';
import { logService } from '../services/logService';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useAuth } from '../context/AuthContext';
import { useRefreshBus } from '../context/RefreshBusContext';
import { addDaysToDateOnly, getTodayIST } from '../utils/dateOnly';

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

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    return '';
  }
};

export default function PurchasesScreen({ refreshSignal }) {
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const { user, roles } = useAuth();
  const { emitRefresh } = useRefreshBus();
  const isAdmin = roles?.includes('admin');
  const isGeneralManager = roles?.includes('general_manager');
  const isPurchaseManager = roles?.includes('purchase_manager');

  const [materials, setMaterials] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState({ visible: false, message: '', type: 'success' });

  // Form state
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [editingEntryId, setEditingEntryId] = useState(null);

  // Manage materials modal state
  const [allMaterials, setAllMaterials] = useState([]);
  const [materialsModalVisible, setMaterialsModalVisible] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState('');
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editingMaterialName, setEditingMaterialName] = useState('');

  const todayString = getTodayIST();

  const showBanner = (message, type = 'success') => {
    setBanner({ visible: true, message, type });
  };

  const refreshData = useCallback(async (dateString) => {
    setLoading(true);
    const [materialsResult, allMaterialsResult, entriesResult] = await Promise.all([
      purchaseService.fetchMaterials(),
      productionService.fetchMaterials(),
      purchaseService.fetchEntriesByDate(dateString),
    ]);

    if (materialsResult.error) Alert.alert('Error', materialsResult.error.message || 'Failed to load materials.');
    if (entriesResult.error) Alert.alert('Error', entriesResult.error.message || 'Failed to load entries.');

    const mats = Array.isArray(materialsResult.data) ? materialsResult.data : [];
    const allMats = Array.isArray(allMaterialsResult?.data) ? allMaterialsResult.data : [];
    const ents = Array.isArray(entriesResult.data) ? entriesResult.data : [];

    setMaterials(mats);
    setAllMaterials(allMats);
    setEntries(ents);
    setSelectedMaterial((prev) => (prev || (mats.length > 0 ? mats[0].id : null)));
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshData(selectedDate);
  }, [refreshData, selectedDate]);

  useRefreshOnFocus(
    () => refreshData(selectedDate),
    [refreshData, selectedDate],
    'purchases',
    refreshSignal
  );

  const materialMap = useMemo(() => {
    const map = {};
    materials.forEach((m) => { map[m.id] = m.name; });
    return map;
  }, [materials]);

  const todayTotal = useMemo(() => {
    return entries.reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0);
  }, [entries]);

  const activeMaterialsCount = allMaterials.filter((m) => m.is_active).length;

  const canEdit = (entry) => {
    if (isAdmin) return true;
    return isPurchaseManager && entry.created_by === user?.id;
  };

  // ── Manage Materials handlers ──
  const handleAddMaterial = async () => {
    const name = newMaterialName.trim();
    if (!name) { Alert.alert('Missing name', 'Enter a material name to add.'); return; }
    try {
      const result = await productionService.addMaterial(name);
      if (result.error) throw result.error;
      setAllMaterials((prev) => [...prev, result.data]);
      if (result.data.is_active) setMaterials((prev) => [...prev, result.data]);
      setNewMaterialName('');
      await logService.logEvent({ action: 'production.material.add', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { name } });
      emitRefresh('raw_materials');
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
    const current = allMaterials.find((m) => m.id === editingMaterialId);
    if (!current) return;
    try {
      const result = await productionService.updateMaterial(editingMaterialId, { name: nextName });
      if (result.error) throw result.error;
      setAllMaterials((prev) => prev.map((m) => (m.id === editingMaterialId ? result.data : m)));
      setMaterials((prev) => prev.map((m) => (m.id === editingMaterialId ? result.data : m)));
      setEditingMaterialId(null);
      setEditingMaterialName('');
      await logService.logEvent({ action: 'production.material.rename', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { from: current.name, to: nextName } });
      emitRefresh('raw_materials');
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
            setAllMaterials((prev) => prev.map((m) => (m.id === material.id ? result.data : m)));
            setMaterials((prev) => prev.filter((m) => m.id !== material.id));
            await logService.logEvent({ action: 'production.material.disable', entityType: 'raw_material_type', entityId: result.data?.id, metadata: { name: material.name } });
            emitRefresh('raw_materials');
          } catch (error) {
            Alert.alert('Error', error?.message || 'Failed to disable material.');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setQuantity('');
    setSupplier('');
    setNotes('');
    setEditingEntryId(null);
    if (materials.length > 0) setSelectedMaterial(materials[0].id);
  };

  const handleSave = async () => {
    const qty = parseFloat(quantity);
    if (!selectedMaterial) {
      Alert.alert('Select material', 'Please select a material.');
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }

    setSaving(true);
    try {
      if (editingEntryId) {
        const payload = {
          material_id: selectedMaterial,
          quantity: qty,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null,
        };
        const result = await purchaseService.updatePurchaseEntry(editingEntryId, payload);
        if (result.error) throw result.error;

        await logService.logEvent({
          action: 'purchase.entry.update',
          entityType: 'purchase_entry',
          entityId: editingEntryId,
          metadata: { material: materialMap[selectedMaterial], quantity: qty },
        });
        showBanner('Entry updated successfully.');
      } else {
        const payload = {
          purchase_date: selectedDate,
          material_id: selectedMaterial,
          quantity: qty,
          supplier: supplier.trim() || null,
          notes: notes.trim() || null,
        };
        const result = await purchaseService.createPurchaseEntry(payload);
        if (result.error) throw result.error;

        await logService.logEvent({
          action: 'purchase.entry.create',
          entityType: 'purchase_entry',
          entityId: result.data?.id,
          metadata: { material: materialMap[selectedMaterial], quantity: qty, date: selectedDate },
        });
        showBanner('Purchase entry added.');
      }

      resetForm();
      await refreshData(selectedDate);
      // Reflect the change in Reports (purchases + stock balance).
      emitRefresh('purchases');
      emitRefresh('reports');
    } catch (error) {
      Alert.alert('Error', error?.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setEditingEntryId(entry.id);
    setSelectedMaterial(entry.material_id);
    setQuantity(String(entry.quantity));
    setSupplier(entry.supplier || '');
    setNotes(entry.notes || '');
  };

  const handleDelete = (entry) => {
    Alert.alert(
      'Delete Entry',
      `Delete ${materialMap[entry.material_id] || 'this'} — ${entry.quantity} kg?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await purchaseService.deletePurchaseEntry(entry.id);
              if (result.error) throw result.error;

              await logService.logEvent({
                action: 'purchase.entry.delete',
                entityType: 'purchase_entry',
                entityId: entry.id,
                metadata: { material: materialMap[entry.material_id], quantity: entry.quantity },
              });
              showBanner('Entry deleted.', 'info');
              await refreshData(selectedDate);
              emitRefresh('purchases');
              emitRefresh('reports');
            } catch (error) {
              Alert.alert('Error', error?.message || 'Failed to delete entry.');
            }
          },
        },
      ]
    );
  };

  const renderEntryItem = (entry, index) => {
    const editable = canEdit(entry);
    return (
      <View key={entry.id} style={[styles.entryRow, index % 2 === 0 && styles.entryRowAlt]}>
        <View style={styles.entryInfo}>
          <View style={styles.entryTitleRow}>
            <View style={[styles.materialDot, { backgroundColor: colors.primary[500] }]} />
            <Text style={styles.entryMaterial}>{materialMap[entry.material_id] || 'Unknown'}</Text>
            <Text style={styles.entryQty}>{parseFloat(entry.quantity).toFixed(1)} kg</Text>
          </View>
          {entry.supplier ? (
            <Text style={styles.entryMeta}>Supplier: {entry.supplier}</Text>
          ) : null}
          {entry.notes ? (
            <Text style={styles.entryMeta}>{entry.notes}</Text>
          ) : null}
          <Text style={styles.entryTime}>{formatTime(entry.created_at)}</Text>
        </View>
        {editable && (
          <View style={styles.entryActions}>
            <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(entry)}>
              <Ionicons name="pencil" size={14} color={colors.primary[700]} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(entry)}>
              <Ionicons name="trash" size={14} color={colors.error[600]} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Purchases"
        icon="bag-add-outline"
        right={
          (isAdmin || isGeneralManager) ? (
            <TouchableOpacity style={styles.manageButton} onPress={() => setMaterialsModalVisible(true)}>
              <Ionicons name="settings-outline" size={iconSizes.sm} color={colors.white} />
              <Text style={styles.manageButtonText}>Manage</Text>
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

        <DateNavigator
          selectedDate={selectedDate}
          todayString={todayString}
          formatLabel={formatDateLabel}
          canGoNext={selectedDate < todayString}
          onPrev={() => setSelectedDate((prev) => shiftDateByDays(prev, -1))}
          onNext={() => setSelectedDate((prev) => shiftDateByDays(prev, 1))}
          style={styles.dateNavigator}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary[600]} />
            <Text style={styles.loadingText}>Loading purchases...</Text>
          </View>
        ) : (
          <>
            {/* Entry Form */}
            <AnimatedCard variant="elevated" style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingEntryId ? 'Edit Entry' : 'New Purchase Entry'}
              </Text>

              {/* Material selector — wraps, never scrolls horizontally */}
              <Text style={styles.fieldLabel}>Material</Text>
              <View style={styles.materialChips}>
                {materials.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.chip, selectedMaterial === m.id && styles.chipActive]}
                    onPress={() => setSelectedMaterial(m.id)}
                  >
                    <Text style={[styles.chipText, selectedMaterial === m.id && styles.chipTextActive]}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quantity */}
              <Text style={styles.fieldLabel}>Quantity (kg)</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                keyboardType={Platform.OS === 'ios' ? 'decimal-pad' : 'numeric'}
                returnKeyType="done"
              />

              {/* Supplier */}
              <Text style={styles.fieldLabel}>Supplier (optional)</Text>
              <TextInput
                style={styles.input}
                value={supplier}
                onChangeText={setSupplier}
                placeholder="Supplier name"
                placeholderTextColor={colors.neutral[400]}
                returnKeyType="done"
              />

              {/* Notes */}
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.notesInput]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any notes..."
                placeholderTextColor={colors.neutral[400]}
                multiline
                blurOnSubmit
                returnKeyType="done"
              />

              {/* Actions */}
              <View style={styles.formActions}>
                {editingEntryId && (
                  <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name={editingEntryId ? 'checkmark' : 'add'} size={18} color={colors.white} />
                      <Text style={styles.saveButtonText}>
                        {editingEntryId ? 'Update' : 'Add Entry'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </AnimatedCard>

            {/* Entries List */}
            <AnimatedCard variant="elevated" style={styles.entriesCard}>
              <View style={styles.entriesHeader}>
                <Text style={styles.entriesTitle}>Entries for {formatDateLabel(selectedDate)}</Text>
                <View style={styles.entriesCountBadge}>
                  <Text style={styles.entriesCountText}>{entries.length}</Text>
                </View>
              </View>

              {entries.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="bag-outline" size={36} color={colors.neutral[300]} />
                  <Text style={styles.emptyText}>No purchase entries for this date.</Text>
                </View>
              ) : (
                entries.map((entry, index) => renderEntryItem(entry, index))
              )}
            </AnimatedCard>

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
              >
                <Ionicons name="close" size={22} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>

            <View style={styles.addMaterialRow}>
              <TextInput
                style={styles.addMaterialInput}
                placeholder="New material name (e.g. LL, LD)"
                placeholderTextColor={colors.neutral[400]}
                value={newMaterialName}
                onChangeText={setNewMaterialName}
                returnKeyType="done"
                onSubmitEditing={handleAddMaterial}
              />
              <TouchableOpacity style={styles.addMaterialButton} onPress={handleAddMaterial}>
                <Ionicons name="add" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>

            {allMaterials.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Ionicons name="cube-outline" size={40} color={colors.neutral[300]} />
                <Text style={styles.modalEmptyText}>No materials yet. Add one above.</Text>
              </View>
            ) : (
              <ScrollView style={styles.materialList} showsVerticalScrollIndicator={false}>
                {allMaterials.map((material) => (
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
                        />
                        <View style={styles.materialActions}>
                          <TouchableOpacity style={styles.saveTag} onPress={handleSaveMaterialName}>
                            <Ionicons name="checkmark" size={14} color={colors.success[600]} />
                            <Text style={styles.saveTagText}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.cancelTag}
                            onPress={() => { setEditingMaterialId(null); setEditingMaterialName(''); }}
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
                            <View style={styles.disabledMaterialBadge}>
                              <Text style={styles.disabledMaterialBadgeText}>Disabled</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.materialActions}>
                          <TouchableOpacity style={styles.editTag} onPress={() => startEditingMaterial(material)}>
                            <Ionicons name="pencil" size={13} color={colors.primary[700]} />
                            <Text style={styles.editTagText}>Rename</Text>
                          </TouchableOpacity>
                          {material.is_active && (
                            <TouchableOpacity style={styles.disableTag} onPress={() => handleDisableMaterial(material)}>
                              <Text style={styles.disableTagText}>Disable</Text>
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
  listContent: { paddingTop: spacingSizes.lg, gap: spacingSizes.sm },
  dateNavigator: { marginBottom: spacingSizes.sm },
  loadingContainer: { marginTop: spacingSizes.huge, alignItems: 'center', gap: spacingSizes.sm },
  loadingText: { color: colors.neutral[500], fontSize: textSizes.medium },

  // Form
  formCard: {
    borderRadius: radii.lg, padding: spacingSizes.lg,
    backgroundColor: colors.white, ...shadows.medium,
  },
  formTitle: { fontSize: textSizes.large, fontWeight: '700', color: colors.text.primary, marginBottom: spacingSizes.md },
  fieldLabel: {
    fontSize: textSizes.small, fontWeight: '600', color: colors.neutral[600],
    marginBottom: spacingSizes.xs, marginTop: spacingSizes.md, marginLeft: 2,
  },
  materialChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacingSizes.sm, marginBottom: spacingSizes.xs },
  chip: {
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm + 2,
    borderRadius: radii.pill, backgroundColor: colors.neutral[100],
    borderWidth: 1.5, borderColor: colors.neutral[200],
  },
  chipActive: { backgroundColor: colors.primary[600], borderColor: colors.primary[600] },
  chipText: { fontSize: textSizes.small, fontWeight: '600', color: colors.neutral[600] },
  chipTextActive: { color: colors.white },
  input: {
    backgroundColor: colors.neutral[50], borderRadius: radii.md, paddingHorizontal: spacingSizes.md,
    height: 48, borderWidth: 1.5, borderColor: colors.neutral[200],
    fontSize: textSizes.medium, color: colors.text.primary,
  },
  notesInput: { height: 72, textAlignVertical: 'top', paddingTop: spacingSizes.sm },
  formActions: { flexDirection: 'row', gap: spacingSizes.sm, marginTop: spacingSizes.lg },
  cancelButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: spacingSizes.md, borderRadius: radii.md,
    backgroundColor: colors.neutral[100], borderWidth: 1.5, borderColor: colors.neutral[200],
  },
  cancelButtonText: { fontWeight: '700', fontSize: textSizes.medium, color: colors.neutral[600] },
  saveButton: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacingSizes.xs, paddingVertical: spacingSizes.md, borderRadius: radii.md,
    backgroundColor: colors.primary[600], minHeight: 52,
  },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: textSizes.medium },
  buttonDisabled: { opacity: 0.6 },

  // Entries list
  entriesCard: {
    borderRadius: radii.lg, padding: 0, marginTop: spacingSizes.lg,
    backgroundColor: colors.white, ...shadows.medium, overflow: 'hidden',
  },
  entriesHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacingSizes.lg, paddingBottom: spacingSizes.md,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  entriesTitle: { fontSize: textSizes.medium, fontWeight: '700', color: colors.text.primary },
  entriesCountBadge: {
    backgroundColor: colors.primary[100], paddingHorizontal: spacingSizes.sm,
    paddingVertical: 3, borderRadius: 8,
  },
  entriesCountText: { fontSize: textSizes.tiny, fontWeight: '700', color: colors.primary[700] },
  emptyContainer: { alignItems: 'center', paddingVertical: spacingSizes.xl, gap: spacingSizes.sm },
  emptyText: { fontSize: textSizes.medium, color: colors.neutral[400] },

  // Entry row
  entryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacingSizes.md, paddingHorizontal: spacingSizes.lg,
    borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  entryRowAlt: { backgroundColor: colors.neutral[50] },
  entryInfo: { flex: 1 },
  entryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  materialDot: { width: 10, height: 10, borderRadius: 5 },
  entryMaterial: { fontSize: textSizes.medium, fontWeight: '600', color: colors.text.primary },
  entryQty: { fontSize: textSizes.medium, fontWeight: '700', color: colors.primary[700], marginLeft: 'auto' },
  entryMeta: { fontSize: textSizes.small, color: colors.neutral[500], marginTop: 2, marginLeft: spacingSizes.lg + 2 },
  entryTime: { fontSize: textSizes.tiny, color: colors.neutral[400], marginTop: 2, marginLeft: spacingSizes.lg + 2 },
  entryActions: { flexDirection: 'row', gap: spacingSizes.sm, marginLeft: spacingSizes.md },
  editBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.primary[50],
    alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.error[50],
    alignItems: 'center', justifyContent: 'center',
  },
  bottomSpacer: { height: 120 },

  // Header manage button
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  manageButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: radii.md, backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  manageButtonText: { color: colors.white, fontWeight: '600', fontSize: textSizes.small },

  // Modal styles
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
    width: 36, height: 36, borderRadius: radii.lg,
    backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center',
  },
  addMaterialRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacingSizes.lg, gap: spacingSizes.sm },
  addMaterialInput: {
    flex: 1, backgroundColor: colors.neutral[50], borderRadius: radii.md,
    paddingHorizontal: spacingSizes.md, height: 48,
    borderWidth: 1.5, borderColor: colors.neutral[200], fontSize: textSizes.medium,
  },
  addMaterialButton: {
    width: 48, height: 48, borderRadius: radii.md,
    backgroundColor: colors.primary[600], alignItems: 'center', justifyContent: 'center',
  },
  materialList: { marginTop: spacingSizes.sm },
  materialItem: {
    paddingVertical: spacingSizes.md, borderBottomWidth: 1, borderBottomColor: colors.neutral[100],
  },
  materialInfoBlock: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm, marginBottom: spacingSizes.sm },
  materialItemName: { fontSize: textSizes.medium, fontWeight: '600', color: colors.text.primary },
  disabledMaterialBadge: {
    backgroundColor: colors.neutral[100], paddingHorizontal: spacingSizes.sm,
    paddingVertical: 2, borderRadius: 6,
  },
  disabledMaterialBadgeText: { fontSize: textSizes.tiny, color: colors.neutral[500], fontWeight: '600' },
  materialActions: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  editTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.primary[50], minHeight: 36,
  },
  editTagText: { color: colors.primary[700], fontWeight: '600', fontSize: textSizes.small },
  disableTag: {
    paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.sm,
    borderRadius: 10, backgroundColor: colors.error[50], minHeight: 36, justifyContent: 'center',
  },
  disableTagText: { color: colors.error[600], fontWeight: '600', fontSize: textSizes.small },
  editMaterialInput: {
    backgroundColor: colors.neutral[50], borderRadius: radii.md, padding: spacingSizes.md,
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
