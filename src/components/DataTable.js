import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { radii } from '../theme/radii';
import { spacingSizes, iconSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import ResponsiveText from './ResponsiveText';
import AppModal from './AppModal';
import EmptyState from './EmptyState';

/**
 * Fit-to-width table — never scrolls horizontally. Columns declare a
 * priority (1 = always shown, 2 = default, 3 = wide screens only); on narrow
 * phones only priority ≤ 2 columns render, and tapping a row opens a detail
 * modal listing every column labeled, so nothing is lost.
 *
 * columns: [{ key, title, flex?, align? ('left'|'right'|'center'), priority?, formatter? }]
 * rows: array of objects keyed by column key
 */
export default function DataTable({
  columns,
  rows,
  keyExtractor,
  onRowPress,
  detailTitle = 'Details',
  emptyMessage = 'No data for this period',
  style,
}) {
  const { isTablet, isLandscape, width } = useResponsiveLayout();
  const [detailRow, setDetailRow] = useState(null);

  const maxPriority = isTablet || isLandscape || width >= 700 ? 3 : 2;
  const visibleColumns = columns.filter((col) => (col.priority || 2) <= maxPriority);
  const hasHiddenColumns = visibleColumns.length < columns.length;

  const cellValue = (col, row) => {
    const raw = row[col.key];
    return col.formatter ? col.formatter(raw, row) : raw;
  };

  const handleRowPress = (row) => {
    if (onRowPress) {
      onRowPress(row);
    } else if (hasHiddenColumns) {
      setDetailRow(row);
    }
  };

  const rowPressable = !!onRowPress || hasHiddenColumns;

  if (!rows || rows.length === 0) {
    return <EmptyState icon="grid-outline" title={emptyMessage} style={style} />;
  }

  return (
    <View style={[styles.table, style]}>
      <View style={styles.headerRow}>
        {visibleColumns.map((col) => (
          <ResponsiveText
            key={col.key}
            size="tiny"
            weight="bold"
            color={colors.text.tertiary}
            numberOfLines={1}
            style={[styles.headerCell, { flex: col.flex || 1, textAlign: col.align || 'left' }]}
          >
            {col.title.toUpperCase()}
          </ResponsiveText>
        ))}
        {rowPressable ? <View style={styles.chevronSpacer} /> : null}
      </View>
      {rows.map((row, index) => {
        const key = keyExtractor ? keyExtractor(row, index) : String(index);
        const Row = rowPressable ? TouchableOpacity : View;
        return (
          <Row
            key={key}
            onPress={rowPressable ? () => handleRowPress(row) : undefined}
            activeOpacity={0.6}
            style={[styles.dataRow, index % 2 === 1 && styles.dataRowAlt]}
          >
            {visibleColumns.map((col) => (
              <ResponsiveText
                key={col.key}
                size="small"
                color={colors.neutral[700]}
                numberOfLines={1}
                style={[styles.dataCell, { flex: col.flex || 1, textAlign: col.align || 'left' }]}
              >
                {cellValue(col, row)}
              </ResponsiveText>
            ))}
            {rowPressable ? (
              <Ionicons
                name="chevron-forward"
                size={iconSizes.xs}
                color={colors.neutral[300]}
                style={styles.chevronSpacer}
              />
            ) : null}
          </Row>
        );
      })}

      <AppModal
        visible={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailTitle}
        presentation="sheet"
      >
        {detailRow
          ? columns.map((col) => (
              <View key={col.key} style={styles.detailRow}>
                <ResponsiveText size="small" color={colors.text.secondary} style={styles.detailLabel}>
                  {col.title}
                </ResponsiveText>
                <ResponsiveText size="small" weight="semibold" style={styles.detailValue} align="right">
                  {cellValue(col, detailRow)}
                </ResponsiveText>
              </View>
            ))
          : null}
      </AppModal>
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.light,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacingSizes.sm,
    paddingHorizontal: spacingSizes.md,
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  headerCell: {
    paddingHorizontal: 2,
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacingSizes.sm + 2,
    paddingHorizontal: spacingSizes.md,
  },
  dataRowAlt: {
    backgroundColor: colors.neutral[50],
  },
  dataCell: {
    paddingHorizontal: 2,
  },
  chevronSpacer: {
    width: iconSizes.xs,
    marginLeft: spacingSizes.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacingSizes.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    gap: spacingSizes.md,
  },
  detailLabel: {
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
  },
});
