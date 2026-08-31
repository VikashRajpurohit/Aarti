import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

// Lifts the two pieces of navigation state the custom bottom bar needs to share
// with the grouped screens:
//  - `subTabByGroup`: which sub-tab is active inside each group (keyed by group
//    key). TabGroupScreen reads this to decide which screen to render; the bar
//    reads/sets it to drive the sub-tab chips.
//  - `expanded`: whether the active group's sub-tabs are shown inline in the bar
//    ("focus" mode) or collapsed to the all-groups row ("browse" mode).
// The active *group* itself stays owned by React Navigation — the bar reads it
// from the navigator state — so only sub-tab + expanded live here.
const NavContext = createContext({
  expanded: false,
  setExpanded: () => {},
  toggleExpanded: () => {},
  subTabByGroup: {},
  setSubTab: () => {},
});

export const NavProvider = ({ children }) => {
  const [expanded, setExpanded] = useState(false);
  const [subTabByGroup, setSubTabByGroup] = useState({});

  const toggleExpanded = useCallback(() => setExpanded((e) => !e), []);

  const setSubTab = useCallback((groupKey, tabKey) => {
    if (!groupKey || !tabKey) return;
    setSubTabByGroup((prev) =>
      prev[groupKey] === tabKey ? prev : { ...prev, [groupKey]: tabKey }
    );
  }, []);

  const value = useMemo(
    () => ({ expanded, setExpanded, toggleExpanded, subTabByGroup, setSubTab }),
    [expanded, toggleExpanded, subTabByGroup, setSubTab]
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
};

export const useNav = () => useContext(NavContext);

// Active sub-tab for a group, falling back to the first sub-tab (the default
// landing) when the user hasn't switched sub-tabs in that group yet.
export const getSubTab = (subTabByGroup, groupKey, subTabs) =>
  subTabByGroup[groupKey] ?? subTabs[0];
