import React from 'react';
import { View, StyleSheet } from 'react-native';
import { spacingSizes } from '../theme/responsive';
import Chip from './Chip';

/**
 * A wrapping row of selectable Chips. Deliberately never a horizontal
 * ScrollView — all options stay visible on every device.
 */
export default function FilterPills({ options, selectedKey, onSelect, tone = 'primary', style }) {
  return (
    <View style={[styles.row, style]}>
      {options.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          icon={option.icon}
          tone={tone}
          selected={option.key === selectedKey}
          onPress={() => onSelect(option.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
  },
});
