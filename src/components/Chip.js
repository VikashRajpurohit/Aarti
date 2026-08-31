import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes, sizes } from '../theme/responsive';
import ResponsiveText from './ResponsiveText';

const TONES = {
  primary: { bg: colors.primary[600], fg: colors.white, idleFg: colors.text.secondary },
  success: { bg: colors.success[600], fg: colors.white, idleFg: colors.text.secondary },
  danger: { bg: colors.danger[600], fg: colors.white, idleFg: colors.text.secondary },
  warning: { bg: colors.warning[500], fg: colors.white, idleFg: colors.text.secondary },
};

export default function Chip({ label, icon, selected = false, onPress, tone = 'primary', style }) {
  const toneColors = TONES[tone] || TONES.primary;
  const fg = selected ? toneColors.fg : toneColors.idleFg;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        selected ? { backgroundColor: toneColors.bg, borderColor: toneColors.bg } : null,
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={iconSizes.xs} color={fg} /> : null}
      <ResponsiveText size="small" weight={selected ? 'bold' : 'medium'} color={fg} numberOfLines={1}>
        {label}
      </ResponsiveText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    height: sizes.chipHeight,
    paddingHorizontal: spacingSizes.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
  },
});
