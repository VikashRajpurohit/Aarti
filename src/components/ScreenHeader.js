import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { useTabGroup } from './TabGroupScreen';
import ResponsiveText from './ResponsiveText';

/**
 * The one screen header used by every screen. Grouped screens (under the
 * segment bar) get no top inset — the segment bar already consumed it;
 * standalone screens (single-sub-tab groups, Login-level screens) pad for the
 * status bar themselves and flip its icons to light while focused.
 *
 * Props:
 * - title, subtitle
 * - icon: Ionicons name shown in a translucent badge
 * - right: node rendered at the row end (actions)
 * - chips: [{ label, value }] compact stat chips under the title row
 */
export default function ScreenHeader({ title, subtitle, icon, right, chips, style }) {
  const { hasSegmentBar } = useTabGroup();
  const { insets, isLandscape, horizontalPadding, contentMaxWidth } = useResponsiveLayout();
  const isFocused = useIsFocused();

  const topInset = hasSegmentBar ? 0 : insets.top;
  const verticalPad = isLandscape ? spacingSizes.xs : spacingSizes.sm;

  return (
    <LinearGradient
      colors={colors.gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          paddingTop: topInset + verticalPad,
          paddingBottom: verticalPad,
          paddingHorizontal: horizontalPadding,
        },
        style,
      ]}
    >
      {!hasSegmentBar && isFocused ? <StatusBar style="light" /> : null}
      <View style={[styles.inner, { maxWidth: contentMaxWidth }]}>
        <View style={styles.titleRow}>
          {icon ? (
            <View style={styles.iconBadge}>
              <Ionicons name={icon} size={iconSizes.md} color={colors.white} />
            </View>
          ) : null}
          <View style={styles.titleBlock}>
            <ResponsiveText size="large" weight="bold" color={colors.white} numberOfLines={1}>
              {title}
            </ResponsiveText>
            {subtitle ? (
              <ResponsiveText size="small" color="rgba(255,255,255,0.8)" numberOfLines={1}>
                {subtitle}
              </ResponsiveText>
            ) : null}
          </View>
          {right ? <View style={styles.right}>{right}</View> : null}
        </View>
        {chips && chips.length > 0 ? (
          <View style={styles.chipsRow}>
            {chips.map((chip) => (
              <View key={chip.label} style={styles.chip}>
                <ResponsiveText size="medium" weight="bold" color={colors.white} numberOfLines={1}>
                  {chip.value}
                </ResponsiveText>
                <ResponsiveText size="tiny" color="rgba(255,255,255,0.75)" numberOfLines={1}>
                  {chip.label}
                </ResponsiveText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacingSizes.md,
  },
  titleBlock: {
    flex: 1,
  },
  right: {
    marginLeft: spacingSizes.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.sm,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radii.sm,
    paddingVertical: spacingSizes.xs,
    paddingHorizontal: spacingSizes.md,
    minWidth: 84,
  },
});
