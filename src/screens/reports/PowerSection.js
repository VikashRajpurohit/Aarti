import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { colors } from '../../theme/colors';
import { spacingSizes } from '../../theme/responsive';
import DataTable from '../../components/DataTable';
import { formatDateLabel } from '../../utils/reportDates';
import ReportCard from './ReportCard';
import ChartCard from './ChartCard';
import MetricTile from './MetricTile';
import ViewAllToggle from './ViewAllToggle';
import {
  CATEGORY,
  toNumber,
  formatNumber,
  statTileBasis,
  getChartConfig,
  seriesColor,
  chartStyle,
} from './reportKit';

const PREVIEW = 7;

export default function PowerSection({ reportData, columns }) {
  const totals = reportData?.power?.totals || { cuts: 0, ins: 0, totalDowntimeMinutes: 0 };
  const daily = reportData?.power?.byDay || [];
  const [expanded, setExpanded] = useState(false);

  const series = useMemo(() => {
    if (daily.length < 2) return null;
    const dates = daily.map((d) => d.date);
    const interval = Math.max(1, Math.ceil(dates.length / 5));
    const labels = dates.map((d, i) => (i === 0 || i === dates.length - 1 || i % interval === 0 ? formatDateLabel(d) : ''));
    return {
      labels,
      cuts: daily.map((d) => toNumber(d.cuts)),
      ins: daily.map((d) => toNumber(d.ins)),
    };
  }, [daily]);

  const downtime = useMemo(() => {
    const mins = toNumber(totals.totalDowntimeMinutes);
    if (mins <= 0) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return [h > 0 ? `${h}h` : null, m > 0 ? `${m}m` : null].filter(Boolean).join(' ');
  }, [totals.totalDowntimeMinutes]);

  const tileStyle = { flexGrow: 1, flexBasis: statTileBasis(columns) };
  const previewRows = expanded ? [...daily].reverse() : daily.slice(-PREVIEW).reverse();

  return (
    <>
      <ReportCard icon="flash-outline" label="Power Overview" color={CATEGORY.baby} subtitle="Cuts and power-in">
        <View style={styles.grid}>
          <MetricTile icon="flash-off" value={formatNumber(totals.cuts)} label="Power Cuts" sub={downtime ? `${downtime} downtime` : undefined} color={CATEGORY.baby} style={tileStyle} />
          <MetricTile icon="flash" value={formatNumber(totals.ins)} label="Power In" color={CATEGORY.bubble} style={tileStyle} />
        </View>
      </ReportCard>

      {series ? (
        <ChartCard icon="trending-up-outline" label="Daily Power Events" color={CATEGORY.baby} subtitle="Cuts vs power-in">
          {(chartWidth) => (
            <LineChart
              data={{
                labels: series.labels,
                datasets: [
                  { data: series.cuts, color: seriesColor(CATEGORY.baby), strokeWidth: 2.5 },
                  { data: series.ins, color: seriesColor(CATEGORY.bubble), strokeWidth: 2.5 },
                ],
                legend: ['Cuts', 'Power In'],
              }}
              width={chartWidth}
              height={200}
              chartConfig={getChartConfig(CATEGORY.baby)}
              bezier
              style={chartStyle}
              fromZero
              withShadow
            />
          )}
        </ChartCard>
      ) : null}

      <ReportCard
        icon="list-outline"
        label="Daily Breakdown"
        color={CATEGORY.baby}
        subtitle={expanded ? `All ${daily.length} days` : 'Latest entries'}
        headerRight={daily.length > PREVIEW ? (
          <ViewAllToggle expanded={expanded} count={daily.length} onToggle={() => setExpanded((v) => !v)} />
        ) : null}
      >
        <DataTable
          detailTitle="Power day"
          emptyMessage="No power events recorded."
          columns={[
            { key: 'date', title: 'Date', priority: 1, flex: 1.2 },
            { key: 'cuts', title: 'Cuts', priority: 1, align: 'right' },
            { key: 'ins', title: 'Power In', priority: 1, align: 'right' },
          ]}
          rows={previewRows.map((day) => ({
            date: formatDateLabel(day.date),
            cuts: formatNumber(day.cuts),
            ins: formatNumber(day.ins),
          }))}
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
