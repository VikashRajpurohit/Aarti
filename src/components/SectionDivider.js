import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacingSizes, textSizes } from '../theme/responsive';

/**
 * SectionDivider — a thin labeled divider for separating sections within cards.
 *
 * Props:
 *  label   string   section label text
 *  right   node     optional right-side element
 */
export default function SectionDivider({ label, right, style }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacingSizes.lg,
    marginBottom: spacingSizes.sm,
  },
  label: {
    fontSize: textSizes.tiny,
    fontWeight: '700',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginRight: spacingSizes.sm,
    flexShrink: 0,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.neutral[100],
  },
  right: {
    marginLeft: spacingSizes.sm,
  },
});
