import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, AccessibilityInfo } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, sizes, shadows } from '../theme/responsive';
import { SUB_TAB_META, GROUP_KEYS } from '../config/roleTabs';
import { useNav, getSubTab } from '../context/NavContext';

const haptic = () => {
  try {
    Haptics.selectionAsync();
  } catch (_) {}
};

// Custom bottom navigation bar.
//
// Two states share one fixed-height bar:
//  - Browse: every visible group as an icon+label button (the default).
//  - Focus:  a multi-sub-tab group is open — the *other* groups are hidden and
//            the active group's sub-tabs take the bar as a segmented control
//            (sliding indicator). The active group sits on the left as a pill
//            with a chevron; tapping it collapses back to Browse.
//
// The bar keeps `position: absolute` so it floats over screen content exactly
// like the old React Navigation tab bar did — every screen still self-pads with
// `useResponsiveLayout().scrollBottomPadding`, so no screen layout changes.
export default function BottomNav({ state, navigation, groups = [], pendingInquiries = 0 }) {
  const insets = useSafeAreaInsets();
  const { expanded, setExpanded, toggleExpanded, subTabByGroup, setSubTab } = useNav();
  const reduceMotion = useReduceMotion();

  const groupByKey = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.key, g])),
    [groups]
  );

  const activeGroupKey = state.routes[state.index]?.name;
  const activeGroup = groupByKey[activeGroupKey];
  const activeSubTabs = activeGroup?.subTabs || [];
  const isMulti = activeSubTabs.length > 1;
  const focusMode = expanded && isMulti;
  const activeSubTab = getSubTab(subTabByGroup, activeGroupKey, activeSubTabs);

  // Never linger in focus mode on a group that can't be focused (e.g. after a
  // role change collapses its sub-tabs, or a jump to a single-sub-tab group).
  useEffect(() => {
    if (expanded && !isMulti) setExpanded(false);
  }, [expanded, isMulti, setExpanded]);

  const selectGroup = (groupKey) => {
    haptic();
    const target = groupByKey[groupKey];
    const targetMulti = (target?.subTabs?.length || 0) > 1;
    if (groupKey === activeGroupKey) {
      // Tapping the active group toggles its sub-tabs open/closed.
      if (targetMulti) toggleExpanded();
      return;
    }
    navigation.navigate(groupKey);
    setExpanded(targetMulti); // auto-focus groups that have sub-tabs
  };

  const selectSubTab = (tabKey) => {
    haptic();
    setSubTab(activeGroupKey, tabKey);
  };

  const bottomPad = Math.max(insets.bottom, spacingSizes.sm);

  const badgeFor = (groupKey) =>
    groupKey === GROUP_KEYS.INQUIRIES ? pendingInquiries : 0;

  return (
    <View
      style={[
        styles.wrap,
        { height: sizes.tabBarBase + bottomPad, paddingBottom: bottomPad },
      ]}
    >
      {focusMode ? (
        <Animated.View
          key="focus"
          style={styles.row}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
        >
          <GroupPill group={activeGroup} onPress={() => selectGroup(activeGroupKey)} />
          <SubTabTrack
            subTabs={activeSubTabs}
            activeKey={activeSubTab}
            onSelect={selectSubTab}
            reduceMotion={reduceMotion}
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="browse"
          style={styles.row}
          entering={reduceMotion ? undefined : FadeIn.duration(150)}
        >
          {groups.map((g) => (
            <GroupButton
              key={g.key}
              group={g}
              active={g.key === activeGroupKey}
              badgeCount={badgeFor(g.key)}
              onPress={() => selectGroup(g.key)}
            />
          ))}
        </Animated.View>
      )}
    </View>
  );
}

// A full group button (Browse state): icon (+ gradient pill when active) + label.
function GroupButton({ group, active, badgeCount = 0, onPress }) {
  if (!group) return null;
  const iconName = active ? group.icon : group.iconOutline;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.groupSlot}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={group.label}
    >
      {active ? (
        <LinearGradient
          colors={[colors.primary[50], colors.primary[100]]}
          style={styles.activeIconPill}
        >
          <Ionicons name={iconName} size={22} color={colors.primary[600]} />
        </LinearGradient>
      ) : (
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={22} color={colors.neutral[400]} />
        </View>
      )}
      <Text numberOfLines={1} style={[styles.groupLabel, active && styles.groupLabelActive]}>
        {group.label}
      </Text>
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// The active group shown as a pill with a chevron (Focus state). Tapping it
// collapses the sub-tabs and returns to the all-groups Browse row.
function GroupPill({ group, onPress }) {
  if (!group) return null;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${group.label} — collapse sub-tabs`}
    >
      <LinearGradient
        colors={[colors.primary[50], colors.primary[100]]}
        style={styles.groupPill}
      >
        <Ionicons name={group.icon} size={22} color={colors.primary[600]} />
        <Ionicons name="chevron-down" size={13} color={colors.primary[600]} />
      </LinearGradient>
    </TouchableOpacity>
  );
}

// The active group's sub-tabs as a segmented control with a spring-driven
// sliding indicator — the same "feel" as the old top segment bar, now in the
// bottom bar.
function SubTabTrack({ subTabs, activeKey, onSelect, reduceMotion }) {
  const [trackW, setTrackW] = useState(0);
  const n = subTabs.length;
  const chipW = trackW > 0 ? (trackW - PAD * 2) / n : 0;
  const index = Math.max(0, subTabs.indexOf(activeKey));
  const x = useSharedValue(0);

  useEffect(() => {
    const target = PAD + index * chipW;
    if (chipW <= 0) return;
    x.value = reduceMotion
      ? withTiming(target, { duration: 0 })
      : withSpring(target, { damping: 18, stiffness: 190, mass: 0.7 });
  }, [index, chipW, reduceMotion, x]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
    width: chipW,
  }));

  return (
    <View
      style={styles.track}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
    >
      {chipW > 0 ? <Animated.View style={[styles.indicator, indicatorStyle]} /> : null}
      {subTabs.map((tabKey) => {
        const meta = SUB_TAB_META[tabKey] || { label: tabKey, icon: 'ellipse-outline' };
        const active = tabKey === activeKey;
        return (
          <TouchableOpacity
            key={tabKey}
            style={styles.stab}
            onPress={() => onSelect(tabKey)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={meta.label}
          >
            <Ionicons name={meta.icon} size={18} color={active ? colors.white : colors.neutral[500]} />
            <Text numberOfLines={1} style={[styles.stabLabel, active && styles.stabLabelActive]}>
              {meta.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Track the OS "reduce motion" setting so we can drop the animations for users
// who ask for it.
function useReduceMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(!!v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

const PAD = 4; // segmented-track inner padding (indicator/chip math)
const CONTROL_H = 46; // pill + track height (fits inside tabBarBase)

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    paddingTop: spacingSizes.sm,
    paddingHorizontal: spacingSizes.sm,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    ...shadows.medium,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Browse
  groupSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  iconWrap: {
    width: 40,
    height: 30,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIconPill: {
    width: 40,
    height: 30,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupLabel: {
    marginTop: 2,
    fontSize: textSizes.tiny,
    fontWeight: '600',
    color: colors.neutral[400],
  },
  groupLabelActive: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -1,
    left: '50%',
    marginLeft: 4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: colors.error[500],
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: textSizes.tiny,
    fontWeight: '700',
    color: colors.white,
  },

  // Focus — active group pill
  groupPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: CONTROL_H,
    paddingHorizontal: spacingSizes.sm + 2,
    borderRadius: radii.lg,
  },

  // Focus — segmented sub-tab track
  track: {
    flex: 1,
    height: CONTROL_H,
    marginLeft: spacingSizes.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[100],
    borderRadius: radii.lg,
    padding: PAD,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    borderRadius: radii.md,
    backgroundColor: colors.primary[600],
  },
  stab: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 2,
  },
  stabLabel: {
    fontSize: textSizes.tiny,
    fontWeight: '600',
    color: colors.neutral[500],
  },
  stabLabelActive: {
    color: colors.white,
    fontWeight: '700',
  },
});
