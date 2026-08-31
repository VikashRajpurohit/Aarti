//Professional Scanner Screen - Clean Modern UI
import React, { useState, useRef, useEffect, useMemo } from "react";
import { View, StyleSheet, FlatList, Animated, Alert, AppState, Easing, TouchableOpacity, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useChallan } from "../context/ChallanContext";
import { useIsFocused } from "@react-navigation/native";
import { parseQRData } from "../utils/qrParser";
import { incrementQRScanCount } from "../services/analyticsService";
import { suggestionService } from "../services/suggestionService";
import { colors } from "../theme/colors";
import { radii } from "../theme/radii";
import { responsive, spacingSizes, iconSizes, shadows } from "../theme/responsive";
import { useResponsiveLayout } from "../hooks/useResponsiveLayout";
import AnimatedCard from "../components/AnimatedCard";
import AnimatedButton from "../components/AnimatedButton";
import ResponsiveText from "../components/ResponsiveText";
import GradientBackground from "../components/GradientBackground";
import ManualEntryModal from "../components/ManualEntryModal";
import { CHALLAN_STATUS } from "../models/Challan";
import { LinearGradient } from "expo-linear-gradient";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { useTabGroup } from "../components/TabGroupScreen";

export default function ScannerScreen({ refreshSignal }) {
  const { navigateToTab } = useTabGroup();
  const { isLandscape, tabBarHeight } = useResponsiveLayout();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  // Camera lifecycle: bottom tabs never unmount their screens, so without
  // gating, the camera keeps running after switching tabs (and in background).
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => sub.remove();
  }, []);
  const { 
    activeChallan, 
    checkItemExists,
    addItemToActiveChallan, 
    removeItemFromActiveChallan, 
    clearActiveChallanItems,
    updateItemPieces,
    refreshChallans,
  } = useChallan();
  
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const successFlashAnim = useRef(new Animated.Value(0)).current;
  const removeFlashAnim = useRef(new Animated.Value(0)).current;
  const listSlideAnim = useRef(new Animated.Value(50)).current;
  const itemAnims = useRef({}).current;
  const scanLockRef = useRef(false);
  const lastScanRef = useRef({ data: null, ts: 0 });
  // Users naturally hold the phone on the box for a second or two after a
  // successful scan. With a short window the same QR is re-read and triggers the
  // destructive "Remove Box?" prompt. Keep the same code suppressed longer so an
  // intentional remove requires the code to leave and re-enter the frame.
  const DEDUPE_WINDOW_MS = 3000;

  const hasPermission = permission?.granted;
  const cameraActive = !!hasPermission && isFocused && appState === 'active';
  const items = activeChallan?.items || [];
  // Newest-first for display. Memoized so unrelated re-renders (animations, etc.)
  // don't re-allocate the array; only recomputes when the items array changes.
  const reversedItems = useMemo(() => [...items].reverse(), [items]);
  const scannerSize = Math.min(responsive.wp(70), 280);

  useEffect(() => {
    Animated.timing(listSlideAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!cameraActive) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cameraActive]);

  useRefreshOnFocus(() => {
    refreshChallans();
  }, [refreshChallans], 'challans', refreshSignal);

  const triggerSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(successFlashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(successFlashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const triggerRemoveAnimation = () => {
    Animated.sequence([
      Animated.timing(removeFlashAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      Animated.timing(removeFlashAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanLockRef.current) return;
    if (manualEntryVisible) return;

    const now = Date.now();
    if (lastScanRef.current.data === data && now - lastScanRef.current.ts < DEDUPE_WINDOW_MS) {
      return;
    }
    lastScanRef.current = { data, ts: now };

    const item = parseQRData(data);
    
    if (item) {
      if (!activeChallan) {
        scanLockRef.current = true;
        Alert.alert("No Active Challan", "Please create or select a challan first", [
          { text: "Create", onPress: () => { navigateToTab("ChallanManagement"); scanLockRef.current = false; }},
          { text: "OK", style: "cancel", onPress: () => { scanLockRef.current = false; } },
        ]);
        return;
      }
      
      if (activeChallan.status === CHALLAN_STATUS.DEPARTED) {
        scanLockRef.current = true;
        Alert.alert("Challan Departed", "Cannot modify a departed challan.", [
          { text: "OK", onPress: () => { scanLockRef.current = false; } }
        ]);
        return;
      }

      // Check if item already exists — synchronous local lookup keeps the scan
      // handler off the microtask queue. activeChallan is guaranteed here.
      const existingItem = activeChallan.items.find((i) => i.boxNo === item.boxNo) || null;

      if (existingItem) {
        // Item exists - show confirmation to remove
        scanLockRef.current = true;
        Alert.alert(
          "Remove Box?",
          `Box #${item.boxNo} is already scanned.\n\nAre you sure you want to remove it from the challan?`,
          [
            { 
              text: "Cancel", 
              style: "cancel", 
              onPress: () => { scanLockRef.current = false; }
            },
            { 
              text: "Remove", 
              style: "destructive", 
              onPress: () => {
                triggerRemoveAnimation();
                void removeItemFromActiveChallan(item.boxNo);
                scanLockRef.current = false;
              }
            },
          ],
          { cancelable: false }
        );
      } else {
        // New item - add it
        triggerSuccessAnimation();
        void addItemToActiveChallan(item);
        void suggestionService.addSuggestionsFromItem(item);
        incrementQRScanCount();
      }
    } else {
      scanLockRef.current = true;
      Alert.alert(
        "QR Not Scanned", 
        "Something went wrong. Unable to parse QR code.", 
        [
          { text: "Cancel", style: "cancel", onPress: () => { scanLockRef.current = false; } },
          { text: "Add Manually", onPress: () => { setManualEntryVisible(true); scanLockRef.current = false; }},
        ]
      );
    }
  };

  const animateItemRemoval = (boxNo, callback) => {
    if (!itemAnims[boxNo]) itemAnims[boxNo] = new Animated.Value(1);
    Animated.timing(itemAnims[boxNo], { toValue: 0, duration: 250, useNativeDriver: true }).start(() => { 
      callback(); 
      delete itemAnims[boxNo]; 
    });
  };

  const handleManualSubmit = async (item) => {
    try {
      triggerSuccessAnimation();
      void addItemToActiveChallan(item);
      void suggestionService.addSuggestionsFromItem(item);
      incrementQRScanCount();
    } catch (error) {
      console.error('Error adding manual entry:', error);
      Alert.alert('Error', 'Failed to add item');
    }
  };

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, scannerSize - 4] });

  if (!permission) {
    return (
      <GradientBackground style={styles.loadingContainer}>
        <AnimatedCard style={styles.loadingCard} variant="elevated">
          <Ionicons name="camera" size={56} color={colors.primary[500]} />
          <ResponsiveText size="large" weight="semibold" color={colors.text.primary}>Requesting Camera...</ResponsiveText>
        </AnimatedCard>
      </GradientBackground>
    );
  }

  if (!hasPermission) {
    return (
      <GradientBackground style={styles.container}>
        <View style={styles.permissionContainer}>
          <AnimatedCard variant="elevated" style={styles.permissionCard}>
            <View style={styles.permissionIconBg}>
              <Ionicons name="camera-outline" size={40} color={colors.primary[600]} />
            </View>
            <ResponsiveText size="xlarge" weight="bold" color={colors.text.primary}>Camera Access Required</ResponsiveText>
            <ResponsiveText size="regular" color={colors.text.secondary} style={{ textAlign: 'center' }}>Grant camera permission to scan QR codes</ResponsiveText>
            <AnimatedButton title="Grant Permission" onPress={requestPermission} size="large" variant="primary" gradient icon={<Ionicons name="camera" size={20} color={colors.white} />} />
          </AnimatedCard>
        </View>
      </GradientBackground>
    );
  }

  const canModifyItems = activeChallan?.status === CHALLAN_STATUS.IN_PROGRESS;

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      <View style={[styles.cameraSection, isLandscape && styles.cameraSectionLandscape]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          active={cameraActive}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={cameraActive ? handleBarCodeScanned : undefined}
        >
          <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'transparent', 'rgba(0,0,0,0.2)']} style={StyleSheet.absoluteFill} />
          
          {/* Success Flash (Green) */}
          <Animated.View style={[styles.successFlash, { opacity: successFlashAnim }]} pointerEvents="none" />
          
          {/* Remove Flash (Red) */}
          <Animated.View style={[styles.removeFlash, { opacity: removeFlashAnim }]} pointerEvents="none" />
          
          <View style={styles.overlay}>
            <View style={styles.scannerFrameContainer}>
              <View style={styles.scannerFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
                <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
              </View>
            </View>
          </View>
        </CameraView>
      </View>

      <Animated.View
        style={[
          styles.listSection,
          isLandscape && styles.listSectionLandscape,
          { transform: [{ translateY: listSlideAnim }], paddingBottom: tabBarHeight },
        ]}
      >
        <View style={styles.listHeader}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleBlock}>
              <ResponsiveText size="large" weight="bold" color={colors.text.primary}>Scanner</ResponsiveText>
              {activeChallan ? (
                <ResponsiveText size="small" color={colors.text.secondary} numberOfLines={1}>{activeChallan.name}</ResponsiveText>
              ) : null}
            </View>
            <View style={styles.headerActions}>
              {canModifyItems && activeChallan && (
                <TouchableOpacity
                  style={styles.manualButton}
                  onPress={() => setManualEntryVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={16} color={colors.primary[600]} />
                  <ResponsiveText size="small" weight="semibold" color={colors.primary[600]}>Manual</ResponsiveText>
                </TouchableOpacity>
              )}
              <View style={styles.countBadge}>
                <ResponsiveText size="small" weight="semibold" color={colors.primary[600]}>{items.length}</ResponsiveText>
              </View>
            </View>
          </View>
        </View>

        {!activeChallan ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="qr-code-outline" size={48} color={colors.neutral[300]} />
            <ResponsiveText size="medium" weight="semibold" color={colors.text.secondary}>No Active Challan</ResponsiveText>
            <AnimatedButton title="Select Challan" onPress={() => navigateToTab("ChallanManagement")} variant="primary" gradient size="medium" />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="layers-outline" size={48} color={colors.neutral[300]} />
            <ResponsiveText size="medium" weight="semibold" color={colors.text.secondary}>No Items Scanned</ResponsiveText>
            <ResponsiveText size="small" color={colors.text.tertiary}>Point camera at QR code</ResponsiveText>
          </View>
        ) : (
          <FlatList
            data={reversedItems}
            keyExtractor={(item) => String(item.boxNo)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.itemsList, { paddingBottom: spacingSizes.md }]}
            removeClippedSubviews
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={9}
            renderItem={({ item }) => {
              const animValue = itemAnims[item.boxNo] || new Animated.Value(1);
              if (!itemAnims[item.boxNo]) {
                itemAnims[item.boxNo] = animValue;
                animValue.setValue(0);
                Animated.spring(animValue, { toValue: 1, tension: 100, friction: 10, useNativeDriver: true }).start();
              }
              return (
                <Animated.View style={[styles.itemCardContainer, { transform: [{ scale: animValue }], opacity: animValue }]}>
                  <View style={styles.itemCard}>
                    <View style={styles.itemIcon}>
                      <Ionicons name="cube" size={20} color={colors.primary[600]} />
                    </View>
                    <View style={styles.itemContent}>
                      <ResponsiveText size="medium" weight="bold" color={colors.text.primary}>{item.itemName}</ResponsiveText>
                      <View style={styles.itemMeta}>
                        <ResponsiveText size="small" color={colors.text.secondary}>Box #{item.boxNo}</ResponsiveText>
                        <View style={styles.dot} />
                        <ResponsiveText size="small" weight="semibold" color={colors.success[600]}>{item.weight} kg</ResponsiveText>
                      </View>
                    </View>
                    {/* Pieces Input */}
                    <View style={styles.piecesContainer}>
                      <ResponsiveText size="tiny" color={colors.text.tertiary} style={styles.piecesLabel}>Pcs</ResponsiveText>
                      <TextInput
                        style={styles.piecesInput}
                        defaultValue={String(item.pieces || 0)}
                        keyboardType="number-pad"
                        maxLength={5}
                        editable={canModifyItems}
                        onEndEditing={(e) => {
                          const newPieces = parseInt(e.nativeEvent.text, 10) || 0;
                          if (newPieces !== (item.pieces || 0)) {
                            updateItemPieces(item.boxNo, newPieces);
                          }
                        }}
                        selectTextOnFocus
                      />
                    </View>
                    {canModifyItems && (
                      <AnimatedButton 
                        onPress={() => Alert.alert(
                          "Remove Box?", 
                          `Are you sure you want to remove Box #${item.boxNo}?`, 
                          [
                            { text: "Cancel", style: "cancel" }, 
                            { text: "Remove", style: "destructive", onPress: () => animateItemRemoval(item.boxNo, () => removeItemFromActiveChallan(item.boxNo)) }
                          ]
                        )} 
                        variant="ghost" 
                        size="small" 
                        icon={<Ionicons name="close-circle" size={24} color={colors.neutral[400]} />} 
                      />
                    )}
                  </View>
                </Animated.View>
              );
            }}
          />
        )}

        {canModifyItems && items.length > 0 && (
          <View style={styles.footerActions}>
            <AnimatedButton 
              title="Clear All" 
              onPress={() => Alert.alert("Clear All", "Remove all items from this challan?", [
                { text: "Cancel", style: "cancel" }, 
                { text: "Clear All", style: "destructive", onPress: clearActiveChallanItems }
              ])} 
              variant="danger" 
              size="medium" 
              icon={<Ionicons name="trash-outline" size={18} color={colors.white} />} 
              style={{ width: "100%" }} 
            />
          </View>
        )}
      </Animated.View>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        visible={manualEntryVisible}
        onClose={() => setManualEntryVisible(false)}
        onSubmit={handleManualSubmit}
        checkItemExists={checkItemExists}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  containerLandscape: { flexDirection: "row" },
  cameraSection: {
    flex: 1,
    width: "100%",
    position: "relative",
    minHeight: 200,
    maxHeight: responsive.hp(55),
  },
  cameraSectionLandscape: {
    width: undefined,
    minHeight: undefined,
    maxHeight: undefined,
  },
  successFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.success[400] },
  removeFlash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.danger[400] },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    paddingVertical: spacingSizes.md,
  },
  scannerFrameContainer: {
    flex: 1,
    alignItems: "center", 
    justifyContent: "center",
    paddingVertical: spacingSizes.md,
  },
  scannerFrame: { 
    position: "relative",
    width: Math.min(responsive.wp(70), 280),
    height: Math.min(responsive.wp(70), 280),
  },
  corner: { position: "absolute", width: 28, height: 28, borderColor: colors.white, borderWidth: 3 },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 16 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 16 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 16 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 16 },
  scanLine: { position: "absolute", left: 8, right: 8, height: 2, backgroundColor: colors.primary[400], borderRadius: 1 },
  listSection: {
    flex: 1.2,
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    marginTop: -24,
    paddingTop: spacingSizes.sm,
    ...shadows.large
  },
  listSectionLandscape: {
    marginTop: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: radii.xxl,
  },
  listHeader: { paddingHorizontal: spacingSizes.lg, paddingTop: spacingSizes.xs, paddingBottom: spacingSizes.md, borderBottomWidth: 1, borderBottomColor: colors.border.light },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitleBlock: { flex: 1, marginRight: spacingSizes.sm },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacingSizes.sm },
  manualButton: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 4, 
    backgroundColor: colors.primary[50], 
    paddingHorizontal: spacingSizes.md, 
    paddingVertical: spacingSizes.xs, 
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.primary[100]
  },
  countBadge: { backgroundColor: colors.primary[50], paddingHorizontal: spacingSizes.md, paddingVertical: spacingSizes.xs, borderRadius: radii.sm },
  itemsList: { padding: spacingSizes.md, gap: spacingSizes.sm },
  itemCardContainer: { marginBottom: spacingSizes.xs },
  itemCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.white, padding: spacingSizes.md, borderRadius: radii.md, ...shadows.small },
  itemIcon: { width: 42, height: 42, borderRadius: radii.md, backgroundColor: colors.primary[50], justifyContent: "center", alignItems: "center", marginRight: spacingSizes.md },
  itemContent: { flex: 1, gap: 2 },
  itemMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  piecesContainer: { alignItems: "center", marginRight: spacingSizes.xs },
  piecesLabel: { marginBottom: 2 },
  piecesInput: { width: 56, height: 32, borderWidth: 1, borderColor: colors.border.medium, borderRadius: radii.xs, textAlign: "center", fontSize: 14, fontWeight: "600", color: colors.text.primary, backgroundColor: colors.neutral[50], paddingHorizontal: 4 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.neutral[300] },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: spacingSizes.md, paddingBottom: spacingSizes.xxl },
  footerActions: { padding: spacingSizes.md, paddingBottom: spacingSizes.lg, borderTopWidth: 1, borderTopColor: colors.border.light, backgroundColor: colors.white },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: spacingSizes.xl },
  loadingCard: { alignItems: "center", gap: spacingSizes.lg, padding: spacingSizes.xxl, width: "85%" },
  permissionContainer: { flex: 1, justifyContent: "center", padding: spacingSizes.xl },
  permissionCard: { alignItems: "center", gap: spacingSizes.lg, padding: spacingSizes.xxl },
  permissionIconBg: { width: 80, height: 80, borderRadius: radii.pill, backgroundColor: colors.primary[50], justifyContent: "center", alignItems: "center", marginBottom: spacingSizes.sm },
});
