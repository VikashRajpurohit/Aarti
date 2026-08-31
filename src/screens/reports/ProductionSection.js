import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';
import { spacingSizes } from '../../theme/responsive';
import DataTable from '../../components/DataTable';
import FilterPills from '../../components/FilterPills';
import EmptyState from '../../components/EmptyState';
import { formatDateLabel } from '../../utils/reportDates';
import ReportCard from './ReportCard';
import ChartCard from './ChartCard';
import MetricTile from './MetricTile';
import ViewAllToggle from './ViewAllToggle';
import {
  CATEGORY,
  toNumber,
  formatNumber,
  formatWeight,
  statTileBasis,
  getChartConfig,
  seriesColor,
  chartStyle,
} from './reportKit';

const CATS = [
  { key: 'stretch', label: 'Stretch', icon: 'layers-outline' },
  { key: 'bubble', label: 'Bubble', icon: 'ellipse-outline' },
  { key: 'baby', label: 'Baby', icon: 'cube-outline' },
  { key: 'pouch', label: 'Pouch', icon: 'file-tray-outline' },
];

const PREVIEW = 8;

export default function ProductionSection({ reportData, columns }) {
  const totals = reportData?.production?.totals || null;
  const daily = reportData?.production?.byDay || [];
  const [cat, setCat] = useState('stretch');
  const [expanded, setExpanded] = useState(false);

  const series = useMemo(() => {
    if (!daily.length) return null;
    const dates = daily.map((d) => d.date);
    const val = (path) => daily.map((d) => toNumber(path(d.totals)));
    return {
      dates,
      labels: (() => {
        if (dates.length === 1) return [formatDateLabel(dates[0])];
        const interval = Math.max(1, Math.ceil(dates.length / 5));
        return dates.map((date, i) => (i === 0 || i === dates.length - 1 || i % interval === 0 ? formatDateLabel(date) : ''));
      })(),
      stretch: { units: val((t) => t.stretch.units), weight: val((t) => t.stretch.weight), unit: 'boxes' },
      bubble: { units: val((t) => t.bubble.units), weight: val((t) => t.bubble.weight), unit: 'rolls' },
      baby: { units: val((t) => t.baby.units), weight: null, unit: 'boxes' },
      pouch: { units: val((t) => t.pouch.pieces), weight: null, unit: 'pieces' },
    };
  }, [daily]);

  const hasMultipleDays = series && series.labels.length > 1;
  const active = series ? series[cat] : null;
  const catColor = CATEGORY[cat];
  const catLabel = CATS.find((c) => c.key === cat)?.label;
  const nonZero = active && active.units.some((v) => v !== 0);

  const singleLabel = active
    ? `${active.unit}${active.weight ? ` · ${formatWeight(active.weight[0] || 0)}` : ''}`
    : '';

  const tileStyle = { flexGrow: 1, flexBasis: statTileBasis(columns) };

  const previewRows = expanded ? [...daily].reverse() : daily.slice(-PREVIEW).reverse();

  return (
    <>
      {/* Summary tiles */}
      <ReportCard icon="construct-outline" label="Production Output" color={CATEGORY.stretch} subtitle={reportData?.range?.label}>
        {totals ? (
          <View style={styles.grid}>
            <MetricTile value={formatNumber(totals.stretch.units)} label="Stretch Boxes" sub={formatWeight(totals.stretch.weight)} color={CATEGORY.stretch} style={tileStyle} />
            <MetricTile value={formatNumber(totals.bubble.units)} label="Bubble Rolls" sub={formatWeight(totals.bubble.weight)} color={CATEGORY.bubble} style={tileStyle} />
            <MetricTile value={formatNumber(totals.pouch.pieces)} label="Pouch Pieces" color={CATEGORY.pouch} style={tileStyle} />
            <MetricTile value={formatNumber(totals.baby.units)} label="Baby Boxes" color={CATEGORY.baby} style={tileStyle} />
          </View>
        ) : (
          <EmptyState icon="construct-outline" title="No production data" message="Try a wider range or pick a specific date." />
        )}
      </ReportCard>

      {/* Category trend — one chart, category toggle */}
      <View style={styles.pills}>
        <FilterPills options={CATS} selectedKey={cat} onSelect={setCat} />
      </View>
      <ChartCard
        icon="trending-up-outline"
        label={`${catLabel} Trend`}
        color={catColor}
        subtitle={hasMultipleDays ? 'Over the selected period' : 'Selected day'}
        empty={!series || !nonZero}
        emptyIcon="construct-outline"
        emptyMessage="No data for this category."
        multiDay={hasMultipleDays}
        singleValue={active ? formatNumber(active.units[0]) : '0'}
        singleLabel={singleLabel}
      >
        {(chartWidth) => (
          <LineChart
            data={{ labels: series.labels, datasets: [{ data: active.units, color: seriesColor(catColor), strokeWidth: 2.5 }] }}
            width={chartWidth}
            height={200}
            chartConfig={getChartConfig(catColor)}
            bezier
            style={chartStyle}
            fromZero
            withShadow
            withInnerLines
          />
        )}
      </ChartCard>

      {/* Daily breakdown */}
      <ReportCard
        icon="list-outline"
        label="Daily Breakdown"
        color={CATEGORY.stretch}
        subtitle={expanded ? `All ${daily.length} days` : 'Latest entries'}
        headerRight={daily.length > PREVIEW ? (
          <ViewAllToggle expanded={expanded} count={daily.length} onToggle={() => setExpanded((v) => !v)} />
        ) : null}
      >
        <DataTable
          detailTitle="Production day"
          emptyMessage="No production data."
          columns={[
            { key: 'date', title: 'Date', priority: 1, flex: 1.2 },
            { key: 'stretch', title: 'Stretch (box)', priority: 1, align: 'right' },
            { key: 'bubble', title: 'Bubble (roll)', priority: 1, align: 'right' },
            { key: 'pouch', title: 'Pouch (pcs)', priority: 2, align: 'right' },
            { key: 'baby', title: 'Baby (box)', priority: 3, align: 'right' },
          ]}
          rows={[
            ...previewRows.map((day) => ({
              date: formatDateLabel(day.date),
              stretch: formatNumber(day.totals.stretch.units),
              bubble: formatNumber(day.totals.bubble.units),
              pouch: formatNumber(day.totals.pouch.pieces),
              baby: formatNumber(day.totals.baby.units),
            })),
            ...(totals ? [{
              date: 'Totals',
              stretch: formatNumber(totals.stretch.units),
              bubble: formatNumber(totals.bubble.units),
              pouch: formatNumber(totals.pouch.pieces),
              baby: formatNumber(totals.baby.units),
            }] : []),
          ]}
          keyExtractor={(row) => row.date}
        />
      </ReportCard>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
  },
  pills: { marginBottom: spacingSizes.md },
});
