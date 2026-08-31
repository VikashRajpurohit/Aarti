import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacingSizes, iconSizes, shadows } from '../../theme/responsive';
import ResponsiveText from '../../components/ResponsiveText';

/**
 * The single accent tile used by every Reports summary grid (production,
 * sales, materials). Flat white surface + a colored top accent — replaces the
 * old divergent `metricTile` / `salesStatTile` styles. Size it via the parent
 * grid (pass flexBasis/width in `style`).
 */
export default function MetricTile({ icon, label, value, sub, color = colors.primary[500], style }) {
  return (
    <View style={[styles.tile, { borderTopColor: color }, style]}>
      {icon ? (
        <View style={[styles.iconBadge, { backgroundColor: color + '18' }]}>
          <Ionicons name={icon} size={iconSizes.sm} color={color} />
        </View>
      ) : null}
      <ResponsiveText size="xlarge" weight="heavy" numberOfLines={1} style={styles.value}>
        {value}
      </ResponsiveText>
      <ResponsiveText size="small" weight="semibold" color={colors.text.secondary} numberOfLines={1}>
        {label}
      </ResponsiveText>
      {sub ? (
        <ResponsiveText size="tiny" color={colors.text.tertiary} numberOfLines={1}>
          {sub}
        </ResponsiveText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderTopWidth: 3,
    padding: spacingSizes.md,
    ...shadows.small,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacingSizes.sm,
  },
  value: {
    marginBottom: 2,
  },
});
