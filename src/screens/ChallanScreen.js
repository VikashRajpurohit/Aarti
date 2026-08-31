//Professional Challan Details Screen
import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, Animated, Switch, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useChallan } from "../context/ChallanContext";
import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { spacingSizes, textSizes, iconSizes } from "../theme/responsive";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import AnimatedCard from "../components/AnimatedCard";
import AnimatedButton from "../components/AnimatedButton";
import ResponsiveText from "../components/ResponsiveText";
import GradientBackground from "../components/GradientBackground";
import { CHALLAN_STATUS } from "../models/Challan";
import { format } from "date-fns";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useTabGroup } from "../components/TabGroupScreen";

export default function ChallanScreen({ refreshSignal }) {
  const { navigateToTab } = useTabGroup();
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const { activeChallan, updateProductDeductions, toggleNetWeightRequired, refreshChallans } = useChallan();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [deductions, setDeductions] = useState({});

  useRefreshOnFocus(() => {
    refreshChallans();
  }, [refreshChallans], 'challans', refreshSignal);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (activeChallan?.productDeductions) {
      const formattedDeductions = {};
      Object.entries(activeChallan.productDeductions).forEach(([key, value]) => {
        formattedDeductions[key] = value.toString();
      });
      setDeductions(formattedDeductions);
    } else {
      setDeductions({});
    }
  }, [activeChallan?.id, activeChallan?.productDeductions]);

  const handleToggleNetWeight = async (enabled) => {
    try {
      await toggleNetWeightRequired(activeChallan.id, !enabled);
      if (!enabled) setDeductions({});
    } catch (error) {
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleDeductionChange = (productName, text) => {
    // Allow only numbers and decimal point
    const cleanedText = text.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = cleanedText.split('.');
    const finalText = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleanedText;
    
    setDeductions(prev => ({ ...prev, [productName]: finalText }));
  };

  const handleDeductionSave = async (productName) => {
    try {
      const numericDeductions = {};
      Object.entries(deductions).forEach(([key, value]) => {
        const num = parseFloat(value);
        if (!isNaN(num) && num >= 0) {
          numericDeductions[key] = num;
        }
      });
      await updateProductDeductions(activeChallan.id, numericDeductions);
    } catch (error) {
      Alert.alert('Error', 'Failed to save deduction');
    }
  };

  if (!activeChallan) {
    return (
      <GradientBackground style={styles.container}>
        <View style={styles.emptyContainer}>
          <AnimatedCard variant="elevated" style={styles.emptyCard}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="receipt-outline" size={48} color={colors.primary[400]} />
            </View>
            <ResponsiveText size="large" weight="bold" color={colors.text.primary}>No Active Challan</ResponsiveText>
            <ResponsiveText size="medium" color={colors.text.secondary} style={{ textAlign: 'center' }}>Select a challan to view details</ResponsiveText>
            <AnimatedButton title="Select Challan" onPress={() => navigateToTab("ChallanManagement")} variant="primary" gradient size="large" style={{ marginTop: spacingSizes.md }} />
          </AnimatedCard>
        </View>
      </GradientBackground>
    );
  }

  const groupedItems = {};
  activeChallan.items.forEach((item) => {
    if (!groupedItems[item.itemName]) groupedItems[item.itemName] = { name: item.itemName, count: 0, totalWeight: 0, items: [] };
    groupedItems[item.itemName].count++;
    groupedItems[item.itemName].totalWeight += item.weight;
    groupedItems[item.itemName].items.push(item);
  });
  const groups = Object.values(groupedItems);

  return (
    <GradientBackground style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: scrollBottomPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        style={[styles.scrollView, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Card */}
        <AnimatedCard variant="elevated" style={styles.headerCard}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <ResponsiveText size="small" color={colors.text.tertiary} weight="semibold">CHALLAN</ResponsiveText>
              <ResponsiveText size="xlarge" weight="bold" color={colors.text.primary} numberOfLines={2}>{activeChallan.name}</ResponsiveText>
            </View>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary[600]} />
              <ResponsiveText size="small" color={colors.primary[600]} weight="semibold">{format(activeChallan.date, "dd MMM")}</ResponsiveText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <ResponsiveText size="small" color={colors.text.secondary}>Total Boxes</ResponsiveText>
              <ResponsiveText size="xxlarge" weight="bold" color={colors.primary[600]}>{activeChallan.totalBoxes}</ResponsiveText>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
              <ResponsiveText size="small" color={colors.text.secondary}>Total Weight</ResponsiveText>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <ResponsiveText size="xxlarge" weight="bold" color={colors.success[600]}>{activeChallan.totalGrossWeight.toFixed(2)}</ResponsiveText>
                <ResponsiveText size="small" color={colors.text.tertiary}>kg</ResponsiveText>
              </View>
            </View>
          </View>
        </AnimatedCard>

        {/* Net Weight Toggle */}
        {activeChallan.status === CHALLAN_STATUS.IN_PROGRESS && (
          <AnimatedCard variant="elevated" style={styles.settingCard} delay={100}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <ResponsiveText size="medium" weight="semibold" color={colors.text.primary}>Net Weight Calculation</ResponsiveText>
                <ResponsiveText size="small" color={colors.text.secondary}>Enable to set deductions per product</ResponsiveText>
              </View>
              <Switch
                value={!activeChallan.noNetWeightRequired}
                onValueChange={handleToggleNetWeight}
                trackColor={{ false: colors.neutral[300], true: colors.primary[400] }}
                thumbColor={!activeChallan.noNetWeightRequired ? colors.primary[600] : colors.neutral[100]}
                ios_backgroundColor={colors.neutral[300]}
              />
            </View>
          </AnimatedCard>
        )}

        {/* Deductions Section */}
        {!activeChallan.noNetWeightRequired && activeChallan.status === CHALLAN_STATUS.IN_PROGRESS && groups.length > 0 && (
          <AnimatedCard variant="elevated" style={styles.deductionsCard} delay={150}>
            <ResponsiveText size="medium" weight="bold" color={colors.text.primary} style={{ marginBottom: spacingSizes.sm }}>Deductions (kg per box)</ResponsiveText>
            
            {groups.map((group, index) => (
              <View key={group.name} style={[styles.deductionRow, index > 0 && styles.deductionRowBorder]}>
                <View style={styles.deductionInfo}>
                  <ResponsiveText size="medium" weight="semibold" color={colors.text.primary}>{group.name}</ResponsiveText>
                  <ResponsiveText size="small" color={colors.text.tertiary}>{group.count} boxes</ResponsiveText>
                </View>
                <View style={styles.deductionInputWrapper}>
                  <TextInput
                    style={styles.deductionInput}
                    placeholder="0.00"
                    placeholderTextColor={colors.text.disabled}
                    keyboardType="decimal-pad"
                    value={deductions[group.name] || ''}
                    onChangeText={(text) => handleDeductionChange(group.name, text)}
                    onEndEditing={() => handleDeductionSave(group.name)}
                    selectTextOnFocus
                    returnKeyType="done"
                  />
                  <ResponsiveText size="small" color={colors.text.tertiary}>kg</ResponsiveText>
                </View>
              </View>
            ))}
          </AnimatedCard>
        )}

        {/* Item Breakdown */}
        <View style={styles.sectionHeader}>
          <ResponsiveText size="large" weight="bold" color={colors.text.primary}>Item Breakdown</ResponsiveText>
          <View style={styles.groupCountBadge}>
            <ResponsiveText size="small" weight="semibold" color={colors.primary[600]}>{groups.length} Groups</ResponsiveText>
          </View>
        </View>

        {groups.length === 0 ? (
          <AnimatedCard variant="outlined" style={styles.noItemsCard} delay={200}>
            <Ionicons name="cube-outline" size={36} color={colors.neutral[300]} />
            <ResponsiveText size="medium" color={colors.text.secondary}>No items scanned yet</ResponsiveText>
          </AnimatedCard>
        ) : (
          groups.map((group, index) => (
            <AnimatedCard key={group.name} variant="elevated" style={styles.groupCard} delay={200 + index * 50}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleContainer}>
                  <View style={styles.groupIcon}>
                    <Ionicons name="layers" size={18} color={colors.primary[600]} />
                  </View>
                  <ResponsiveText size="medium" weight="bold" color={colors.text.primary}>{group.name}</ResponsiveText>
                </View>
                <View style={styles.groupBadge}>
                  <ResponsiveText size="small" weight="semibold" color={colors.primary[700]}>{group.count} Boxes</ResponsiveText>
                </View>
              </View>
              
              <View style={styles.groupDetails}>
                <View style={styles.groupDetailItem}>
                  <ResponsiveText size="small" color={colors.text.secondary}>Gross</ResponsiveText>
                  <ResponsiveText size="large" weight="bold" color={colors.text.primary}>{group.totalWeight.toFixed(2)} kg</ResponsiveText>
                </View>
                
                {!activeChallan.noNetWeightRequired && (
                  <>
                    <View style={styles.groupDetailItem}>
                      <ResponsiveText size="small" color={colors.text.secondary}>Deduction</ResponsiveText>
                      <ResponsiveText size="medium" weight="semibold" color={colors.warning[600]}>
                        -{((activeChallan.productDeductions[group.name] || 0) * group.count).toFixed(2)} kg
                      </ResponsiveText>
                    </View>
                    <View style={styles.groupDetailItem}>
                      <ResponsiveText size="small" color={colors.text.secondary}>Net</ResponsiveText>
                      <ResponsiveText size="large" weight="bold" color={colors.success[600]}>
                        {activeChallan.getProductNetWeight(group.name).toFixed(2)} kg
                      </ResponsiveText>
                    </View>
                  </>
                )}
              </View>
            </AnimatedCard>
          ))
        )}

      </Animated.ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingTop: spacingSizes.md,
    gap: spacingSizes.md,
  },
  emptyContainer: { flex: 1, justifyContent: "center", padding: spacingSizes.lg },
  emptyCard: { alignItems: "center", gap: spacingSizes.md, padding: spacingSizes.xxl },
  emptyIconContainer: { width: 80, height: 80, borderRadius: radii.pill, backgroundColor: colors.primary[50], justifyContent: "center", alignItems: "center", marginBottom: spacingSizes.sm },
  headerCard: {},
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacingSizes.md },
  dateBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.primary[50], paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.xs, borderRadius: radii.sm },
  divider: { height: 1, backgroundColor: colors.border.light, marginVertical: spacingSizes.lg },
  statsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  statItem: { alignItems: "center", gap: 4 },
  verticalDivider: { width: 1, height: 50, backgroundColor: colors.border.light },
  settingCard: {},
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacingSizes.md },
  toggleInfo: { flex: 1, gap: 2 },
  deductionsCard: {},
  deductionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacingSizes.md },
  deductionRowBorder: { borderTopWidth: 1, borderTopColor: colors.border.light },
  deductionInfo: { flex: 1, gap: 2 },
  deductionInputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacingSizes.xs, 
    backgroundColor: colors.neutral[50], 
    borderWidth: 1, 
    borderColor: colors.border.default, 
    borderRadius: radii.sm, 
    paddingHorizontal: spacingSizes.md, 
    paddingVertical: spacingSizes.sm,
    minWidth: 100,
  },
  deductionInput: { 
    flex: 1, 
    fontSize: textSizes.regular, 
    color: colors.text.primary, 
    textAlign: 'right', 
    fontWeight: '600',
    minWidth: 50,
    padding: 0,
  },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacingSizes.sm, paddingHorizontal: spacingSizes.xs },
  groupCountBadge: { backgroundColor: colors.primary[50], paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.xs, borderRadius: radii.sm },
  noItemsCard: { alignItems: "center", padding: spacingSizes.xl, gap: spacingSizes.md },
  groupCard: { marginBottom: spacingSizes.xs },
  groupHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacingSizes.md },
  groupTitleContainer: { flexDirection: "row", alignItems: "center", gap: spacingSizes.sm },
  groupIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: colors.primary[50], justifyContent: "center", alignItems: "center" },
  groupBadge: { backgroundColor: colors.primary[50], paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.xs, borderRadius: radii.sm },
  groupDetails: { flexDirection: "row", backgroundColor: colors.neutral[50], borderRadius: radii.md, padding: spacingSizes.md, gap: spacingSizes.sm },
  groupDetailItem: { flex: 1, gap: 4, alignItems: 'center' },
});
