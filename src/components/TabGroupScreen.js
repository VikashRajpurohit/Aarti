import React, { useState, useEffect, useCallback, useContext, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useNav, getSubTab } from '../context/NavContext';
import ErrorBoundary from './ErrorBoundary';

// Renders the active sub-tab screen for a group. Sub-tab selection now lives in
// the custom bottom bar (see BottomNav + NavContext) — there is no top segment
// bar anymore. `hasSegmentBar` is kept on the context for ScreenHeader's inset
// logic, but is always false now that nothing sits above the header.
//
// Lets child screens switch the active sub-tab within their group (e.g. Scanner
// → "Challans"). Screens rendered outside a group get the safe no-op default.
export const TabGroupContext = React.createContext({
  activeTab: null,
  navigateToTab: () => {},
  hasSegmentBar: false,
});
export const useTabGroup = () => useContext(TabGroupContext);

export default function TabGroupScreen({ groupKey, subTabs, screens }) {
  const { subTabByGroup, setSubTab } = useNav();
  const [refreshTick, setRefreshTick] = useState(0);
  const isFocused = useIsFocused();

  const activeTab = getSubTab(subTabByGroup, groupKey, subTabs);

  // Refetch when the group regains focus or the active sub-tab changes — the
  // active screen consumes `refreshSignal` via useRefreshOnFocus.
  useEffect(() => {
    if (isFocused) setRefreshTick((tick) => tick + 1);
  }, [isFocused]);

  useEffect(() => {
    setRefreshTick((tick) => tick + 1);
  }, [activeTab]);

  const navigateToTab = useCallback(
    (tabKey) => {
      if (subTabs.includes(tabKey)) setSubTab(groupKey, tabKey);
    },
    [subTabs, groupKey, setSubTab]
  );

  const tabGroupValue = useMemo(
    () => ({ activeTab, navigateToTab, hasSegmentBar: false }),
    [activeTab, navigateToTab]
  );

  const ActiveScreen = screens[activeTab];

  return (
    <TabGroupContext.Provider value={tabGroupValue}>
      <View style={styles.container}>
        {ActiveScreen ? (
          <ErrorBoundary>
            <ActiveScreen refreshSignal={refreshTick} activeTabKey={activeTab} />
          </ErrorBoundary>
        ) : null}
      </View>
    </TabGroupContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral[100],
  },
});
