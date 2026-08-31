// Single source of truth for Reports visuals + formatting. Everything here
// derives from theme tokens — no raw hex — so the Reports screen matches the
// rest of the app and themes consistently.
import { colors } from '../../theme/colors';
import { spacingSizes } from '../../theme/responsive';
import { radii } from '../../theme/radii';
import { formatDateLabel } from '../../utils/reportDates';

// ── Category + chart colors (all from theme tokens) ──────────────────────────
export const CATEGORY = {
  stretch: colors.primary[500],
  bubble: colors.success[500],
  pouch: colors.warning[500],
  baby: colors.danger[500],
};

// Ordered palette for progress bars / multi-series charts — theme tokens only.
export const CHART_PALETTE = [
  colors.primary[500],
  colors.success[500],
  colors.warning[500],
  colors.danger[500],
  colors.secondary[500],
  colors.info,
];

export const paletteAt = (index) => CHART_PALETTE[index % CHART_PALETTE.length];

// ── Responsive grid sizing (flexBasis from useResponsiveLayout().columns) ─────
// Small stat/metric tiles: 2-up phone, 3-up tablet, 4-up wide landscape.
export const statTileBasis = (columns) =>
  columns >= 3 ? '23%' : columns >= 2 ? '30%' : '45%';
// Larger content tiles (insight cards, stock cards): 1-up phone, 2-up wide.
export const wideTileBasis = (columns) => (columns >= 2 ? '48%' : '100%');

// ── Number / date formatting ─────────────────────────────────────────────────
export const toNumber = (value) => {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatNumber = (value, decimals = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatWeight = (value) => `${formatNumber(value, 1)} kg`;

export const formatCompact = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return formatNumber(n);
};

// Thin out x-axis labels so a wide series stays legible (first, last, ~every 5th).
export const buildChartLabels = (dates) => {
  if (!dates || dates.length === 0) return [];
  if (dates.length === 1) return [formatDateLabel(dates[0])];
  const interval = Math.max(1, Math.ceil(dates.length / 5));
  return dates.map((date, index) => {
    if (index === 0 || index === dates.length - 1 || index % interval === 0) {
      return formatDateLabel(date);
    }
    return '';
  });
};

// ── Charts ───────────────────────────────────────────────────────────────────
// #RRGGBB → rgba(). react-native-chart-kit wants a color(opacity) callback.
const hexToRgba = (hex, opacity = 1) => {
  const clean = String(hex).replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return `rgba(99, 102, 241, ${opacity})`;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export const seriesColor = (hex) => (opacity = 1) => hexToRgba(hex, opacity);

// Consistent chart-kit config for every chart on the screen.
export const getChartConfig = (hex) => ({
  backgroundGradientFrom: colors.white,
  backgroundGradientTo: colors.white,
  color: seriesColor(hex),
  labelColor: (opacity = 1) => hexToRgba(colors.neutral[500], opacity),
  strokeWidth: 2.5,
  decimalPlaces: 0,
  propsForBackgroundLines: { stroke: colors.neutral[100], strokeDasharray: '4' },
  propsForDots: { r: '4', strokeWidth: '2', stroke: colors.white },
});

// Shared chart wrapper style (kept in JS so ChartCard and any inline chart match).
export const chartStyle = { borderRadius: radii.lg, marginTop: spacingSizes.sm };
