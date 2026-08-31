import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Modal,
  ScrollView as RNScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import GradientBackground from '../components/GradientBackground';
import AnimatedCard from '../components/AnimatedCard';
import ResponsiveText from '../components/ResponsiveText';
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

const STATUS_OPTIONS = [
  { key: 'seen', label: 'Seen', color: colors.primary[600] },
  { key: 'contacted', label: 'Contacted', color: colors.success[600] },
  { key: 'quoted', label: 'Quoted', color: colors.secondary[600] },
  { key: 'closed', label: 'Closed', color: colors.neutral[600] },
];

const WEBSITE_THEMES = [
  { key: 'theme-default', label: 'Default Dark', color: '#9d4edd', type: 'dark' },
  { key: 'theme-amber', label: 'Amber Dark', color: '#fb8500', type: 'dark' },
  { key: 'theme-eco', label: 'Eco Dark', color: '#00b451', type: 'dark' },
  { key: 'theme-cyber', label: 'Cyber Dark', color: '#00f5d4', type: 'dark' },
  { key: 'theme-crimson', label: 'Crimson Dark', color: '#d90429', type: 'dark' },
  { key: 'light-clean', label: 'Clean Light', color: '#4f46e5', type: 'light' },
  { key: 'light-warm', label: 'Warm Light', color: '#d97706', type: 'light' },
  { key: 'light-nature', label: 'Nature Light', color: '#059669', type: 'light' },
  { key: 'light-rose', label: 'Rose Light', color: '#db2777', type: 'light' },
];

const getStatusMeta = (status) => {
  const normalized = status || 'new';
  if (normalized === 'new') {
    return { label: 'New', color: colors.warning[600] };
  }
  const found = STATUS_OPTIONS.find((option) => option.key === normalized);
  return found || { label: normalized, color: colors.neutral[500] };
};

const formatValue = (value) => (value ? value : '—');

export default function InquiriesScreen({ refreshSignal }) {
  const { user } = useAuth();
  const { columns, horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();
  const gridColumns = columns > 1 ? 2 : 1;
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [themeModalVisible, setThemeModalVisible] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light-nature');
  const [savingTheme, setSavingTheme] = useState(false);

  const markSeen = useCallback(async (items) => {
    const unseen = items.filter((item) => !item.status || item.status === 'new');
    if (!unseen.length) return;

    const ids = unseen.map((item) => item.id);
    const { error } = await supabase
      .from('website_inquiries')
      .update({
        status: 'seen',
        status_updated_at: new Date().toISOString(),
        status_updated_by: user?.id || null,
      })
      .in('id', ids);

    if (!error) {
      setInquiries((prev) =>
        prev.map((item) =>
          ids.includes(item.id)
            ? {
                ...item,
                status: 'seen',
                status_updated_at: new Date().toISOString(),
                status_updated_by: user?.id || null,
              }
            : item
        )
      );

      await Promise.all(
        unseen.map((item) =>
          logService.logEvent({
            action: 'inquiry.status.change',
            entityType: 'website_inquiry',
            entityId: item.id,
            metadata: { from: item.status || 'new', to: 'seen', auto: true },
          })
        )
      );
    }
  }, [user?.id]);

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('website_inquiries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      Alert.alert('Error', error.message || 'Failed to load inquiries.');
      setLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setInquiries(list);
    await markSeen(list);
    setLoading(false);
  }, [markSeen]);

  const loadAnalytics = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

      const { data, error } = await supabase.rpc('website_unique_counts', {
        today_start: todayStart,
        week_start: weekStart,
      });
      if (error) throw error;

      setAnalytics({
        total: data?.total || 0,
        today: data?.today || 0,
        week: data?.week || 0,
        topCities: data?.top_cities || [],
      });
    } catch (e) {
      console.log('Analytics fetch error:', e.message);
    }
  }, []);

  const loadCurrentTheme = useCallback(async () => {
    try {
      const { data } = await supabase.from('site_config').select('value').eq('key', 'website_theme').single();
      if (data?.value) setCurrentTheme(data.value);
    } catch (e) {}
  }, []);

  const handleChangeTheme = async (themeKey) => {
    setSavingTheme(true);
    try {
      const { error } = await supabase.from('site_config').update({ value: themeKey, updated_at: new Date().toISOString(), updated_by: user?.id || null }).eq('key', 'website_theme');
      if (error) throw error;
      setCurrentTheme(themeKey);
      await logService.logEvent({ action: 'website.theme.change', entityType: 'site_config', entityId: 'website_theme', metadata: { theme: themeKey } });
    } catch (e) {
      Alert.alert('Error', e?.message || 'Failed to update theme.');
    } finally {
      setSavingTheme(false);
    }
  };

  useEffect(() => {
    loadInquiries();
    loadAnalytics();
    loadCurrentTheme();
  }, [loadInquiries, loadAnalytics, loadCurrentTheme]);

  useRefreshOnFocus(
    () => {
      loadInquiries();
      loadAnalytics();
      loadCurrentTheme();
    },
    [loadInquiries, loadAnalytics, loadCurrentTheme],
    'inquiries',
    refreshSignal
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadInquiries(), loadAnalytics()]);
    setRefreshing(false);
  }, [loadInquiries, loadAnalytics]);

  const handleStatusChange = async (item, status) => {
    const { error, data } = await supabase
      .from('website_inquiries')
      .update({
        status,
        status_updated_at: new Date().toISOString(),
        status_updated_by: user?.id || null,
      })
      .eq('id', item.id)
      .select('*')
      .single();

    if (error) {
      Alert.alert('Error', error.message || 'Failed to update status.');
      return;
    }

    setInquiries((prev) => prev.map((row) => (row.id === item.id ? data : row)));

    await logService.logEvent({
      action: 'inquiry.status.change',
      entityType: 'website_inquiry',
      entityId: item.id,
      metadata: { from: item.status || 'new', to: status },
    });
  };

  const handleCall = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmail = (email) => {
    if (!email) return;
    Linking.openURL(`mailto:${email}`);
  };

  const renderItem = ({ item }) => {
    const statusMeta = getStatusMeta(item.status);
    const createdLabel = item.created_at ? format(new Date(item.created_at), 'dd MMM yyyy • HH:mm') : '—';

    return (
      <AnimatedCard variant="elevated" style={[styles.card, gridColumns > 1 && { flex: 1 }]}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.partyName}>{formatValue(item.party_name)}</Text>
            <Text style={styles.createdAt}>{createdLabel}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusMeta.color }]}>
            <Text style={styles.statusText}>{statusMeta.label}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Mobile</Text>
          <Text style={styles.detailValue}>{formatValue(item.mobile)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Email</Text>
          <Text style={styles.detailValue}>{formatValue(item.email)}</Text>
        </View>
        <View style={styles.detailRowColumn}>
          <Text style={styles.detailLabel}>Requirements</Text>
          <Text style={styles.requirementsText}>{formatValue(item.requirements)}</Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.iconButton, !item.mobile && styles.buttonDisabled]}
            onPress={() => handleCall(item.mobile)}
            disabled={!item.mobile}
          >
            <Ionicons name="call" size={16} color={colors.primary[600]} />
            <Text style={styles.iconButtonText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconButton, !item.email && styles.buttonDisabled]}
            onPress={() => handleEmail(item.email)}
            disabled={!item.email}
          >
            <Ionicons name="mail" size={16} color={colors.primary[600]} />
            <Text style={styles.iconButtonText}>Email</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((status) => {
            const isActive = item.status === status.key;
            return (
              <TouchableOpacity
                key={status.key}
                style={[styles.statusOption, isActive && { backgroundColor: status.color }]}
                onPress={() => handleStatusChange(item, status.key)}
              >
                <Text style={[styles.statusOptionText, isActive && styles.statusOptionTextActive]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </AnimatedCard>
    );
  };

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Inquiries"
        subtitle="Website inquiry requests"
        icon="mail-open"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
          <Text style={styles.loadingText}>Loading inquiries...</Text>
        </View>
      ) : (
        <FlatList
          key={`cols-${gridColumns}`}
          numColumns={gridColumns}
          columnWrapperStyle={gridColumns > 1 ? { gap: spacingSizes.sm } : undefined}
          data={inquiries}
          keyExtractor={(item) => item.id}
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
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={analytics ? (
            <AnimatedCard variant="elevated" style={styles.analyticsCard}>
              <View style={styles.analyticsHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm, flex: 1 }}>
                  <Ionicons name="analytics-outline" size={18} color={colors.primary[600]} />
                  <Text style={styles.analyticsTitle}>Unique Visitors</Text>
                </View>
                <TouchableOpacity style={styles.themeBtn} onPress={() => setThemeModalVisible(true)}>
                  <Ionicons name="color-palette-outline" size={14} color={colors.primary[700]} />
                  <Text style={styles.themeBtnText}>Theme</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.analyticsRow}>
                <View style={styles.analyticsStat}>
                  <Text style={styles.analyticsValue}>{analytics.today}</Text>
                  <Text style={styles.analyticsLabel}>Today</Text>
                </View>
                <View style={[styles.analyticsDivider]} />
                <View style={styles.analyticsStat}>
                  <Text style={styles.analyticsValue}>{analytics.week}</Text>
                  <Text style={styles.analyticsLabel}>This Week</Text>
                </View>
                <View style={[styles.analyticsDivider]} />
                <View style={styles.analyticsStat}>
                  <Text style={styles.analyticsValue}>{analytics.total}</Text>
                  <Text style={styles.analyticsLabel}>All Time</Text>
                </View>
              </View>
              {analytics.topCities.length > 0 && (
                <View style={styles.citiesSection}>
                  <Text style={styles.citiesLabel}>Top Locations (7 days)</Text>
                  <View style={styles.citiesList}>
                    {analytics.topCities.map((item, i) => (
                      <View key={item.city} style={styles.cityChip}>
                        <Ionicons name="location-outline" size={12} color={colors.primary[600]} />
                        <Text style={styles.cityText}>{item.city}</Text>
                        <Text style={styles.cityCount}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </AnimatedCard>
          ) : null}
          ListEmptyComponent={<EmptyState icon="mail-outline" title="No inquiries yet." />}
        />
      )}
      {/* Theme Picker Modal */}
      <Modal visible={themeModalVisible} animationType="slide" transparent onRequestClose={() => setThemeModalVisible(false)}>
        <View style={styles.themeModalOverlay}>
          <View style={styles.themeModalContent}>
            <View style={styles.themeModalHeader}>
              <View>
                <Text style={styles.themeModalTitle}>Website Theme</Text>
                <Text style={styles.themeModalSubtitle}>Changes apply to the live website instantly</Text>
              </View>
              <TouchableOpacity onPress={() => setThemeModalVisible(false)} style={styles.themeModalClose}>
                <Ionicons name="close" size={22} color={colors.neutral[600]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.themeSectionLabel}>Dark Themes</Text>
            <View style={styles.themeGrid}>
              {WEBSITE_THEMES.filter(t => t.type === 'dark').map((theme) => {
                const isActive = currentTheme === theme.key;
                return (
                  <TouchableOpacity
                    key={theme.key}
                    style={[styles.themeOption, isActive && styles.themeOptionActive]}
                    onPress={() => handleChangeTheme(theme.key)}
                    disabled={savingTheme}
                  >
                    <View style={[styles.themeColorDot, { backgroundColor: theme.color }]} />
                    <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>{theme.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.primary[600]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.themeSectionLabel}>Light Themes</Text>
            <View style={styles.themeGrid}>
              {WEBSITE_THEMES.filter(t => t.type === 'light').map((theme) => {
                const isActive = currentTheme === theme.key;
                return (
                  <TouchableOpacity
                    key={theme.key}
                    style={[styles.themeOption, isActive && styles.themeOptionActive]}
                    onPress={() => handleChangeTheme(theme.key)}
                    disabled={savingTheme}
                  >
                    <View style={[styles.themeColorDot, { backgroundColor: theme.color }]} />
                    <Text style={[styles.themeOptionText, isActive && styles.themeOptionTextActive]}>{theme.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={18} color={colors.primary[600]} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {savingTheme && (
              <View style={styles.themeSaving}>
                <ActivityIndicator size="small" color={colors.primary[600]} />
                <Text style={styles.themeSavingText}>Applying theme...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacingSizes.md,
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
  partyName: {
    fontSize: textSizes.medium,
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
    borderRadius: 999,
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
  requirementsText: {
    marginTop: spacingSizes.xs,
    fontSize: textSizes.small,
    color: colors.neutral[600],
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    backgroundColor: colors.neutral[50],
    borderRadius: 999,
  },
  iconButtonText: {
    fontSize: textSizes.tiny,
    color: colors.primary[600],
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.xs,
    marginTop: spacingSizes.md,
  },
  statusOption: {
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    borderRadius: 999,
    backgroundColor: colors.neutral[100],
  },
  statusOptionText: {
    fontSize: textSizes.tiny,
    color: colors.neutral[600],
    fontWeight: '600',
  },
  statusOptionTextActive: {
    color: colors.white,
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
  // Analytics card
  analyticsCard: {
    padding: spacingSizes.md,
    marginBottom: spacingSizes.lg,
    borderRadius: 16,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.md,
  },
  analyticsTitle: {
    fontSize: textSizes.medium,
    fontWeight: '700',
    color: colors.text.primary,
  },
  analyticsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[50],
    borderRadius: 14,
    padding: spacingSizes.md,
  },
  analyticsStat: {
    flex: 1,
    alignItems: 'center',
  },
  analyticsValue: {
    fontSize: textSizes.xlarge || 20,
    fontWeight: '800',
    color: colors.primary[700],
  },
  analyticsLabel: {
    fontSize: textSizes.tiny,
    color: colors.neutral[500],
    fontWeight: '600',
    marginTop: 2,
  },
  analyticsDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.neutral[200],
  },
  citiesSection: {
    marginTop: spacingSizes.md,
  },
  citiesLabel: {
    fontSize: textSizes.tiny,
    fontWeight: '600',
    color: colors.neutral[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacingSizes.sm,
  },
  citiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.xs,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    backgroundColor: colors.primary[50],
    borderRadius: 8,
  },
  cityText: {
    fontSize: textSizes.tiny,
    color: colors.primary[700],
    fontWeight: '600',
  },
  cityCount: {
    fontSize: textSizes.tiny,
    color: colors.primary[500],
    fontWeight: '700',
  },
  // Theme button
  themeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: spacingSizes.xs,
    backgroundColor: colors.primary[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  themeBtnText: {
    fontSize: textSizes.tiny,
    fontWeight: '600',
    color: colors.primary[700],
  },
  // Theme Modal
  themeModalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  themeModalContent: {
    backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacingSizes.xl, maxHeight: '80%',
  },
  themeModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: spacingSizes.lg,
  },
  themeModalTitle: { fontSize: textSizes.large, fontWeight: '700', color: colors.text.primary },
  themeModalSubtitle: { fontSize: textSizes.small, color: colors.neutral[400], marginTop: 2 },
  themeModalClose: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.neutral[100], alignItems: 'center', justifyContent: 'center',
  },
  themeSectionLabel: {
    fontSize: textSizes.tiny, fontWeight: '700', color: colors.neutral[400],
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: spacingSizes.sm, marginTop: spacingSizes.md,
  },
  themeGrid: { gap: spacingSizes.xs },
  themeOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacingSizes.sm,
    paddingVertical: spacingSizes.md, paddingHorizontal: spacingSizes.md,
    borderRadius: 14, backgroundColor: colors.neutral[50],
    borderWidth: 1.5, borderColor: 'transparent',
  },
  themeOptionActive: {
    backgroundColor: colors.primary[50], borderColor: colors.primary[200],
  },
  themeColorDot: { width: 20, height: 20, borderRadius: 10 },
  themeOptionText: { fontSize: textSizes.medium, fontWeight: '500', color: colors.neutral[700], flex: 1 },
  themeOptionTextActive: { fontWeight: '700', color: colors.primary[700] },
  themeSaving: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacingSizes.sm, marginTop: spacingSizes.lg,
  },
  themeSavingText: { fontSize: textSizes.small, color: colors.primary[600], fontWeight: '600' },
});
