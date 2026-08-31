//Challan Management Screen - Simplified with Challan Number
import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, ScrollView, Alert, Animated, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useChallan } from "../context/ChallanContext";
import { CHALLAN_STATUS } from "../models/Challan";
import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { spacingSizes, iconSizes } from "../theme/responsive";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import AnimatedCard from "../components/AnimatedCard";
import AnimatedButton from "../components/AnimatedButton";
import ResponsiveText from "../components/ResponsiveText";
import GradientBackground from "../components/GradientBackground";
import AppModal from "../components/AppModal";
import AppTextInput from "../components/AppTextInput";
import { format } from "date-fns";
import { exportChallanToExcel } from "../utils/excelExport";
import { exportChallanToPDF } from "../utils/pdfExport";
import { useAuth } from "../context/AuthContext";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";

export default function ChallanManagementScreen({ navigation, onSelectChallan, refreshSignal }) {
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const { challans, activeChallanId, loading, createChallan, setActiveChallan, updateChallanStatus, deleteChallan, challanNumberExists, refreshChallans } = useChallan();
  const { roles } = useAuth();
  const isAdmin = roles?.includes('admin');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [challanNumber, setChallanNumber] = useState("");
  const [inputError, setInputError] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useRefreshOnFocus(() => {
    refreshChallans();
  }, [refreshChallans], 'challans', refreshSignal);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const visibleChallans = isAdmin
    ? challans
    : challans.filter((c) => c.status !== CHALLAN_STATUS.DELETED);

  const handleChallanNumberChange = (text) => {
    // Only allow digits, max 6 characters
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, 6);
    setChallanNumber(cleaned);
    
    // Clear error when typing
    if (inputError) setInputError("");
    
    // Check for duplicates in real-time
    if (cleaned && challanNumberExists(cleaned)) {
      setInputError(`Challan #${cleaned} already exists`);
    }
  };

  const handleCreateChallan = async () => {
    if (!challanNumber.trim()) { 
      setInputError("Please enter a challan number"); 
      return; 
    }
    
    if (challanNumberExists(challanNumber)) {
      setInputError(`Challan #${challanNumber} already exists`);
      return;
    }
    
    try {
      await createChallan(challanNumber);
      setChallanNumber("");
      setInputError("");
      setShowCreateModal(false);
      Alert.alert("Success", `Challan #${challanNumber} created`);
    } catch (error) {
      setInputError(error.message || "Failed to create challan");
    }
  };

  const handleSetActive = async (challanId) => {
    try {
      await setActiveChallan(challanId);
      if (onSelectChallan) onSelectChallan();
      else if (navigation) navigation.goBack();
    } catch (error) {
      Alert.alert("Error", "Failed to set active challan");
    }
  };

  const handleMarkDeparted = async (challan) => {
    if (challan.items.length === 0) { 
      Alert.alert("Error", "Cannot mark empty challan as departed"); 
      return; 
    }
    Alert.alert("Mark as Departed", `Finalize Challan #${challan.challanNumber}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Continue", onPress: async () => {
        try {
          await updateChallanStatus(challan.id, CHALLAN_STATUS.DEPARTED);
          Alert.alert("Success", "Challan marked as departed");
        } catch (error) {
          Alert.alert("Error", "Failed to update status");
        }
      }},
    ]);
  };

  const handleGenerateExcel = async (challan) => {
    if (!challan || challan.items.length === 0) { Alert.alert("Error", "No items to export"); return; }
    try {
      await exportChallanToExcel(challan);
      Alert.alert("Success", "Excel file generated");
    } catch (error) {
      Alert.alert("Error", "Failed to generate Excel");
    }
  };

  const handleGeneratePDF = async (challan) => {
    if (!challan || challan.items.length === 0) { Alert.alert("Error", "No items to export"); return; }
    try {
      await exportChallanToPDF(challan);
      Alert.alert("Success", "PDF generated");
    } catch (error) {
      Alert.alert("Error", "Failed to generate PDF");
    }
  };

  const handleDeleteChallan = async (challan) => {
    if (challan.status !== CHALLAN_STATUS.DEPARTED) { 
      Alert.alert("Error", "Only departed challans can be deleted"); 
      return; 
    }
    Alert.alert("Delete Challan", `Delete Challan #${challan.challanNumber}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteChallan(challan.id);
          Alert.alert("Success", "Challan deleted");
        } catch (error) {
          Alert.alert("Error", "Failed to delete challan");
        }
      }},
    ]);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case CHALLAN_STATUS.IN_PROGRESS: return { bg: colors.primary[50], text: colors.primary[700], icon: "time" };
      case CHALLAN_STATUS.DEPARTED: return { bg: colors.success[50], text: colors.success[700], icon: "checkmark-circle" };
      case CHALLAN_STATUS.DELETED: return { bg: colors.error[50], text: colors.error[700], icon: "trash" };
      default: return { bg: colors.neutral[100], text: colors.neutral[700], icon: "help-circle" };
    }
  };

  return (
    <GradientBackground style={styles.container}>
      <KeyboardAvoidingView style={styles.keyboardView} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              paddingHorizontal: horizontalPadding,
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerContainer}>
            <View>
              <ResponsiveText size="xxlarge" weight="bold" color={colors.text.primary}>Challans</ResponsiveText>
              <ResponsiveText size="small" color={colors.text.secondary}>Manage your shipments</ResponsiveText>
            </View>
            <AnimatedButton title="Create" onPress={() => setShowCreateModal(true)} size="medium" variant="primary" gradient icon={<Ionicons name="add" size={18} color={colors.white} />} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}>
            {visibleChallans.length === 0 ? (
              <AnimatedCard variant="elevated" style={styles.emptyCard}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="receipt-outline" size={40} color={colors.primary[400]} />
                </View>
                <ResponsiveText size="large" weight="bold" color={colors.text.primary}>No Challans</ResponsiveText>
                <ResponsiveText size="medium" color={colors.text.secondary} style={{ textAlign: 'center' }}>Create your first challan to get started</ResponsiveText>
                <AnimatedButton title="Create Challan" onPress={() => setShowCreateModal(true)} variant="primary" gradient size="medium" />
              </AnimatedCard>
            ) : (
              visibleChallans.map((challan, index) => {
                const statusConfig = getStatusConfig(challan.status);
                const isActive = challan.id === activeChallanId;
                
                return (
                  <AnimatedCard key={challan.id} variant="elevated" style={[styles.challanCard, isActive && styles.activeChallanCard]} delay={index * 50}>
                    <View style={styles.challanHeader}>
                      <View style={styles.challanInfo}>
                        <View style={styles.challanTitleRow}>
                          <ResponsiveText size="large" weight="bold" color={colors.text.primary} numberOfLines={1} style={{ flex: 1 }}>
                            #{challan.challanNumber}
                          </ResponsiveText>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <ResponsiveText size="tiny" color={colors.white} weight="bold">ACTIVE</ResponsiveText>
                            </View>
                          )}
                        </View>
                        <ResponsiveText size="small" color={colors.text.tertiary}>
                          {format(challan.date, "dd MMM yyyy • HH:mm")}
                        </ResponsiveText>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                        <Ionicons name={statusConfig.icon} size={12} color={statusConfig.text} />
                        <ResponsiveText size="tiny" color={statusConfig.text} weight="semibold" style={{ textTransform: 'uppercase' }}>
                          {challan.status.replace("_", " ")}
                        </ResponsiveText>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.challanDetails}>
                      <View style={styles.detailItem}>
                        <ResponsiveText size="small" color={colors.text.secondary}>Boxes</ResponsiveText>
                        <ResponsiveText size="xlarge" weight="bold" color={colors.text.primary}>{challan.totalBoxes}</ResponsiveText>
                      </View>
                      <View style={styles.verticalDivider} />
                      <View style={styles.detailItem}>
                        <ResponsiveText size="small" color={colors.text.secondary}>Weight</ResponsiveText>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
                          <ResponsiveText size="xlarge" weight="bold" color={colors.success[600]}>{challan.totalGrossWeight.toFixed(1)}</ResponsiveText>
                          <ResponsiveText size="tiny" color={colors.text.tertiary}>kg</ResponsiveText>
                        </View>
                      </View>
                    </View>

                    {challan.status === CHALLAN_STATUS.DELETED ? (
                      <View style={styles.deletedBanner}>
                        <Ionicons name="alert-circle" size={16} color={colors.error[600]} />
                        <ResponsiveText size="small" color={colors.error[700]} weight="semibold">
                          This challan has been deleted
                        </ResponsiveText>
                      </View>
                    ) : (
                      <View style={styles.challanActions}>
                        {!isActive && challan.status === CHALLAN_STATUS.IN_PROGRESS && (
                          <AnimatedButton title="Set Active" onPress={() => handleSetActive(challan.id)} variant="secondary" size="small" />
                        )}
                        {challan.status === CHALLAN_STATUS.IN_PROGRESS && challan.items.length > 0 && (
                          <AnimatedButton title="Depart" onPress={() => handleMarkDeparted(challan)} variant="success" gradient size="small" icon={<Ionicons name="airplane" size={14} color={colors.white} />} />
                        )}
                        {challan.status === CHALLAN_STATUS.DEPARTED && (
                          <>
                            <AnimatedButton title="Excel" onPress={() => handleGenerateExcel(challan)} variant="primary" gradient size="small" icon={<Ionicons name="document-text" size={14} color={colors.white} />} />
                            <AnimatedButton title="PDF" onPress={() => handleGeneratePDF(challan)} variant="success" gradient size="small" icon={<Ionicons name="document-outline" size={14} color={colors.white} />} />
                            <AnimatedButton onPress={() => handleDeleteChallan(challan)} variant="danger" size="small" icon={<Ionicons name="trash-outline" size={16} color={colors.white} />} />
                          </>
                        )}
                      </View>
                    )}
                  </AnimatedCard>
                );
              })
            )}
          </ScrollView>
        </Animated.View>

        {/* Create Modal */}
        <AppModal
          visible={showCreateModal}
          onClose={() => { setShowCreateModal(false); setChallanNumber(""); setInputError(""); }}
          title="New Challan"
          footer={
            <AnimatedButton
              title="Create Challan"
              onPress={handleCreateChallan}
              loading={loading}
              variant="primary"
              gradient
              disabled={!challanNumber.trim() || !!inputError}
              style={{ flex: 1 }}
            />
          }
        >
          <AppTextInput
            label="Challan number"
            placeholder="Enter challan number (1-6 digits)"
            value={challanNumber}
            onChangeText={handleChallanNumberChange}
            keyboardType="number-pad"
            maxLength={6}
            leftIcon="receipt-outline"
            error={inputError || undefined}
            helper="Enter a unique number up to 6 digits"
            returnKeyType="done"
            onSubmitEditing={handleCreateChallan}
            autoFocus
          />
        </AppModal>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  content: { flex: 1, paddingTop: spacingSizes.md },
  headerContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacingSizes.lg, paddingHorizontal: spacingSizes.xs },
  scrollView: { flex: 1 },
  scrollContent: { gap: spacingSizes.md },
  emptyCard: { alignItems: "center", gap: spacingSizes.md, padding: spacingSizes.xxl, marginTop: spacingSizes.xl },
  emptyIconContainer: { width: 72, height: 72, borderRadius: radii.pill, backgroundColor: colors.primary[50], justifyContent: "center", alignItems: "center", marginBottom: spacingSizes.sm },
  challanCard: { padding: 0 },
  activeChallanCard: { borderWidth: 2, borderColor: colors.primary[400] },
  challanHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: spacingSizes.md },
  challanInfo: { flex: 1, minWidth: 0, gap: 4 },
  challanTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm },
  activeBadge: { backgroundColor: colors.primary[600], paddingHorizontal: spacingSizes.sm, paddingVertical: 2, borderRadius: radii.xs, marginHorizontal: 5, marginBottom: 4 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: spacingSizes.sm, paddingVertical: 4, borderRadius: radii.sm },
  divider: { height: 1, backgroundColor: colors.border.light, marginHorizontal: spacingSizes.md },
  challanDetails: { flexDirection: "row", padding: spacingSizes.md, justifyContent: "space-around", alignItems: "center" },
  detailItem: { alignItems: "center", gap: 2 },
  verticalDivider: { width: 1, height: 40, backgroundColor: colors.border.light },
  challanActions: { flexDirection: "row", gap: spacingSizes.sm, padding: spacingSizes.md, paddingTop: 0, justifyContent: "flex-end", flexWrap: 'wrap' },
  deletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    padding: spacingSizes.md,
    backgroundColor: colors.error[50],
    marginHorizontal: spacingSizes.md,
    marginBottom: spacingSizes.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.error[100],
  },
});
