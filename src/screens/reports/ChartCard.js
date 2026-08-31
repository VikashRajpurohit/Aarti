import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { spacingSizes } from '../../theme/responsive';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import EmptyState from '../../components/EmptyState';
import ResponsiveText from '../../components/ResponsiveText';
import ReportCard from './ReportCard';

/**
 * A ReportCard that hosts a react-native-chart-kit chart. It computes a
 * responsive chart width (recomputes on rotation via useResponsiveLayout) and
 * passes it to `children` as a render function. Handles the empty and
 * single-day (one data point) states so sections don't repeat that logic.
 *
 * Props (in addition to ReportCard's icon/label/color/subtitle/headerRight):
 * - empty, emptyIcon, emptyMessage
 * - multiDay (default true): when false, renders the big single-day metric
 * - singleValue, singleLabel: the single-day fallback content
 * - children: (chartWidth: number) => ReactNode
 */
export default function ChartCard({
  icon,
  label,
  color = colors.primary[500],
  subtitle,
  headerRight,
  empty = false,
  emptyIcon = 'stats-chart-outline',
  emptyMessage = 'No data for this period.',
  multiDay = true,
  singleValue,
  singleLabel,
  delay = 0,
  children,
  style,
}) {
  const { width, contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  // Content is capped at contentMaxWidth; ReportCard adds spacingSizes.md
  // padding on each side.
  const chartWidth =
    Math.min(width, contentMaxWidth) - horizontalPadding * 2 - spacingSizes.md * 2;

  return (
    <ReportCard
      icon={icon}
      label={label}
      color={color}
      subtitle={subtitle}
      headerRight={headerRight}
      delay={delay}
      style={style}
    >
      {empty ? (
        <EmptyState icon={emptyIcon} title={emptyMessage} />
      ) : !multiDay ? (
        <View style={styles.single}>
          <ResponsiveText size="huge" weight="heavy" color={color} numberOfLines={1}>
            {singleValue}
          </ResponsiveText>
          {singleLabel ? (
            <ResponsiveText size="medium" color={colors.text.secondary} align="center">
              {singleLabel}
            </ResponsiveText>
          ) : null}
        </View>
      ) : typeof children === 'function' ? (
        children(chartWidth)
      ) : (
        children
      )}
    </ReportCard>
  );
}

const styles = StyleSheet.create({
  single: {
    alignItems: 'center',
    paddingVertical: spacingSizes.xl,
    gap: spacingSizes.xs,
  },
});
