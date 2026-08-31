import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import { getTodayIST, toDateOnlyString, fromDateOnlyString, addDaysToDateOnly } from '../utils/dateOnly';
import { formatDateLabel } from '../utils/reportDates';
import ResponsiveText from './ResponsiveText';
import AppModal from './AppModal';
import FilterPills from './FilterPills';
import AnimatedButton from './AnimatedButton';

const MAX_RANGE_DAYS = 90;

/**
 * Compact date-range control: a single bar showing the active range that opens
 * a sheet with preset pills, a single-day picker, and a from–to custom range.
 * Never a horizontal scroll. Commits ranges via the caller's preset encoding:
 * presets by key, `CUSTOM_DATE:YYYY-MM-DD`, `CUSTOM_RANGE:from:to`.
 */
export default function DateRangeSelector({
  options,
  selectedKey,
  displayLabel,
  onSelect,
  allowCustomRange = true,
  style,
}) {
  const [open, setOpen] = useState(false);
  // Which field the iOS spinner is editing: null | 'single' | 'from' | 'to'
  const [pickerTarget, setPickerTarget] = useState(null);
  const [tempDate, setTempDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState(null);
  const [customTo, setCustomTo] = useState(null);

  const todayStr = getTodayIST();
  const todayDate = () => {
    try {
      return fromDateOnlyString(todayStr);
    } catch {
      return new Date();
    }
  };

  const clampToToday = (date) => (date > todayDate() ? todayDate() : date);

  const commitSingle = (dateStr) => {
    onSelect(`CUSTOM_DATE:${dateStr}`);
    setOpen(false);
  };

  const applyCustomRange = (fromStr, toStr) => {
    if (!fromStr || !toStr) {
      Alert.alert('Select dates', 'Pick both a From and a To date.');
      return;
    }
    let [start, end] = fromStr <= toStr ? [fromStr, toStr] : [toStr, fromStr];
    const maxStart = addDaysToDateOnly(end, -(MAX_RANGE_DAYS - 1));
    if (start < maxStart) {
      start = maxStart;
      Alert.alert('Range limited', `Ranges are limited to ${MAX_RANGE_DAYS} days. Starting from ${formatDateLabel(start, true)}.`);
    }
    onSelect(`CUSTOM_RANGE:${start}:${end}`);
    setOpen(false);
  };

  const openPicker = (target) => {
    const current =
      target === 'from' && customFrom ? fromDateOnlyString(customFrom)
      : target === 'to' && customTo ? fromDateOnlyString(customTo)
      : todayDate();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: current,
        mode: 'date',
        maximumDate: todayDate(),
        onChange: (event, picked) => {
          if (event.type !== 'set' || !picked) return;
          const str = toDateOnlyString(clampToToday(picked));
          if (target === 'single') commitSingle(str);
          else if (target === 'from') setCustomFrom(str);
          else setCustomTo(str);
        },
      });
    } else {
      setTempDate(current);
      setPickerTarget(target);
    }
  };

  const confirmIosPicker = () => {
    const str = toDateOnlyString(clampToToday(tempDate));
    if (pickerTarget === 'single') commitSingle(str);
    else if (pickerTarget === 'from') setCustomFrom(str);
    else if (pickerTarget === 'to') setCustomTo(str);
    setPickerTarget(null);
  };

  const isCustomRange = selectedKey?.startsWith('CUSTOM_RANGE:');
  const isCustomDate = selectedKey?.startsWith('CUSTOM_DATE:');

  const handleOpen = () => {
    // Pre-fill the custom fields from the active selection so re-opening edits it
    if (isCustomRange) {
      const [, a, b] = selectedKey.split(':');
      setCustomFrom(a);
      setCustomTo(b);
    } else if (isCustomDate) {
      const d = selectedKey.split(':')[1];
      setCustomFrom(d);
      setCustomTo(d);
    }
    setOpen(true);
  };

  const pillOptions = options.map((o) => ({ key: o.key, label: o.label, icon: o.icon }));

  return (
    <>
      <TouchableOpacity
        style={[styles.bar, style]}
        onPress={handleOpen}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Change date range"
      >
        <Ionicons name="calendar-outline" size={iconSizes.md} color={colors.primary[600]} />
        <ResponsiveText size="medium" weight="semibold" style={styles.barLabel} numberOfLines={1}>
          {displayLabel}
        </ResponsiveText>
        <Ionicons name="chevron-down" size={iconSizes.sm} color={colors.neutral[400]} />
      </TouchableOpacity>

      <AppModal visible={open} onClose={() => setOpen(false)} title="Date range">
        {pickerTarget && Platform.OS === 'ios' ? (
          <View>
            <ResponsiveText size="small" weight="semibold" color={colors.text.secondary}>
              {pickerTarget === 'single' ? 'Pick a date' : pickerTarget === 'from' ? 'From date' : 'To date'}
            </ResponsiveText>
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="spinner"
              maximumDate={todayDate()}
              onChange={(event, picked) => {
                if (picked) setTempDate(clampToToday(picked));
              }}
            />
            <View style={styles.pickerActions}>
              <AnimatedButton title="Cancel" variant="ghost" size="small" onPress={() => setPickerTarget(null)} />
              <AnimatedButton title="Done" size="small" onPress={confirmIosPicker} />
            </View>
          </View>
        ) : (
          <View>
            <FilterPills
              options={pillOptions}
              selectedKey={selectedKey}
              onSelect={(key) => {
                onSelect(key);
                setOpen(false);
              }}
            />

            <TouchableOpacity style={styles.singleDayRow} onPress={() => openPicker('single')} activeOpacity={0.7}>
              <Ionicons name="calendar-number-outline" size={iconSizes.md} color={colors.primary[600]} />
              <ResponsiveText size="medium" weight="semibold" color={colors.primary[700]} style={styles.singleDayText}>
                {isCustomDate ? formatDateLabel(selectedKey.split(':')[1], true) : 'Pick a single day'}
              </ResponsiveText>
              {isCustomDate ? <Ionicons name="checkmark-circle" size={iconSizes.md} color={colors.primary[600]} /> : null}
            </TouchableOpacity>

            {allowCustomRange ? (
              <View style={styles.customSection}>
                <ResponsiveText size="small" weight="semibold" color={colors.text.secondary}>
                  Custom range
                </ResponsiveText>
                <View style={styles.rangeFieldsRow}>
                  <TouchableOpacity style={styles.rangeField} onPress={() => openPicker('from')} activeOpacity={0.7}>
                    <ResponsiveText size="tiny" color={colors.text.tertiary}>FROM</ResponsiveText>
                    <ResponsiveText size="medium" weight="semibold" numberOfLines={1}>
                      {customFrom ? formatDateLabel(customFrom, true) : 'Select'}
                    </ResponsiveText>
                  </TouchableOpacity>
                  <Ionicons name="arrow-forward" size={iconSizes.sm} color={colors.neutral[400]} />
                  <TouchableOpacity style={styles.rangeField} onPress={() => openPicker('to')} activeOpacity={0.7}>
                    <ResponsiveText size="tiny" color={colors.text.tertiary}>TO</ResponsiveText>
                    <ResponsiveText size="medium" weight="semibold" numberOfLines={1}>
                      {customTo ? formatDateLabel(customTo, true) : 'Select'}
                    </ResponsiveText>
                  </TouchableOpacity>
                </View>
                <AnimatedButton
                  title="Apply range"
                  size="small"
                  onPress={() => applyCustomRange(customFrom, customTo)}
                  style={styles.applyButton}
                />
              </View>
            ) : null}
          </View>
        )}
      </AppModal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.sm + 2,
  },
  barLabel: {
    flex: 1,
  },
  singleDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
    padding: spacingSizes.md,
    borderRadius: radii.md,
    backgroundColor: colors.primary[50],
  },
  singleDayText: {
    flex: 1,
  },
  customSection: {
    marginTop: spacingSizes.lg,
    paddingTop: spacingSizes.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
    gap: spacingSizes.sm,
  },
  rangeFieldsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
  },
  rangeField: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border.light,
    borderRadius: radii.md,
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.sm,
    backgroundColor: colors.white,
  },
  applyButton: {
    marginTop: spacingSizes.xs,
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.sm,
  },
});
