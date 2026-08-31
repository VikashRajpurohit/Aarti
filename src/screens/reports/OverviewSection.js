import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacingSizes, iconSizes } from '../../theme/responsive';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import ResponsiveText from '../../components/ResponsiveText';
import { formatDateLabel } from '../../utils/reportDates';
import ReportCard from './ReportCard';
import {
  CATEGORY,
  toNumber,
  formatNumber,
  formatWeight,
  formatCompact,
  statTileBasis,
  wideTileBasis,
} from './reportKit';

export default function OverviewSection({ reportData, columns }) {
  const production = reportData?.production?.totals || null;
  const rawTotals = reportData?.rawMaterials?.totals || [];
  const sales = reportData?.sales?.totals || null;
  const power = reportData?.power?.totals || { cuts: 0, ins: 0, totalDowntimeMinutes: 0 };
  const rangeLabel = reportData?.range?.label || 'this period';

  const productionDaily = reportData?.production?.byDay || [];
  const rawMaterialDaily = reportData?.rawMaterials?.byDay || [];
  const salesDaily = reportData?.sales?.byDay || [];

  const rawTotalKg = rawTotals.reduce((s, m) => s + toNumber(m.quantity), 0);

  // ── Input vs Output snapshot (raw kg in vs stretch+bubble kg out) ──────────
  const io = useMemo(() => {
    const rawByDate = {};
    rawMaterialDaily.forEach((d) => {
      rawByDate[d.date] = d.materials.reduce((sum, m) => sum + toNumber(m.quantity), 0);
    });
    const prodByDate = {};
    productionDaily.forEach((d) => {
      prodByDate[d.date] = toNumber(d.totals.stretch.weight) + toNumber(d.totals.bubble.weight);
    });
    const allDates = Array.from(new Set([...Object.keys(rawByDate), ...Object.keys(prodByDate)]));
    if (allDates.length === 0) return null;
    const totalInput = Object.values(rawByDate).reduce((s, v) => s + v, 0);
    const totalOutput = Object.values(prodByDate).reduce((s, v) => s + v, 0);
    const efficiency = totalInput > 0 ? Math.round((totalOutput / totalInput) * 100) : 0;
    return { totalInput, totalOutput, efficiency };
  }, [rawMaterialDaily, productionDaily]);

  const effTone = io && io.efficiency >= 80 ? 'success' : io && io.efficiency >= 60 ? 'warning' : 'danger';
  const effColor = colors[effTone][600];
  const effBg = colors[effTone][50];

  // ── Insights (auto-computed answers) ──────────────────────────────────────
  const insights = useMemo(() => {
    if (!reportData) return [];
    const out = [];
    const dayS = reportData?.production?.dayShiftTotals;
    const nightS = reportData?.production?.nightShiftTotals;

    if (rawTotals.length > 0) {
      const top = [...rawTotals].sort((a, b) => toNumber(b.quantity) - toNumber(a.quantity))[0];
      out.push({
        question: 'Most used raw material',
        answer: top?.name || 'N/A',
        detail: top ? `${formatWeight(top.quantity)} consumed` : '',
        icon: 'cube',
        color: CATEGORY.baby,
      });
    }
    if (dayS && nightS) {
      const dayTotal = toNumber(dayS.stretch?.units) + toNumber(dayS.bubble?.units) + toNumber(dayS.baby?.units) + toNumber(dayS.pouch?.pieces);
      const nightTotal = toNumber(nightS.stretch?.units) + toNumber(nightS.bubble?.units) + toNumber(nightS.baby?.units) + toNumber(nightS.pouch?.pieces);
      const total = dayTotal + nightTotal;
      const dayPct = total > 0 ? Math.round((dayTotal / total) * 100) : 0;
      const isDay = dayTotal >= nightTotal;
      out.push({
        question: 'More efficient shift',
        answer: isDay ? 'Day Shift' : 'Night Shift',
        detail: `${dayPct}% Day · ${total > 0 ? 100 - dayPct : 0}% Night`,
        icon: isDay ? 'sunny-outline' : 'moon-outline',
        color: isDay ? CATEGORY.pouch : CATEGORY.stretch,
      });
      out.push({
        question: 'Day vs night — weight',
        answer: `Day: ${formatWeight(toNumber(dayS.stretch?.weight) + toNumber(dayS.bubble?.weight))}`,
        detail: `Night: ${formatWeight(toNumber(nightS.stretch?.weight) + toNumber(nightS.bubble?.weight))}`,
        icon: 'scale-outline',
        color: CATEGORY.bubble,
      });
    }
    if (productionDaily.length > 1) {
      let bestDay = null;
      let best = 0;
      productionDaily.forEach((day) => {
        const o = toNumber(day.totals.stretch?.units) + toNumber(day.totals.bubble?.units) + toNumber(day.totals.baby?.units) + toNumber(day.totals.pouch?.pieces);
        if (o > best) { best = o; bestDay = day.date; }
      });
      out.push({
        question: 'Best production day',
        answer: bestDay ? formatDateLabel(bestDay) : 'N/A',
        detail: bestDay ? `${formatNumber(best)} total units/pieces` : '',
        icon: 'calendar',
        color: CATEGORY.stretch,
      });
    }
    if (production) {
      out.push({
        question: 'Total production weight',
        answer: formatWeight(toNumber(production.stretch?.weight) + toNumber(production.bubble?.weight)),
        detail: `Stretch: ${formatWeight(production.stretch?.weight)} · Bubble: ${formatWeight(production.bubble?.weight)}`,
        icon: 'barbell-outline',
        color: colors.secondary[500],
      });
    }
    if (salesDaily.length > 1) {
      let bestDay = null;
      let best = 0;
      salesDaily.forEach((day) => {
        const w = toNumber(day.grossWeight);
        if (w > best) { best = w; bestDay = day.date; }
      });
      out.push({
        question: 'Busiest sales day',
        answer: bestDay ? formatDateLabel(bestDay) : 'N/A',
        detail: bestDay ? `${formatWeight(best)} dispatched` : '',
        icon: 'rocket-outline',
        color: colors.info,
      });
    }
    return out;
  }, [reportData, rawTotals, production, productionDaily, salesDaily]);

  const kpiStyle = { flexGrow: 1, flexBasis: statTileBasis(columns) };
  const insightStyle = { flexBasis: wideTileBasis(columns) };

  const hasAnything = production || rawTotals.length > 0 || sales;
  if (!hasAnything) {
    return (
      <ReportCard icon="grid-outline" label="Overview" color={colors.primary[500]}>
        <EmptyState
          icon="stats-chart-outline"
          title={`No data for ${rangeLabel}`}
          message="Try a wider range or pick a specific date."
        />
      </ReportCard>
    );
  }

  return (
    <>
      {/* KPI grid */}
      <View style={styles.grid}>
        <StatCard
          label="Total Production"
          value={formatCompact(toNumber(production?.stretch?.units) + toNumber(production?.bubble?.units) + toNumber(production?.baby?.units))}
          subValue={`${formatCompact(toNumber(production?.stretch?.weight) + toNumber(production?.bubble?.weight))} kg`}
          icon="construct-outline"
          tone="primary"
          style={kpiStyle}
        />
        <StatCard
          label="Raw Material"
          value={formatCompact(rawTotalKg)}
          subValue="kg consumed"
          icon="cube-outline"
          tone="danger"
          style={kpiStyle}
        />
        <StatCard
          label="Sales Dispatched"
          value={formatCompact(toNumber(sales?.challans))}
          subValue={`${formatCompact(toNumber(sales?.grossWeight))} kg`}
          icon="receipt-outline"
          tone="success"
          style={kpiStyle}
        />
        <StatCard
          label="Power Cuts"
          value={formatCompact(toNumber(power.cuts))}
          subValue={`${formatNumber(power.ins)} power-in`}
          icon="flash-outline"
          tone="warning"
          style={kpiStyle}
        />
      </View>

      {/* Input vs Output snapshot */}
      <ReportCard
        icon="swap-horizontal-outline"
        label="Input vs Output"
        color={colors.secondary[500]}
        subtitle="Raw material (kg) vs production weight (kg)"
      >
        {io ? (
          <>
            <View style={styles.ioRow}>
              <View style={[styles.ioItem, { borderLeftColor: CATEGORY.baby }]}>
                <ResponsiveText size="xlarge" weight="heavy" color={CATEGORY.baby} numberOfLines={1}>
                  {formatWeight(io.totalInput)}
                </ResponsiveText>
                <ResponsiveText size="small" weight="semibold" numberOfLines={1}>Total Input</ResponsiveText>
                <ResponsiveText size="tiny" color={colors.text.tertiary} numberOfLines={1}>Raw Materials</ResponsiveText>
              </View>
              <Ionicons name="arrow-forward" size={iconSizes.md} color={colors.secondary[500]} />
              <View style={[styles.ioItem, { borderLeftColor: CATEGORY.bubble }]}>
                <ResponsiveText size="xlarge" weight="heavy" color={CATEGORY.bubble} numberOfLines={1}>
                  {formatWeight(io.totalOutput)}
                </ResponsiveText>
                <ResponsiveText size="small" weight="semibold" numberOfLines={1}>Total Output</ResponsiveText>
                <ResponsiveText size="tiny" color={colors.text.tertiary} numberOfLines={1}>Stretch + Bubble</ResponsiveText>
              </View>
            </View>
            <View style={styles.effRow}>
              <View style={[styles.effBadge, { backgroundColor: effBg }]}>
                <Ionicons name="analytics-outline" size={iconSizes.xs} color={effColor} />
                <ResponsiveText size="small" weight="bold" color={effColor}>
                  {io.efficiency}% Yield Efficiency
                </ResponsiveText>
              </View>
              <ResponsiveText size="tiny" color={colors.text.tertiary}>
                {io.totalOutput > io.totalInput
                  ? `+${formatWeight(io.totalOutput - io.totalInput)} surplus`
                  : `${formatWeight(io.totalInput - io.totalOutput)} variance`}
              </ResponsiveText>
            </View>
            {power.cuts > 0 ? (
              <View style={styles.powerNote}>
                <Ionicons name="flash-off" size={iconSizes.xs} color={colors.error[500]} />
                <ResponsiveText size="tiny" color={colors.error[600]} style={styles.powerNoteText}>
                  {power.cuts} power cut{power.cuts > 1 ? 's' : ''} during this period may have affected efficiency
                </ResponsiveText>
              </View>
            ) : null}
          </>
        ) : (
          <EmptyState icon="swap-horizontal-outline" title="No input/output data" message={`Nothing recorded for ${rangeLabel}.`} />
        )}
      </ReportCard>

      {/* Insights */}
      <ReportCard icon="bulb-outline" label="Business Insights" color={CATEGORY.pouch} subtitle="Auto-computed from your data">
        {insights.length === 0 ? (
          <EmptyState icon="analytics-outline" title="No insights yet" message="Try a wider date range." />
        ) : (
          <View style={styles.grid}>
            {insights.map((card, i) => (
              <View key={i} style={[styles.insight, insightStyle]}>
                <View style={styles.insightTop}>
                  <View style={[styles.insightIcon, { backgroundColor: card.color + '18' }]}>
                    <Ionicons name={card.icon} size={iconSizes.sm} color={card.color} />
                  </View>
                  <ResponsiveText size="small" weight="semibold" color={colors.text.tertiary} style={styles.flex} numberOfLines={2}>
                    {card.question}
                  </ResponsiveText>
                </View>
                <ResponsiveText size="large" weight="heavy" color={card.color} numberOfLines={1}>
                  {card.answer}
                </ResponsiveText>
                {card.detail ? (
                  <ResponsiveText size="tiny" color={colors.text.secondary} numberOfLines={2}>
                    {card.detail}
                  </ResponsiveText>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ReportCard>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.md,
  },
  flex: { flex: 1 },
  ioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
  },
  ioItem: {
    flex: 1,
    borderLeftWidth: 3,
    paddingLeft: spacingSizes.sm,
  },
  effRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacingSizes.sm,
    marginTop: spacingSizes.md,
  },
  effBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    paddingHorizontal: spacingSizes.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  powerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.xs,
    marginTop: spacingSizes.sm,
    paddingTop: spacingSizes.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral[100],
  },
  powerNoteText: { flex: 1 },
  insight: {
    flexGrow: 1,
    backgroundColor: colors.neutral[50],
    borderRadius: radii.lg,
    padding: spacingSizes.md,
    gap: 2,
  },
  insightTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacingSizes.sm,
    marginBottom: spacingSizes.xs,
  },
  insightIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
