import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacingSizes, iconSizes, shadows } from '../../theme/responsive';
import DataTable from '../../components/DataTable';
import FilterPills from '../../components/FilterPills';
import EmptyState from '../../components/EmptyState';
import ResponsiveText from '../../components/ResponsiveText';
import { formatDateLabel } from '../../utils/reportDates';
import ReportCard from './ReportCard';
import ChartCard from './ChartCard';
import ViewAllToggle from './ViewAllToggle';
import { SkeletonBlock } from './ReportSkeleton';
import {
  CATEGORY,
  toNumber,
  formatNumber,
  paletteAt,
  statTileBasis,
  getChartConfig,
  chartStyle,
} from './reportKit';

const MATERIAL_TABS = [
  { key: 'raw', label: 'Raw Usage', icon: 'cube-outline' },
  { key: 'purchases', label: 'Purchases', icon: 'bag-add-outline' },
  { key: 'stock', label: 'Stock', icon: 'layers-outline' },
];

const PREVIEW = 7;

/** Animated horizontal usage bar. */
function ProgressBar({ label, value, maxValue, color, index }) {
  const pct = maxValue > 0 ? Math.min(1, value / maxValue) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: pct, duration: 600 + index * 80, useNativeDriver: false }).start();
  }, [pct]);
  const barWidth = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.progressRow}>
      <View style={styles.progressLabelRow}>
        <ResponsiveText size="small" weight="semibold" numberOfLines={1} style={styles.flex}>{label}</ResponsiveText>
        <ResponsiveText size="small" weight="semibold" color={colors.text.secondary}>{formatNumber(value, 1)} kg</ResponsiveText>
      </View>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: barWidth, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const materialsLine = (day) =>
  day.materials.filter((m) => m.quantity > 0).map((m) => `${m.name}: ${formatNumber(m.quantity, 1)}kg`).join(' • ') || 'None';

// A "usage by material" + daily-breakdown pair shared by Raw and Purchases tabs.
function UsageTab({ color, accentIcon, usageLabel, totals, daily }) {
  const [expanded, setExpanded] = useState(false);
  const max = useMemo(() => totals.reduce((m, x) => Math.max(m, toNumber(x.quantity)), 1), [totals]);
  const rangeTotal = totals.reduce((s, m) => s + toNumber(m.quantity), 0);

  const series = useMemo(() => {
    if (daily.length < 2) return null;
    const dates = daily.map((d) => d.date);
    const interval = Math.max(1, Math.ceil(dates.length / 5));
    const labels = dates.map((d, i) => (i === 0 || i === dates.length - 1 || i % interval === 0 ? formatDateLabel(d) : ''));
    const data = daily.map((d) => d.materials.reduce((s, m) => s + toNumber(m.quantity), 0));
    return { labels, data };
  }, [daily]);

  const previewRows = expanded ? [...daily].reverse() : daily.slice(-PREVIEW).reverse();

  return (
    <>
      <ReportCard icon={accentIcon} label={usageLabel} color={color} subtitle="Total kg over the period">
        {totals.length > 0 ? (
          totals.map((m, i) => (
            <ProgressBar key={m.key} label={m.name} value={toNumber(m.quantity)} maxValue={max} color={paletteAt(i)} index={i} />
          ))
        ) : (
          <EmptyState icon={accentIcon} title="Nothing recorded" message="Try a wider range or pick a specific date." />
        )}
      </ReportCard>

      {series ? (
        <ChartCard icon="trending-up-outline" label="Daily Total (kg)" color={color} subtitle="Trend over the period">
          {(chartWidth) => (
            <LineChart
              data={{ labels: series.labels, datasets: [{ data: series.data }] }}
              width={chartWidth}
              height={200}
              chartConfig={getChartConfig(color)}
              bezier
              style={chartStyle}
              fromZero
            />
          )}
        </ChartCard>
      ) : null}

      <ReportCard
        icon="list-outline"
        label="Daily Breakdown"
        color={color}
        subtitle={expanded ? `All ${daily.length} days` : 'Latest entries'}
        headerRight={daily.length > PREVIEW ? (
          <ViewAllToggle expanded={expanded} count={daily.length} onToggle={() => setExpanded((v) => !v)} />
        ) : null}
      >
        <DataTable
          detailTitle="Daily breakdown"
          emptyMessage="Nothing recorded."
          columns={[
            { key: 'date', title: 'Date', priority: 1, flex: 1.2 },
            { key: 'total', title: 'Total kg', priority: 1, align: 'right' },
            { key: 'materials', title: 'Materials', priority: 3, flex: 2 },
          ]}
          rows={[
            ...previewRows.map((day) => ({
              date: formatDateLabel(day.date),
              total: formatNumber(day.materials.reduce((s, m) => s + toNumber(m.quantity), 0), 1),
              materials: materialsLine(day),
            })),
            ...(totals.length > 0 ? [{ date: 'Totals', total: formatNumber(rangeTotal, 1), materials: '' }] : []),
          ]}
          keyExtractor={(row) => row.date}
        />
      </ReportCard>
    </>
  );
}

function StockTab({ stockData, stockLoading, columns }) {
  const basis = statTileBasis(columns);
  if (stockLoading) {
    return (
      <ReportCard icon="layers-outline" label="Stock Balance" color={colors.info}>
        <View style={styles.grid}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} height={92} width={basis} style={{ flexGrow: 1, borderRadius: radii.lg }} />
          ))}
        </View>
      </ReportCard>
    );
  }
  return (
    <ReportCard icon="layers-outline" label="Stock Balance" color={colors.info} subtitle="Purchased − consumed, as of the selected day">
      {!stockData.hasPurchases ? (
        <EmptyState icon="bag-add-outline" title="No purchase data yet" message="Add purchase entries to track stock balance." />
      ) : stockData.materials.length > 0 ? (
        <View style={styles.grid}>
          {stockData.materials.map((item, i) => {
            const low = item.balance < 0;
            return (
              <View key={item.key} style={[styles.stockCard, { flexBasis: basis, borderTopColor: paletteAt(i) }]}>
                <ResponsiveText size="small" weight="bold" numberOfLines={1}>{item.name}</ResponsiveText>
                <View style={styles.stockValueRow}>
                  <ResponsiveText size="xlarge" weight="heavy" color={low ? colors.error[500] : colors.success[600]} numberOfLines={1}>
                    {formatNumber(item.balance, 1)}
                  </ResponsiveText>
                  <ResponsiveText size="tiny" weight="semibold" color={colors.text.tertiary}>kg</ResponsiveText>
                </View>
                {low ? (
                  <View style={styles.lowBadge}>
                    <Ionicons name="warning" size={iconSizes.xs} color={colors.error[500]} />
                    <ResponsiveText size="tiny" weight="bold" color={colors.error[500]}>Low Stock</ResponsiveText>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : (
        <EmptyState icon="layers-outline" title="No active materials" message="Nothing to show stock for." />
      )}
    </ReportCard>
  );
}

export default function MaterialsSection({ reportData, columns, materialTab, setMaterialTab, showPurchases, stockData, stockLoading }) {
  const rawTotals = reportData?.rawMaterials?.totals || [];
  const rawDaily = reportData?.rawMaterials?.byDay || [];
  const purchaseTotals = reportData?.purchases?.totals || [];
  const purchaseDaily = reportData?.purchases?.byDay || [];

  const tab = showPurchases ? materialTab : 'raw';

  return (
    <>
      {showPurchases ? (
        <View style={styles.pills}>
          <FilterPills options={MATERIAL_TABS} selectedKey={tab} onSelect={setMaterialTab} />
        </View>
      ) : null}

      {tab === 'raw' ? (
        <UsageTab color={CATEGORY.baby} accentIcon="cube-outline" usageLabel="Usage by Material" totals={rawTotals} daily={rawDaily} />
      ) : tab === 'purchases' ? (
        <UsageTab color={colors.secondary[500]} accentIcon="bag-add-outline" usageLabel="Purchases by Material" totals={purchaseTotals} daily={purchaseDaily} />
      ) : (
        <StockTab stockData={stockData} stockLoading={stockLoading} columns={columns} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pills: { marginBottom: spacingSizes.md },
  flex: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
  },
  progressRow: { marginBottom: spacingSizes.md },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacingSizes.sm,
    marginBottom: 6,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral[100],
    borderRadius: radii.xs,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radii.xs },
  stockCard: {
    flexGrow: 1,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
    borderTopWidth: 3,
    padding: spacingSizes.md,
    gap: 4,
    ...shadows.small,
  },
  stockValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  lowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.error[50],
  },
});
