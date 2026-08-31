import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import GradientBackground from '../components/GradientBackground';
import AnimatedCard from '../components/AnimatedCard';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, textSizes, iconSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { logService } from '../services/logService';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

const EVENT_LABELS = {
  cut: { label: 'Power Cut', color: colors.error[500], icon: 'flash-off' },
  in: { label: 'Power In', color: colors.success[600], icon: 'flash' },
};

const STATUS_SEQUENCE_ERROR = 'This event was already recorded last. Please record the opposite event.';

const formatValue = (value) => (value ? value : '—');

export default function PowerScreen({ refreshSignal }) {
  const { user } = useAuth();
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const [events, setEvents] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eventDate, setEventDate] = useState(new Date());
  // Whether the operator explicitly picked a date/time. If not, we record "now"
  // at submit time rather than the (possibly hours-old) time the screen opened.
  const [dateManuallySet, setDateManuallySet] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());

  const openAndroidDateTimePicker = useCallback(() => {
    const now = new Date();
    DateTimePickerAndroid.open({
      value: eventDate,
      mode: 'date',
      maximumDate: now,
      onChange: (event, selectedDate) => {
        if (event.type === 'dismissed') return;
        const baseDate = selectedDate || eventDate;
        DateTimePickerAndroid.open({
          value: baseDate,
          mode: 'time',
          is24Hour: true,
          onChange: (timeEvent, selectedTime) => {
            if (timeEvent.type === 'dismissed') return;
            const time = selectedTime || baseDate;
            const finalDate = new Date(baseDate);
            finalDate.setHours(time.getHours());
            finalDate.setMinutes(time.getMinutes());
            finalDate.setSeconds(0);
            finalDate.setMilliseconds(0);
            if (finalDate > now) {
              Alert.alert('Validation', 'Future date/time is not allowed. Please select a past time.');
              setEventDate(now);
              setDateManuallySet(true);
              return;
            }
            setEventDate(finalDate);
            setDateManuallySet(true);
          },
        });
      },
    });
  }, [eventDate]);

  const latestEvent = events[0];

  const loadProfiles = useCallback(async (ids) => {
    if (!ids.length) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', ids);
    if (!error && data) {
      const map = {};
      data.forEach((profile) => {
        map[profile.id] = profile;
      });
      setProfilesById(map);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('power_events')
      .select('*')
      .order('occurred_at', { ascending: false })
      .limit(200);

    if (error) {
      Alert.alert('Error', error.message || 'Failed to load power events.');
      setLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setEvents(list);
    const actorIds = [...new Set(list.map((item) => item.created_by).filter(Boolean))];
    await loadProfiles(actorIds);
    setLoading(false);
  }, [loadProfiles]);

  useRefreshOnFocus(loadEvents, [loadEvents], 'power', refreshSignal);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  const canSubmitType = useCallback((type) => {
    if (!latestEvent) {
      return type === 'cut';
    }
    if (type === 'in') {
      return latestEvent.event_type === 'cut';
    }
    return latestEvent.event_type !== type;
  }, [latestEvent]);

  const handleSubmit = async (eventType) => {
    if (!canSubmitType(eventType)) {
      Alert.alert('Validation', STATUS_SEQUENCE_ERROR);
      return;
    }

    const now = new Date();
    // Default to "now" unless the operator explicitly picked a time.
    const effectiveDate = dateManuallySet ? eventDate : now;
    if (effectiveDate > now) {
      Alert.alert('Validation', 'Power events must be recorded in the past.');
      return;
    }

    if (latestEvent?.occurred_at) {
      const latestTime = new Date(latestEvent.occurred_at);
      if (effectiveDate < latestTime) {
        Alert.alert('Validation', 'Event time cannot be before the last recorded event.');
        return;
      }
    }

    if (eventType === 'in' && latestEvent?.event_type !== 'cut') {
      Alert.alert('Validation', 'Please record a power cut before recording power in.');
      return;
    }

    const trimmedNotes = notes.trim();
    if (trimmedNotes.length > 500) {
      Alert.alert('Validation', 'Notes should be within 500 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        event_type: eventType,
        occurred_at: effectiveDate.toISOString(),
        notes: trimmedNotes || null,
        created_by: user?.id || null,
      };

      const { data, error } = await supabase
        .from('power_events')
        .insert(payload)
        .select('*')
        .single();

      if (error) throw error;

      setEvents((prev) => [data, ...prev]);
      setNotes('');
      setEventDate(new Date());
      setDateManuallySet(false);

      await logService.logEvent({
        action: eventType === 'cut' ? 'power.cut' : 'power.in',
        entityType: 'power_event',
        entityId: data?.id,
        metadata: {
          event_type: eventType,
          occurred_at: payload.occurred_at,
        },
      });

      Alert.alert('Saved', 'Power event recorded successfully.');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to record power event.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item }) => {
    const meta = EVENT_LABELS[item.event_type] || { label: 'Event', color: colors.neutral[500], icon: 'alert-circle' };
    const createdLabel = item.occurred_at
      ? format(new Date(item.occurred_at), 'dd MMM yyyy • HH:mm')
      : '—';
    const actor = item.created_by ? profilesById[item.created_by] : null;
    const actorLabel = actor?.full_name
      ? `${actor.full_name}${actor.role ? ` (${actor.role.replace('_', ' ')})` : ''}`
      : item.created_by
        ? `User ${item.created_by.slice(0, 8)}`
        : 'System';

    return (
      <AnimatedCard variant="elevated" style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.eventIcon, { backgroundColor: meta.color + '20' }]}>
              <Ionicons name={meta.icon} size={iconSizes.sm} color={meta.color} />
            </View>
            <View>
              <Text style={styles.eventTitle}>{meta.label}</Text>
              <Text style={styles.createdAt}>{createdLabel}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: meta.color }]}>
            <Text style={styles.statusText}>{meta.label}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Recorded By</Text>
          <Text style={styles.detailValue}>{actorLabel}</Text>
        </View>
        <View style={styles.detailRowColumn}>
          <Text style={styles.detailLabel}>Notes</Text>
          <Text style={styles.notesText}>{formatValue(item.notes)}</Text>
        </View>
      </AnimatedCard>
    );
  };

  const summary = useMemo(() => {
    const totalCuts = events.filter((event) => event.event_type === 'cut').length;
    const totalIns = events.filter((event) => event.event_type === 'in').length;
    return { totalCuts, totalIns };
  }, [events]);

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Power Log"
        icon="flash"
      />

      <View style={[styles.formWrap, { paddingHorizontal: horizontalPadding }]}>
        <View
          style={[
            styles.formCard,
            { maxWidth: contentMaxWidth - horizontalPadding * 2, width: '100%' },
          ]}
        >
        <Text style={styles.formTitle}>Record event</Text>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => {
            if (Platform.OS === 'android') {
              openAndroidDateTimePicker();
              return;
            }
            setTempDate(eventDate);
            setPickerVisible(true);
          }}
        >
          <Ionicons name="calendar-outline" size={iconSizes.sm} color={colors.primary[600]} />
          <Text style={styles.datePickerText}>{format(eventDate, 'dd MMM yyyy • HH:mm')}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Add optional notes (reason, duration, etc.)"
          placeholderTextColor={colors.neutral[400]}
          multiline
        />
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.primaryButton, !canSubmitType('cut') && styles.buttonDisabled]}
            onPress={() => handleSubmit('cut')}
            disabled={submitting || !canSubmitType('cut')}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Power Cut</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, !canSubmitType('in') && styles.buttonDisabled]}
            onPress={() => handleSubmit('in')}
            disabled={submitting || !canSubmitType('in')}
          >
            {submitting ? (
              <ActivityIndicator color={colors.primary[600]} />
            ) : (
              <Text style={styles.secondaryButtonText}>Power In</Text>
            )}
          </TouchableOpacity>
        </View>
        {!canSubmitType('cut') || !canSubmitType('in') ? (
          <Text style={styles.validationText}>{STATUS_SEQUENCE_ERROR}</Text>
        ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading events...</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingHorizontal: horizontalPadding,
              paddingBottom: scrollBottomPadding,
              maxWidth: contentMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<EmptyState icon="flash-outline" title="No power events recorded yet." />}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select date & time</Text>
              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                maximumDate={new Date()}
                onChange={(event, selected) => {
                  const picked = selected || tempDate;
                  if (picked > new Date()) {
                    setTempDate(new Date());
                    return;
                  }
                  setTempDate(picked);
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={() => setPickerVisible(false)}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={() => {
                    setEventDate(tempDate);
                    setDateManuallySet(true);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formWrap: {
    alignItems: 'center',
  },
  formCard: {
    marginVertical: spacingSizes.lg,
    padding: spacingSizes.md,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.neutral[100],
  },
  formTitle: {
    fontSize: textSizes.small,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacingSizes.sm,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    paddingVertical: spacingSizes.xs,
    paddingHorizontal: spacingSizes.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    marginBottom: spacingSizes.sm,
  },
  datePickerText: {
    fontSize: textSizes.small,
    color: colors.text.primary,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 80,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    padding: spacingSizes.sm,
    fontSize: textSizes.small,
    color: colors.text.primary,
    backgroundColor: colors.neutral[50],
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: spacingSizes.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.error[500],
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: spacingSizes.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  secondaryButtonText: {
    color: colors.primary[600],
    fontWeight: '600',
  },
  validationText: {
    marginTop: spacingSizes.sm,
    fontSize: textSizes.tiny,
    color: colors.neutral[500],
  },
  listContent: {
    paddingHorizontal: spacingSizes.lg,
    paddingBottom: spacingSizes.xl,
  },
  card: {
    padding: spacingSizes.md,
    marginBottom: spacingSizes.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    gap: spacingSizes.sm,
    alignItems: 'center',
  },
  eventIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: textSizes.small,
    fontWeight: '700',
    color: colors.text.primary,
  },
  createdAt: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.tiny,
    color: colors.neutral[500],
  },
  statusPill: {
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: radii.pill,
  },
  statusText: {
    color: colors.white,
    fontSize: textSizes.tiny,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacingSizes.sm,
  },
  detailRowColumn: {
    marginTop: spacingSizes.sm,
  },
  detailLabel: {
    fontSize: textSizes.tiny,
    color: colors.neutral[500],
    fontWeight: '600',
  },
  detailValue: {
    fontSize: textSizes.small,
    color: colors.text.primary,
    fontWeight: '600',
  },
  notesText: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacingSizes.sm,
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  emptyState: {
    marginTop: spacingSizes.xl,
    alignItems: 'center',
    gap: spacingSizes.sm,
  },
  emptyText: {
    fontSize: textSizes.small,
    color: colors.neutral[500],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacingSizes.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    padding: spacingSizes.lg,
  },
  modalTitle: {
    fontSize: textSizes.medium,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacingSizes.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
  },
  modalButton: {
    paddingHorizontal: spacingSizes.md,
    paddingVertical: spacingSizes.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.neutral[100],
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary[600],
  },
  modalButtonText: {
    fontSize: textSizes.small,
    color: colors.neutral[700],
    fontWeight: '600',
  },
  modalButtonTextPrimary: {
    color: colors.white,
  },
});
