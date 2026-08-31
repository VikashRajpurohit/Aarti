import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';
import { spacingSizes } from '../../theme/responsive';
import DataTable from '../../components/DataTable';
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
  chartStyle,
} from './reportKit';

const PREVIEW = 8;

export default function SalesSection({ reportData, columns }) {
  const totals = reportData?.sales?.totals || null;
  const daily = reportData?.sales?.byDay || [];
  const [expanded, setExpanded] = useState(false);

  const series = useMemo(() => {
    if (daily.length < 2) return null;
    const dates = daily.map((d) => d.date);
    const interval = Math.max(1, Math.ceil(dates.length / 5));
    const labels = dates.map((d, i) => (i === 0 || i === dates.length - 1 || i % interval === 0 ? formatDateLabel(d) : ''));
    return {
      labels,
      grossWeights: daily.map((d) => toNumber(d.grossWeight)),
      challans: daily.map((d) => toNumber(d.challans)),
    };
  }, [daily]);

  const tileStyle = { flexGrow: 1, flexBasis: statTileBasis(columns) };
  const previewRows = expanded ? [...daily].reverse() : daily.slice(-PREVIEW).reverse();

  return (
    <>
      <ReportCard icon="receipt-outline" label="Sales Overview" color={CATEGORY.bubble} subtitle="Departed challans">
        {totals ? (
          <View style={styles.grid}>
            <MetricTile icon="document-text-outline" value={formatNumber(totals.challans)} label="Challans" color={CATEGORY.stretch} style={tileStyle} />
            <MetricTile icon="cube-outline" value={formatNumber(totals.boxes)} label="Boxes" color={CATEGORY.bubble} style={tileStyle} />
            <MetricTile icon="layers-outline" value={formatNumber(totals.pieces)} label="Pieces" color={CATEGORY.pouch} style={tileStyle} />
            <MetricTile icon="scale-outline" value={formatWeight(totals.grossWeight)} label="Gross Wt" color={CATEGORY.baby} style={tileStyle} />
          </View>
        ) : (
          <EmptyState icon="receipt-outline" title="No sales data" message="Try a wider range or pick a specific date." />
        )}
      </ReportCard>

      {series ? (
        <ChartCard icon="trending-up-outline" label="Daily Gross Weight (kg)" color={CATEGORY.bubble} subtitle="Dispatched weight trend">
          {(chartWidth) => (
            <LineChart
              data={{ labels: series.labels, datasets: [{ data: series.grossWeights }] }}
              width={chartWidth}
              height={180}
              chartConfig={getChartConfig(CATEGORY.bubble)}
              bezier
              style={chartStyle}
              fromZero
              withShadow
            />
          )}
        </ChartCard>
      ) : null}

      {series ? (
        <ChartCard icon="bar-chart-outline" label="Daily Challans Dispatched" color={CATEGORY.stretch}>
          {(chartWidth) => (
            <BarChart
              data={{ labels: series.labels, datasets: [{ data: series.challans }] }}
              width={chartWidth}
              height={180}
              fromZero
              chartConfig={{
                ...getChartConfig(CATEGORY.stretch),
                barPercentage: 0.6,
                fillShadowGradient: CATEGORY.stretch,
                fillShadowGradientOpacity: 1,
              }}
              yAxisLabel=""
              yAxisSuffix=""
              style={chartStyle}
              showValuesOnTopOfBars
            />
          )}
        </ChartCard>
      ) : null}

      <ReportCard
        icon="list-outline"
        label="Daily Breakdown"
        color={CATEGORY.bubble}
        subtitle={expanded ? `All ${daily.length} days` : 'Latest entries'}
        headerRight={daily.length > PREVIEW ? (
          <ViewAllToggle expanded={expanded} count={daily.length} onToggle={() => setExpanded((v) => !v)} />
        ) : null}
      >
        <DataTable
          detailTitle="Sales day"
          emptyMessage="No sales data."
          columns={[
            { key: 'date', title: 'Date', priority: 1, flex: 1.2 },
            { key: 'challans', title: 'Challans', priority: 1, align: 'right' },
            { key: 'boxes', title: 'Boxes', priority: 2, align: 'right' },
            { key: 'pieces', title: 'Pieces', priority: 3, align: 'right' },
            { key: 'grossWeight', title: 'Gross kg', priority: 1, align: 'right' },
          ]}
          rows={[
            ...previewRows.map((day) => ({
              date: formatDateLabel(day.date),
              challans: formatNumber(day.challans),
              boxes: formatNumber(day.boxes),
              pieces: formatNumber(day.pieces),
              grossWeight: formatNumber(day.grossWeight, 1),
            })),
            ...(totals ? [{
              date: 'Totals',
              challans: formatNumber(totals.challans),
              boxes: formatNumber(totals.boxes),
              pieces: formatNumber(totals.pieces),
              grossWeight: formatNumber(totals.grossWeight, 1),
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
});
