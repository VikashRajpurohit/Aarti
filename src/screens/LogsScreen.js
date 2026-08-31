import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { supabase } from '../config/supabase';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import GradientBackground from '../components/GradientBackground';
import AnimatedCard from '../components/AnimatedCard';
import ResponsiveText from '../components/ResponsiveText';
import ScreenHeader from '../components/ScreenHeader';
import EmptyState from '../components/EmptyState';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

const PAGE_SIZE = 100;

const ACTION_LABELS = {
  'challan.create': 'Challan Created',
  'challan.item.add': 'Item Added',
  'challan.item.remove': 'Item Removed',
  'challan.items.clear': 'Items Cleared',
  'challan.departed': 'Challan Departed',
  'challan.deleted': 'Challan Deleted',
  'challan.status.change': 'Challan Status Changed',
  'user.create': 'User Created',
  'user.role.change': 'Role Changed',
  'user.disable': 'User Disabled',
  'user.enable': 'User Enabled',
  'user.delete': 'User Deleted',
  'user.password.change': 'Password Changed',
  'production.shift.create': 'Shift Created',
  'production.shift.update': 'Shift Updated',
  'production.shift.end': 'Shift Ended',
  'production.shift.restart': 'Shift Restarted',
  'production.material.add': 'Material Added',
  'production.material.rename': 'Material Renamed',
  'production.material.disable': 'Material Disabled',
  'production.material.enable': 'Material Enabled',
  'production_output.shift.create': 'Output Shift Created',
  'production_output.shift.update': 'Output Shift Updated',
  'production_output.shift.end': 'Output Shift Ended',
  'production_output.shift.restart': 'Output Shift Restarted',
  'production_output.product.add': 'Output Product Added',
  'production_output.product.rename': 'Output Product Renamed',
  'production_output.product.disable': 'Output Product Disabled',
  'production_output.product.enable': 'Output Product Enabled',
  'power.cut': 'Power Cut Recorded',
  'power.in': 'Power Restored',
  'inquiry.status.change': 'Inquiry Status Updated',
  'backup.create': 'Backup Downloaded',
};

const formatMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return '';
  const entries = Object.entries(metadata);
  if (entries.length === 0) return '';
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(' • ');
};

const getActionIcon = (action) => {
  if (!action) return 'time-outline';
  if (action.startsWith('challan.item.add')) return 'add-circle';
  if (action.startsWith('challan.item.remove')) return 'remove-circle';
  if (action.startsWith('challan.items.clear')) return 'trash';
  if (action.startsWith('challan.departed')) return 'send';
  if (action.startsWith('challan.deleted')) return 'trash-bin';
  if (action.startsWith('challan')) return 'receipt';
  if (action === 'power.cut') return 'flash-off';
  if (action === 'power.in') return 'flash';
  if (action.startsWith('power')) return 'flash';
  if (action.startsWith('inquiry')) return 'mail';
  if (action.startsWith('production_output.product')) return 'pricetag';
  if (action.startsWith('production_output.shift.end')) return 'checkmark-done';
  if (action.startsWith('production_output.shift.restart')) return 'refresh';
  if (action.startsWith('production_output.shift')) return 'bar-chart';
  if (action.startsWith('production_output')) return 'bar-chart';
  if (action.startsWith('production.material')) return 'layers';
  if (action.startsWith('production.shift.end')) return 'checkmark-circle';
  if (action.startsWith('production.shift.restart')) return 'refresh-circle';
  if (action.startsWith('production.shift')) return 'construct';
  if (action.startsWith('production')) return 'construct';
  if (action.startsWith('backup')) return 'archive';
  if (action.startsWith('user.disable')) return 'ban';
  if (action.startsWith('user.enable')) return 'checkmark-circle';
  if (action.startsWith('user.delete')) return 'person-remove';
  if (action.startsWith('user')) return 'person';
  return 'time-outline';
};

const getActionColor = (action) => {
  if (!action) return colors.neutral[500];
  if (action.startsWith('challan')) return colors.primary[600];
  if (action === 'power.cut') return colors.error[600];
  if (action === 'power.in') return colors.success[600];
  if (action.startsWith('power')) return colors.warning[600];
  if (action.startsWith('inquiry')) return colors.secondary[600];
  if (action.startsWith('production_output')) return colors.success[600];
  if (action.startsWith('production')) return colors.warning[600];
  if (action.startsWith('backup')) return colors.primary[600];
  if (action.startsWith('user')) return colors.secondary[600];
  return colors.neutral[500];
};

export default function LogsScreen({ refreshSignal }) {
  const { horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const [logs, setLogs] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchProfiles = useCallback(async (actorIds) => {
    if (!actorIds.length) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', actorIds);
    if (!error && data) {
      const map = {};
      data.forEach((p) => {
        map[p.id] = p;
      });
      setProfilesById(map);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (!error && data) {
      // Group consecutive challan.item.add entries
      const groupedLogs = [];
      let i = 0;
      
      while (i < data.length) {
        const currentLog = data[i];
        
        // Check if this is a challan.item.add entry
        if (currentLog.action === 'challan.item.add') {
          const groupedItems = [currentLog];
          const challanId = currentLog.entity_id;
          const actorId = currentLog.actor_id;
          let j = i + 1;
          
          // Look ahead for consecutive challan.item.add entries with same challan_id and actor
          while (
            j < data.length &&
            data[j].action === 'challan.item.add' &&
            data[j].entity_id === challanId &&
            data[j].actor_id === actorId
          ) {
            groupedItems.push(data[j]);
            j++;
          }
          
          // If we found multiple consecutive entries, create a grouped entry
          if (groupedItems.length > 1) {
            groupedLogs.push({
              ...currentLog,
              id: `grouped-${currentLog.id}`,
              isGrouped: true,
              groupedCount: groupedItems.length,
              groupedItems: groupedItems,
            });
            i = j; // Skip all grouped items
          } else {
            groupedLogs.push(currentLog);
            i++;
          }
        } else {
          groupedLogs.push(currentLog);
          i++;
        }
      }
      
      setLogs(groupedLogs);
      const actorIds = [...new Set(groupedLogs.map((l) => l.actor_id).filter(Boolean))];
      await fetchProfiles(actorIds);
    }
    setLastUpdatedAt(new Date());
    setLoading(false);
  }, [fetchProfiles]);

  useRefreshOnFocus(fetchLogs, [fetchLogs], 'logs', refreshSignal);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  }, [fetchLogs]);

  const renderItem = ({ item }) => {
    const actor = item.actor_id ? profilesById[item.actor_id] : null;
    const actorLabel = actor?.full_name
      ? `${actor.full_name}${actor.role ? ` (${actor.role.replace('_', ' ')})` : ''}`
      : item.actor_id
        ? `User ${item.actor_id.slice(0, 8)}`
        : 'System';
    
    // Handle grouped entries
    const actionLabel = item.isGrouped 
      ? `${item.groupedCount} Items Added`
      : ACTION_LABELS[item.action] || item.action;
    
    const timeLabel = item.created_at
      ? format(new Date(item.created_at), 'dd MMM yyyy • HH:mm')
      : '';
    const iconName = getActionIcon(item.action);
    const iconColor = getActionColor(item.action);
    const entityLabel = item.entity_type ? item.entity_type.toUpperCase() : 'EVENT';

    return (
      <AnimatedCard variant="elevated" style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.actionRow}>
            <View style={[styles.actionIcon, { backgroundColor: iconColor + '20' }]}>
              <Ionicons name={iconName} size={iconSizes.sm} color={iconColor} />
            </View>
            <ResponsiveText size="medium" weight="bold" color={colors.text.primary} numberOfLines={1} style={styles.actionLabel}>
              {actionLabel}
            </ResponsiveText>
            {item.isGrouped && (
              <View style={styles.groupBadge}>
                <ResponsiveText size="tiny" weight="bold" color={colors.white}>
                  {item.groupedCount}
                </ResponsiveText>
              </View>
            )}
          </View>
          <View style={styles.entityBadge}>
            <ResponsiveText size="tiny" weight="semibold" color={colors.primary[700]}>
              {entityLabel}
            </ResponsiveText>
          </View>
        </View>
        <ResponsiveText size="small" color={colors.text.secondary}>
          {actorLabel} • {timeLabel}
        </ResponsiveText>
        {item.entity_id ? (
          <ResponsiveText size="small" color={colors.text.tertiary} style={styles.metaLine}>
            ID: {item.entity_id}
          </ResponsiveText>
        ) : null}
        {item.isGrouped && item.groupedItems ? (
          <ResponsiveText size="small" color={colors.text.tertiary} style={styles.metaLine}>
            Added {item.groupedCount} items to challan
          </ResponsiveText>
        ) : item.metadata && Object.keys(item.metadata || {}).length > 0 ? (
          <ResponsiveText size="small" color={colors.text.tertiary} style={styles.metaLine}>
            {formatMetadata(item.metadata)}
          </ResponsiveText>
        ) : null}
      </AnimatedCard>
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Activity Logs"
        subtitle={`Latest ${PAGE_SIZE} events across the app`}
        icon="pulse-outline"
        chips={[
          { label: 'Total events', value: String(logs.length) },
          { label: 'Last updated', value: lastUpdatedAt ? format(lastUpdatedAt, 'dd MMM, HH:mm') : '—' },
        ]}
      />

      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
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
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading && <EmptyState icon="time-outline" title="No logs yet" />
        }
      />
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacingSizes.md,
    gap: spacingSizes.sm,
  },
  logCard: {
    paddingVertical: spacingSizes.sm + 2,
    paddingHorizontal: spacingSizes.md,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.xs,
  },
  actionRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
  },
  actionLabel: {
    flexShrink: 1,
  },
  actionIcon: {
    width: 30,
    height: 30,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entityBadge: {
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: 3,
    borderRadius: radii.xs,
    backgroundColor: colors.primary[50],
  },
  groupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: colors.primary[600],
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLine: {
    marginTop: spacingSizes.xs,
  },
});
