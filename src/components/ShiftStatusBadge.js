import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacingSizes, textSizes } from '../theme/responsive';

/**
 * ShiftStatusBadge — shows shift status as a colored pill.
 *
 * Props:
 *  entry   object|null   the shift/entry object (has .ended_at)
 */
export default function ShiftStatusBadge({ entry }) {
  let label, bgColor, icon;

  if (!entry) {
    label = 'Not Started';
    bgColor = colors.neutral[400];
    icon = 'time-outline';
  } else if (entry.ended_at) {
    label = 'Ended';
    bgColor = colors.success[500];
    icon = 'checkmark-circle';
  } else {
    label = 'In Progress';
    bgColor = colors.warning[500];
    icon = 'play-circle';
  }

  return (
    <View
      style={[styles.pill, { backgroundColor: bgColor }]}
      accessibilityLabel={`Shift status: ${label}`}
    >
      <Ionicons name={icon} size={13} color={colors.white} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: 20,
    gap: 4,
  },
  label: {
    color: colors.white,
    fontSize: textSizes.small,
    fontWeight: '700',
  },
});
