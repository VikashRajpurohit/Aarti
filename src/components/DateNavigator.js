import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacingSizes, textSizes, shadows } from '../theme/responsive';

let Haptics = null;
try {
  Haptics = require('expo-haptics');
} catch (_) {}

const triggerHaptic = () => {
  try {
    Haptics?.impactAsync?.(Haptics.ImpactFeedbackStyle?.Light);
  } catch (_) {}
};

/**
 * DateNavigator — reusable date navigation bar.
 *
 * Props:
 *  selectedDate  string  'YYYY-MM-DD'
 *  todayString   string  'YYYY-MM-DD'
 *  onPrev        fn      called when user taps ‹
 *  onNext        fn      called when user taps ›
 *  onSelectDate  fn      called when user taps "Select Date" (optional)
 *  formatLabel   fn      (dateString) => display string
 *  canGoNext     bool    whether the next button is enabled
 */
export default function DateNavigator({
  selectedDate,
  todayString,
  onPrev,
  onNext,
  onSelectDate,
  formatLabel,
  canGoNext = true,
  style,
}) {
  const displayLabel = formatLabel ? formatLabel(selectedDate) : selectedDate;

  const handlePrev = () => {
    triggerHaptic();
    onPrev?.();
  };

  const handleNext = () => {
    if (!canGoNext) return;
    triggerHaptic();
    onNext?.();
  };

  const handleSelectDate = () => {
    triggerHaptic();
    onSelectDate?.();
  };

  return (
    <View style={[styles.container, style]}>
      {/* Prev button */}
      <TouchableOpacity
        style={styles.navButton}
        onPress={handlePrev}
        accessibilityLabel="Previous day"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={20} color={colors.primary[600]} />
      </TouchableOpacity>

      {/* Date display */}
      <View style={styles.dateInfo}>
        <Text style={styles.dateLabel}>Selected date</Text>
        <Text style={styles.dateValue}>{displayLabel}</Text>
      </View>

      {/* Select Date button */}
      {onSelectDate && (
        <TouchableOpacity
          style={styles.selectButton}
          onPress={handleSelectDate}
          accessibilityLabel="Select date"
          accessibilityRole="button"
        >
          <Ionicons
            name="calendar-outline"
            size={14}
            color={colors.primary[600]}
          />
          <Text style={styles.selectText}>
            Select Date
          </Text>
        </TouchableOpacity>
      )}

      {/* Next button */}
      <TouchableOpacity
        style={[styles.navButton, !canGoNext && styles.navButtonDisabled]}
        onPress={handleNext}
        disabled={!canGoNext}
        accessibilityLabel="Next day"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name="chevron-forward"
          size={20}
          color={canGoNext ? colors.primary[600] : colors.neutral[300]}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: spacingSizes.md,
    paddingHorizontal: spacingSizes.md,
    ...shadows.small,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    backgroundColor: colors.neutral[100],
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dateLabel: {
    fontSize: textSizes.tiny,
    color: colors.neutral[400],
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateValue: {
    marginTop: 2,
    fontSize: textSizes.regular,
    fontWeight: '700',
    color: colors.text.primary,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
    marginRight: spacingSizes.sm,
    gap: 3,
  },
  selectText: {
    fontSize: textSizes.tiny,
    fontWeight: '700',
    color: colors.primary[600],
  },
});
