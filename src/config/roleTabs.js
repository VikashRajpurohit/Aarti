// Centralized role-to-tab access map.
// Update this file to change which roles can see which tabs

// ── Feature Flags ───────────────────────────────────────────
export const FEATURE_FLAGS = {
  SHOW_PURCHASES_MODULE: true,
};

export const TAB_KEYS = {
  SCANNER: 'Scanner',
  CHALLAN: 'Challan',
  CHALLAN_MANAGEMENT: 'ChallanManagement',
  USERS: 'Users',
  LOGS: 'Logs',
  INQUIRIES: 'Inquiries',
  POWER: 'Power',
  PRODUCTION: 'Production',
  PRODUCTION_OUTPUT: 'ProductionOutput',
  PURCHASES: 'Purchases',
  REPORTS: 'Reports',
  PROFILE: 'Profile',
};

// ── Tab Groups ──────────────────────────────────────────────
// Each group becomes a single bottom tab.
// Sub-tabs appear as a segment control inside the group screen.
// Reorder subTabs array to change the default landing sub-tab (first = default).

export const GROUP_KEYS = {
  PRODUCTION: 'ProductionGroup',
  SALES: 'SalesGroup',
  PURCHASES: 'PurchasesGroup',
  MANAGEMENT: 'ManagementGroup',
  INQUIRIES: 'InquiriesGroup',
  PROFILE: 'ProfileGroup',
};

export const TAB_GROUPS = {
  [GROUP_KEYS.PRODUCTION]: {
    key: GROUP_KEYS.PRODUCTION,
    label: 'Production',
    icon: 'construct',
    iconOutline: 'construct-outline',
    subTabs: [TAB_KEYS.PRODUCTION_OUTPUT, TAB_KEYS.PRODUCTION, TAB_KEYS.POWER],
  },
  [GROUP_KEYS.PURCHASES]: {
    key: GROUP_KEYS.PURCHASES,
    label: 'Purchases',
    icon: 'bag-add',
    iconOutline: 'bag-add-outline',
    subTabs: [TAB_KEYS.PURCHASES],
  },
  [GROUP_KEYS.SALES]: {
    key: GROUP_KEYS.SALES,
    label: 'Sales',
    icon: 'cart',
    iconOutline: 'cart-outline',
    subTabs: [TAB_KEYS.SCANNER, TAB_KEYS.CHALLAN, TAB_KEYS.CHALLAN_MANAGEMENT],
  },
  [GROUP_KEYS.MANAGEMENT]: {
    key: GROUP_KEYS.MANAGEMENT,
    label: 'Manage',
    icon: 'shield',
    iconOutline: 'shield-outline',
    subTabs: [TAB_KEYS.USERS, TAB_KEYS.LOGS, TAB_KEYS.REPORTS],
  },
  [GROUP_KEYS.INQUIRIES]: {
    key: GROUP_KEYS.INQUIRIES,
    label: 'Inquiries',
    icon: 'mail',
    iconOutline: 'mail-outline',
    subTabs: [TAB_KEYS.INQUIRIES],
  },
  [GROUP_KEYS.PROFILE]: {
    key: GROUP_KEYS.PROFILE,
    label: 'Profile',
    icon: 'person',
    iconOutline: 'person-outline',
    subTabs: [TAB_KEYS.PROFILE],
  },
};

// Labels and icons for each sub-tab (used by the segment control)
export const SUB_TAB_META = {
  [TAB_KEYS.PRODUCTION_OUTPUT]: { label: 'Production', icon: 'construct-outline' },
  [TAB_KEYS.PRODUCTION]: { label: 'Raw Material', icon: 'cube-outline' },
  [TAB_KEYS.PURCHASES]: { label: 'Purchases', icon: 'bag-add-outline' },
  [TAB_KEYS.POWER]: { label: 'Power', icon: 'flash-outline' },
  [TAB_KEYS.SCANNER]: { label: 'Scanner', icon: 'qr-code-outline' },
  [TAB_KEYS.CHALLAN]: { label: 'Details', icon: 'receipt-outline' },
  [TAB_KEYS.CHALLAN_MANAGEMENT]: { label: 'Challans', icon: 'list-outline' },
  [TAB_KEYS.USERS]: { label: 'Users', icon: 'people-outline' },
  [TAB_KEYS.LOGS]: { label: 'Logs', icon: 'time-outline' },
  [TAB_KEYS.REPORTS]: { label: 'Reports', icon: 'stats-chart-outline' },
  [TAB_KEYS.INQUIRIES]: { label: 'Inquiries', icon: 'mail-outline' },
  [TAB_KEYS.PROFILE]: { label: 'Profile', icon: 'person-outline' },
};

// ── Role Mapping ─────────────────────────────────────────────
// Two-level permission system:
// 1. ROLE_GROUPS: Controls which bottom tab groups are visible
// 2. ROLE_TABS: Controls which sub-tabs within those groups are accessible

export const ROLE_GROUPS = {
  admin: [
    GROUP_KEYS.PRODUCTION,
    GROUP_KEYS.SALES,
    GROUP_KEYS.PURCHASES,
    GROUP_KEYS.MANAGEMENT,
    GROUP_KEYS.INQUIRIES,
    GROUP_KEYS.PROFILE,
  ],
  general_manager: [GROUP_KEYS.PRODUCTION, GROUP_KEYS.PROFILE],
  sales_manager: [GROUP_KEYS.SALES, GROUP_KEYS.PROFILE],
  purchase_manager: [GROUP_KEYS.PURCHASES, GROUP_KEYS.PROFILE],
  production_manager: [GROUP_KEYS.PRODUCTION, GROUP_KEYS.PROFILE],
};

export const ROLE_TABS = {
  admin: [
    TAB_KEYS.USERS,
    TAB_KEYS.LOGS,
    TAB_KEYS.INQUIRIES,
    TAB_KEYS.POWER,
    TAB_KEYS.REPORTS,
    TAB_KEYS.PRODUCTION,
    TAB_KEYS.PRODUCTION_OUTPUT,
    TAB_KEYS.PROFILE,
    TAB_KEYS.SCANNER,
    TAB_KEYS.CHALLAN,
    TAB_KEYS.CHALLAN_MANAGEMENT,
    TAB_KEYS.PURCHASES,
  ],
  general_manager: [TAB_KEYS.PRODUCTION_OUTPUT, TAB_KEYS.PRODUCTION, TAB_KEYS.POWER, TAB_KEYS.PROFILE],
  sales_manager: [
    TAB_KEYS.SCANNER,
    TAB_KEYS.CHALLAN,
    TAB_KEYS.CHALLAN_MANAGEMENT,
    TAB_KEYS.PROFILE,
  ],
  purchase_manager: [TAB_KEYS.PURCHASES, TAB_KEYS.PROFILE],
  production_manager: [TAB_KEYS.POWER, TAB_KEYS.PRODUCTION, TAB_KEYS.PRODUCTION_OUTPUT, TAB_KEYS.PROFILE],
};

export const DEFAULT_GROUPS = [GROUP_KEYS.PROFILE];
export const DEFAULT_TABS = [TAB_KEYS.PROFILE];

// ── Helpers ─────────────────────────────────────────────────

const normalizeRoles = (roles) => {
  if (!roles) return [];
  if (Array.isArray(roles)) return roles.filter(Boolean);
  return [roles];
};

// Get all groups accessible by the given roles
export const getGroupsForRoles = (roles) => {
  const roleList = normalizeRoles(roles);
  if (roleList.length === 0) return DEFAULT_GROUPS;

  const groups = new Set();
  roleList.forEach((role) => {
    (ROLE_GROUPS[role] || DEFAULT_GROUPS).forEach((group) => groups.add(group));
  });
  return Array.from(groups);
};

// Get all tabs accessible by the given roles
export const getTabsForRoles = (roles) => {
  const roleList = normalizeRoles(roles);
  if (roleList.length === 0) return DEFAULT_TABS;

  const tabs = new Set();
  roleList.forEach((role) => {
    (ROLE_TABS[role] || DEFAULT_TABS).forEach((tab) => tabs.add(tab));
  });
  return Array.from(tabs);
};

export const getTabsForRole = (role) => getTabsForRoles(role);

export const canAccessTab = (roles, tabKey) => {
  const tabs = getTabsForRoles(roles);
  return tabs.includes(tabKey);
};

export const canAccessGroup = (roles, groupKey) => {
  const groups = getGroupsForRoles(roles);
  return groups.includes(groupKey);
};

// Returns visible groups with their accessible sub-tabs for the given roles.
// Order: groups appear in GROUP_ORDER; sub-tabs keep their order from TAB_GROUPS.
const GROUP_ORDER = [
  GROUP_KEYS.PRODUCTION,
  GROUP_KEYS.SALES,
  GROUP_KEYS.PURCHASES,
  GROUP_KEYS.MANAGEMENT,
  GROUP_KEYS.INQUIRIES,
  GROUP_KEYS.PROFILE
];

export const getVisibleGroupsForRoles = (roles) => {
  const accessibleGroups = getGroupsForRoles(roles);
  const accessibleTabs = getTabsForRoles(roles);

  return GROUP_ORDER
    .filter((groupKey) => accessibleGroups.includes(groupKey)) // Filter by group permission
    .map((groupKey) => {
      const group = TAB_GROUPS[groupKey];
      let visibleSubTabs = group.subTabs.filter((tab) => accessibleTabs.includes(tab)); // Filter by tab permission

      // Feature flag gating
      if (!FEATURE_FLAGS.SHOW_PURCHASES_MODULE) {
        visibleSubTabs = visibleSubTabs.filter((tab) => tab !== TAB_KEYS.PURCHASES);
      }

      if (visibleSubTabs.length === 0) return null;
      return { ...group, subTabs: visibleSubTabs };
    })
    .filter(Boolean);
};
