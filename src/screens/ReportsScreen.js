import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import GradientBackground from '../components/GradientBackground';
import ScreenHeader from '../components/ScreenHeader';
import FilterPills from '../components/FilterPills';
import DateRangeSelector from '../components/DateRangeSelector';
import { spacingSizes } from '../theme/responsive';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { reportService } from '../services/reportService';
import { REPORT_PRESETS, getPresetRange } from '../utils/reportDates';
import { getTodayIST } from '../utils/dateOnly';
import { FEATURE_FLAGS } from '../config/roleTabs';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';

import OverviewSection from './reports/OverviewSection';
import ProductionSection from './reports/ProductionSection';
import MaterialsSection from './reports/MaterialsSection';
import SalesSection from './reports/SalesSection';
import PowerSection from './reports/PowerSection';
import ReportSkeleton from './reports/ReportSkeleton';

// ─── Navigation config ────────────────────────────────────────────────────────

const GROUP_OPTIONS = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'production', label: 'Production', icon: 'construct-outline' },
  { key: 'materials', label: 'Materials', icon: 'cube-outline' },
  { key: 'sales', label: 'Sales', icon: 'receipt-outline' },
  { key: 'power', label: 'Power', icon: 'flash-outline' },
];

const RANGE_OPTIONS = [
  { key: REPORT_PRESETS.TODAY, label: 'Today', icon: 'today-outline' },
  { key: REPORT_PRESETS.THIS_WEEK, label: 'This Week', icon: 'calendar-outline' },
  { key: REPORT_PRESETS.LAST_7, label: 'Last 7D', icon: 'time-outline' },
  { key: REPORT_PRESETS.LAST_15, label: 'Last 15D', icon: 'time-outline' },
  { key: REPORT_PRESETS.LAST_30, label: 'Last 30D', icon: 'time-outline' },
  { key: REPORT_PRESETS.THIS_MONTH, label: 'This Month', icon: 'calendar-outline' },
];

const SHOW_PURCHASES = FEATURE_FLAGS.SHOW_PURCHASES_MODULE;

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportsScreen({ refreshSignal }) {
  const { columns, horizontalPadding, scrollBottomPadding, contentMaxWidth } = useResponsiveLayout();

  const [selectedRange, setSelectedRange] = useState(REPORT_PRESETS.LAST_7);
  const [activeGroup, setActiveGroup] = useState('overview');
  const [materialTab, setMaterialTab] = useState('raw');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [stockData, setStockData] = useState({ hasPurchases: false, materials: [] });
  const [stockLoading, setStockLoading] = useState(false);

  // Stock is a Materials sub-tab; only reachable when the Purchases module is on.
  const isStockActive = SHOW_PURCHASES && activeGroup === 'materials' && materialTab === 'stock';

  const loadReports = useCallback(async (preset) => {
    setLoading(true);
    try {
      setReportData(await reportService.getReports(preset));
    } catch (error) {
      console.error('loadReports error', error);
      Alert.alert('Error', error?.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStockBalance = useCallback(async (preset) => {
    setStockLoading(true);
    try {
      // Stock target day = the selected custom day, the end of a custom range, or today (IST).
      const targetDate = preset?.startsWith('CUSTOM_DATE:')
        ? preset.split(':')[1]
        : preset?.startsWith('CUSTOM_RANGE:')
          ? preset.split(':')[2]
          : getTodayIST();
      setStockData(await reportService.getStockBalance(targetDate));
    } catch (error) {
      console.error('loadStockBalance error', error);
      Alert.alert('Error', error?.message || 'Failed to load stock balance.');
    } finally {
      setStockLoading(false);
    }
  }, []);

  const refreshReports = useCallback(() => {
    if (isStockActive) loadStockBalance(selectedRange);
    else loadReports(selectedRange);
  }, [isStockActive, loadReports, loadStockBalance, selectedRange]);

  useRefreshOnFocus(refreshReports, [refreshReports], 'reports', refreshSignal);

  useEffect(() => {
    if (isStockActive) loadStockBalance(selectedRange);
    else loadReports(selectedRange);
  }, [selectedRange, activeGroup, isStockActive, loadReports, loadStockBalance]);

  const activeRangeLabel = (() => {
    try {
      return getPresetRange(selectedRange).label;
    } catch {
      return 'Select range';
    }
  })();

  const renderSection = () => {
    switch (activeGroup) {
      case 'overview':
        return <OverviewSection reportData={reportData} columns={columns} />;
      case 'production':
        return <ProductionSection reportData={reportData} columns={columns} />;
      case 'materials':
        return (
          <MaterialsSection
            reportData={reportData}
            columns={columns}
            materialTab={materialTab}
            setMaterialTab={setMaterialTab}
            showPurchases={SHOW_PURCHASES}
            stockData={stockData}
            stockLoading={stockLoading}
          />
        );
      case 'sales':
        return <SalesSection reportData={reportData} columns={columns} />;
      case 'power':
        return <PowerSection reportData={reportData} columns={columns} />;
      default:
        return null;
    }
  };

  return (
    <GradientBackground style={styles.container}>
      <ScreenHeader
        title="Reports"
        subtitle="Production · Materials · Sales · Power"
        icon="stats-chart"
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: horizontalPadding,
            paddingBottom: scrollBottomPadding,
            maxWidth: contentMaxWidth,
            alignSelf: 'center',
            width: '100%',
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <DateRangeSelector
          style={styles.rangeSelector}
          options={isStockActive ? RANGE_OPTIONS.filter((o) => o.key === REPORT_PRESETS.TODAY) : RANGE_OPTIONS}
          selectedKey={selectedRange}
          displayLabel={activeRangeLabel}
          onSelect={setSelectedRange}
          allowCustomRange={!isStockActive}
        />

        <FilterPills
          style={styles.groupPills}
          options={GROUP_OPTIONS}
          selectedKey={activeGroup}
          onSelect={setActiveGroup}
        />

        {loading && !isStockActive ? <ReportSkeleton columns={columns} /> : renderSection()}
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingTop: spacingSizes.md },
  rangeSelector: { marginBottom: spacingSizes.md },
  groupPills: { marginBottom: spacingSizes.md },
});
