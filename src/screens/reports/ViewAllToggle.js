import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacingSizes, iconSizes } from '../../theme/responsive';
import ResponsiveText from '../../components/ResponsiveText';

/**
 * The one "see more" control for daily-breakdown tables — expands/collapses
 * rows inline (no modal). Use as a ReportCard `headerRight`.
 */
export default function ViewAllToggle({ expanded, count, onToggle }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onToggle} activeOpacity={0.7} accessibilityRole="button">
      <ResponsiveText size="small" weight="semibold" color={colors.primary[600]}>
        {expanded ? 'Show less' : `Show all ${count}`}
      </ResponsiveText>
      <Ionicons
        name={expanded ? 'chevron-up' : 'chevron-forward'}
        size={iconSizes.xs}
        color={colors.primary[600]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
