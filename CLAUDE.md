# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Aarti Polymers is an Expo (SDK 51 / React Native 0.74) mobile app for a polymer manufacturer's daily operations: sales challans with QR scanning, raw-material and production-output shift tracking, power-cut logging, website inquiries, reports, and user management. The primary backend is **Supabase** (auth, Postgres, RLS, RPCs, Edge Functions, realtime). A **secondary Firebase Firestore** backend (`src/config/firebaseConfig.js`) is used only for lightweight usage analytics counters — do not confuse it with the main data layer. The repo also contains a static marketing/inquiry website in `website/`.

There is no test suite, linter config, or TypeScript usage beyond `expo/tsconfig.base` — the app is plain JS (`.js`) under `src/`.

## Commands

```bash
yarn start                 # Expo dev server (Metro)
yarn android               # build + run on Android device/emulator (native)
yarn ios                   # build + run on iOS simulator (native)
yarn web                   # web preview

# EAS (cloud) builds — produce APKs
yarn build:preview         # eas build -p android --profile preview
yarn build:production      # eas build -p android --profile production

# OTA updates (expo-updates) — ship JS-only changes without a new build
yarn update:preview        # eas update --channel preview
yarn update:production     # eas update --channel production
```

Notes:
- `.npmrc` sets `legacy-peer-deps=true`; install with `yarn` (a `yarn.lock` is committed).
- `android/` and `ios/` are gitignored (CNG prebuild). EAS build profiles pin Node `20.11.1` and build release APKs.
- OTA only ships JS. Anything touching native config (`app.json` plugins/permissions, new native deps) requires a new `build:*`. `runtimeVersion` in `app.json` must match between the build and the update for OTA to apply.

## Architecture

### Providers (App.js)
The tree is `ErrorBoundary → RefreshBusProvider → AuthProvider → ChallanProvider → NavigationContainer`. `RootNavigator` shows `LoginScreen` when there's no user, otherwise the role-based `MainTabNavigator`.

### Role-based navigation is data-driven — edit `src/config/roleTabs.js`, not `App.js`
This is the single most important file to understand. Navigation uses a **two-level permission model**:
1. **Groups** (`ROLE_GROUPS`) = bottom tabs. Each group is one `Tab.Screen`.
2. **Sub-tabs** (`ROLE_TABS`) = shown inside the **custom bottom bar** (`src/components/BottomNav.js`), not a top segment control.

`App.js` calls `getVisibleGroupsForRoles(roles)` to build the tab bar from this config; `SCREEN_MAP` maps each `TAB_KEY` to its screen component. To add/move a screen or change who sees what, change `roleTabs.js` (`TAB_KEYS`, `TAB_GROUPS`, `ROLE_GROUPS`, `ROLE_TABS`, `SUB_TAB_META`) and add the screen to `SCREEN_MAP` in `App.js`. Users can hold **multiple roles** (`profiles.roles` array); access is the **union** across roles. The `SHOW_PURCHASES_MODULE` feature flag in this file gates the Purchases module.

### Custom bottom navigation — `src/components/BottomNav.js`
`MainTabNavigator` passes `BottomNav` to `Tab.Navigator` via the `tabBar` prop. It replaces both the old default tab bar *and* the old top segment control. Two states: **Browse** (all groups as icon+label) and **Focus** (tap a multi-sub-tab group → the other groups are hidden and the group's sub-tabs fill the bar as a **segmented control** with a spring-driven sliding indicator, beside the active-group pill; tap the pill to collapse back to Browse). Single-sub-tab groups (Purchases/Inquiries/Profile) never expand. Group selection stays in React Navigation; **sub-tab + expanded state live in `src/context/NavContext.js`** (`useNav`, `getSubTab`) — `TabGroupScreen` reads the active sub-tab from there and just renders that screen. Child screens still jump siblings via `useTabGroup().navigateToTab` (which now calls `setSubTab`). The bar stays `position:absolute`, so every screen keeps self-padding with `useResponsiveLayout().scrollBottomPadding` (its `tabBarHeight` must match the bar). Animated with `react-native-reanimated`; haptics via `expo-haptics`; both are **native deps → require a `build:*`, not OTA** (shipped in the v1.2.0 build).

### Auth & session (`src/context/AuthContext.js`)
Supabase email/password login. Profile, primary `role`, `roles[]`, `disabled`, and `full_name` come from the `profiles` table. Disabled/deleted users are force-logged-out; `last_login` is updated on a heartbeat while active.

### Cross-screen refresh — three coordinated mechanisms
Screens reload data via `useRefreshOnFocus(refreshFn, deps, domain, refreshSignal)` (`src/hooks/useRefreshOnFocus.js`), which triggers on **any** of:
1. **Navigation focus** (`useIsFocused`).
2. **`refreshSignal`** — `TabGroupScreen` passes an incrementing `refreshSignal` prop to the active sub-tab screen when the group is focused or the sub-tab is switched.
3. **Refresh bus** (`src/context/RefreshBusContext.js`) — after a mutation, call `emitRefresh(domain)`; subscribed screens for that domain refetch. Use this so a write on one screen updates others.

When adding a screen that shows server data, wire it through `useRefreshOnFocus` and emit the relevant domain after writes rather than ad-hoc reloads.

### Offline-first challans (`src/context/ChallanContext.js` + `src/services/storage.js`)
QR scanning must feel instant and work offline:
- Active challan id is kept in AsyncStorage (`@active_challan_id`); challans are cached locally.
- Scans update local state immediately, persist to AsyncStorage, and enqueue to a background sync queue (`@challan_sync_queue`) that flushes to Supabase. **Do not block the scan UI on network.**
- The same QR is briefly de-duplicated to avoid double scans.
- **Delete is soft delete** (`status = 'deleted'`), never a hard delete. Non-admins see departed challans only for departure day + 2 days; admins see all.

### Supabase backend (`src/config/supabase.js`, `supabase/`)
- Client uses the **anon key only** with AsyncStorage session persistence. The **service-role key must never appear in app or website code** — it lives only in Edge Function env vars.
- **Edge Functions** (`supabase/functions/`) handle privileged ops: `create-user`, `update-user-password` (both admin-only, verify caller JWT + admin role), and `backup-export` (admin-only ZIP of all tables; auth users exported without password hashes). Called from `src/services/authService.js` and `backupService.js`.
- **RPCs** referenced by the app: `restart_raw_material_shift`, `restart_production_shift` (Admin/GM only), `website_unique_counts`, `is_admin`, `is_general_manager`.
- Only one migration is checked in (`supabase/migrations/20260324_...sql`); much of the schema/RLS was applied out-of-band via Supabase MCP, so the local migrations are **not** a complete schema source of truth. See `docs/ARCHITECTURE.md` for the full table list and RLS intent.

### Layered code organization (`src/`)
- `services/` — all data access (one service per domain: `productionService`, `productionOutputService`, `reportService`, `purchaseService`, `logService`, `authService`, `backupService`, `sessionService`, `suggestionService` — all Supabase). `analyticsService` is the exception: it writes app-open / challan-created / QR-scan counters to **Firebase Firestore** (called from `App.js` `trackAppOpen` and `ScannerScreen` `incrementQRScanCount`), not Supabase. Screens should call services, not the Supabase client directly.
- `context/` — global state (auth, challans, refresh bus).
- `models/` — `Challan`, `ScannedItem`: status, computed totals, and Supabase JSON ↔ object mapping.
- `utils/` — `qrParser`, `pdfExport`/`excelExport` (challan exports), `reportDates` (range presets), and **`dateOnly`**.
- `theme/` — `colors`, `typography`, `spacing`, `radii`, `responsive` (also exports `iconSizes`, `sizes`), `animations`, with an `index.js` barrel. Style from these, not hardcoded values.

## Conventions

- **Layout: use `useResponsiveLayout()`** (`src/hooks/useResponsiveLayout.js`) for tablet/orientation-aware layout (`isTablet`, `columns`, `contentMaxWidth`, `horizontalPadding`, `scrollBottomPadding`, `insets`) — never module-scope `Dimensions.get('window')`. Safe areas come from `react-native-safe-area-context` insets, never `Platform.OS` padding constants.
- **Headers: every screen uses the shared `ScreenHeader`** component; it applies its own top safe-area inset (`useTabGroup().hasSegmentBar` is now always `false` — sub-tabs moved to the bottom bar). Keep headers compact (title + icon; drop subtitles/`chips` on operational screens). Forms use `AppTextInput` (with `returnKeyType`/ref focus-chaining), modals use `AppModal`, filters use `FilterPills` (wrapping — never a horizontal ScrollView), tables use `DataTable` (fit-to-width, priority columns, detail modal).
- **Dates: use `src/utils/dateOnly.js` helpers** for shift/report dates. Shift and date logic deliberately avoid `Date` timezone drift; future dates are blocked, and the iOS date picker applies only on "Done". Don't introduce raw `new Date()` arithmetic into date-only flows.
- **Audit everything via `logService.logEvent`** — challan, production, raw-material, power, inquiry, user, theme, and backup actions all write `activity_logs` rows (namespaced action keys like `challan.*`, `production.shift.*`, `power.cut`). Add a log call for new auditable actions.
- **Reports read from raw tables and aggregate client-side** (`reportService.js`): production from `production_shifts`+`production_outputs` (day+night combined), raw materials from `raw_material_entries`, sales from `challans` where `status='departed'`, power downtime from chronological `power_events` pairs.
- Production output has 4 category shapes (`stretch`/`bubble` = units × avg weight, `pouch` = dynamic piece lines, `baby` = boxes); handle the category when touching `ProductionOutputScreen` / `productionOutputService`.
- Wrap risky screen subtrees in `ErrorBoundary` (already applied per sub-tab in `TabGroupScreen`).

## Further docs

`docs/` is a maintained developer handoff pack of exactly three files: `FEATURES.md` (feature catalog + user flows), `ARCHITECTURE.md` (navigation/state/UI system, project layout, Supabase backend, build & OTA process), and `EXTRA_DETAILS.md` (implementation history, fix records, known issues, pending work). Plus `reports_verification.sql`, a ground-truth SQL harness for report numbers. Keep these three in sync when behavior changes — do not add new doc files.
