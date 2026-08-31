import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes, shadows } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';

const TONES = {
  primary: { badge: colors.primary[50], icon: colors.primary[600] },
  success: { badge: colors.success[50], icon: colors.success[600] },
  warning: { badge: colors.warning[50], icon: colors.warning[600] },
  danger: { badge: colors.danger[50], icon: colors.danger[600] },
  info: { badge: '#EFF6FF', icon: colors.info },
  neutral: { badge: colors.neutral[100], icon: colors.neutral[600] },
};

/**
 * KPI/stat tile for grid layouts (flat surface, tonal icon badge — no
 * gradients). Size via the parent grid: give it flexBasis/width from
 * useResponsiveLayout().columns rather than a fixed width.
 */
export default function StatCard({ icon, label, value, subValue, trend, tone = 'primary', style }) {
  const toneColors = TONES[tone] || TONES.primary;
  const trendUp = typeof trend === 'string' && trend.startsWith('+');
  const trendColor = trendUp ? colors.success[600] : colors.danger[600];

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        {icon ? (
          <View style={[styles.iconBadge, { backgroundColor: toneColors.badge }]}>
            <Ionicons name={icon} size={iconSizes.md} color={toneColors.icon} />
          </View>
        ) : null}
        {trend ? (
          <ResponsiveText size="tiny" weight="bold" color={trendColor}>
            {trend}
          </ResponsiveText>
        ) : null}
      </View>
      <ResponsiveText size="xlarge" weight="bold" numberOfLines={1} style={styles.value}>
        {value}
      </ResponsiveText>
      <ResponsiveText size="small" color={colors.text.secondary} numberOfLines={1}>
        {label}
      </ResponsiveText>
      {subValue ? (
        <ResponsiveText size="tiny" color={colors.text.tertiary} numberOfLines={1}>
          {subValue}
        </ResponsiveText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    padding: spacingSizes.md,
    ...shadows.small,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacingSizes.sm,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    marginBottom: 2,
  },
});
