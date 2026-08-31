# Features

Everything the Aarti Polymers app does, module by module: who can use each feature, which screens implement it, which Supabase objects back it, and how the user-facing flow works.

## Quick Summary

Aarti Polymers is an Expo React Native operational app backed by Supabase. It manages:

- Sales challans with QR scanning, scanned box details, departed challan visibility rules, soft delete, and PDF/Excel exports.
- Raw material usage by daily shift.
- Production output by daily shift across Stretch Film, Bubble Roll, Pouch, and Baby Product categories.
- Power cut and power in events with date-time validation.
- Raw material purchases and stock-style balance reporting (feature-flag controlled, currently enabled).
- Website inquiries, unique visitor analytics, and website theme management.
- User management, multi-role access, admin password reset, disable/enable users, activity logs, reports, and admin backup export.

A static marketing website with a Supabase-backed inquiry form lives in `website/`.

## Feature Matrix

| Feature | Status | Roles | Main screens/files | Backend surface |
| --- | --- | --- | --- | --- |
| Authentication and profile loading | Active | All users | `SplashScreen`, `LoginScreen`, `ProfileScreen`, `AuthContext` | `auth.users`, `profiles` |
| Multi-role access control | Active | Admin-managed | `roleTabs.js`, `AdminUsersScreen` | `profiles.role`, `profiles.roles` |
| User management | Active | Admin | `AdminUsersScreen` | `profiles`, `create-user` |
| Admin password reset | Active | Admin | `AdminUsersScreen`, `authService` | `update-user-password` |
| Disable/enable users | Active | Admin | `AdminUsersScreen`, `AuthContext` | `profiles.is_disabled` |
| Sales QR scanner | Active | Admin, Sales Manager | `ScannerScreen` | `challans` |
| Offline-first challan scanning sync | Active | Admin, Sales Manager | `ChallanContext`, `storage.js` | `challans.items` |
| Challan details | Active | Admin, Sales Manager | `ChallanScreen` | `challans` |
| Challan management/export | Active | Admin, Sales Manager | `ChallanManagementScreen`, export utilities | `challans` |
| Departed/deleted challan visibility | Active | Admin, Sales Manager | `ChallanManagementScreen` | `challans.status`, soft-delete fields |
| Raw material usage by shift | Active | Admin, GM, Production Manager | `ProductionScreen` | `raw_material_entries` |
| Raw material type management | Active | Admin, GM | `ProductionScreen`, `productionService` | `raw_material_types`, `activity_logs` |
| Production output by shift | Active | Admin, GM, Production Manager | `ProductionOutputScreen` | `production_shifts`, `production_outputs` |
| Production product management | Active | Admin, GM | `ProductionOutputScreen`, `productionOutputService` | `production_product_types`, `activity_logs` |
| Power cut/in events | Active | Admin, GM, Production Manager | `PowerScreen` | `power_events`, `activity_logs` |
| Purchases | Enabled, feature-flag controlled | Admin, Purchase Manager | `PurchasesScreen`, `purchaseService` | `purchase_entries`, `raw_material_types` |
| Stock-style purchase vs raw usage reporting | Enabled through Reports feature flag | Admin | `ReportsScreen`, `reportService` | `purchase_entries`, `raw_material_entries` |
| Reports with charts/tables | Active | Admin | `ReportsScreen`, `reportService` | Challans, production, raw, power, purchases |
| Custom date-range report filter | Active | Admin | `DateRangeSelector`, `reportDates.js` | Same report tables |
| Website inquiries | Active | Admin | `InquiriesScreen`, `website/inquiry.html` | `website_inquiries` |
| Inquiry badge/status handling | Active | Admin | `App.js`, `InquiriesScreen` | `website_inquiries`, `activity_logs` |
| Website unique visitor analytics | Active | Admin | `InquiriesScreen`, website scripts | `website_visits`, `website_unique_counts` |
| Website theme/config management | Active | Admin | `InquiriesScreen`, `website/theme.js` | `site_config`, `activity_logs` |
| Activity logs/audit trail | Active | Admin | `LogsScreen`, `logService` | `activity_logs` |
| Admin backup ZIP download | Active | Admin | `ProfileScreen`, `backupService` | `backup-export` |
| Global refresh bus/focus refresh | Active | App-wide | `RefreshBusContext`, `useRefreshOnFocus` | No dedicated table |
| Date-only navigation/picker fixes | Active | Production, Raw, Purchases, Reports | `DateNavigator`, `dateOnly.js` | No dedicated table |
| Responsive tablet/phone UI, portrait + landscape | Active (landscape unlocks with the next native build) | All users | `useResponsiveLayout`, `ScreenHeader`, shared components | No dedicated table |

## Auth And Roles

Purpose:

- Authenticate users with Supabase email/password login.
- Load app profile data, roles, disabled status, full name, and last-login metadata.
- Support multiple roles per user through `profiles.roles`.

Current roles: `admin`, `general_manager`, `sales_manager`, `purchase_manager`, `production_manager`.

Key behavior:

- Login normalizes email (trim + lowercase) before Supabase auth.
- Disabled/deleted profiles are forced out of the app.
- Role and tab access is centralized in `src/config/roleTabs.js`; tab access is the union across a user's roles.
- The app updates `profiles.last_login` periodically while active (a heartbeat — effectively "last active").
- Purchases is additionally controlled by `FEATURE_FLAGS.SHOW_PURCHASES_MODULE`, currently `true`.

Current access:

- Admin sees all enabled modules.
- General Manager sees Production, Raw Material, Power, and Profile.
- Sales Manager sees Scanner, Challan Details, Challan Management, and Profile.
- Production Manager sees Production, Raw Material, Power, and Profile.
- Purchase Manager sees Purchases and Profile while `SHOW_PURCHASES_MODULE` remains true.

## Sales And Challans

Purpose: create challans, scan QR boxes, review scanned details, depart challans, export challans, and soft-delete old challans.

Access: Admin, Sales Manager.

Screens:

- `ScannerScreen`: Camera QR scanner and manual entry.
- `ChallanScreen`: Active challan details, item groups, gross/net weight behavior.
- `ChallanManagementScreen`: Create, activate, depart, soft delete, PDF/Excel export.

Core flow:

1. User creates a challan number in Challan Management.
2. The challan becomes active and is stored in AsyncStorage as `@active_challan_id`.
3. Scanner parses QR data into scanned items.
4. Scanned items update local state immediately.
5. Local changes are persisted to AsyncStorage.
6. A background queue `@challan_sync_queue` syncs items to Supabase.
7. Departed challans can be exported and soft deleted.

Key behavior:

- QR scan UX is offline-friendly and does not wait for Supabase before updating UI.
- The same QR is deduped for 3 seconds so holding the phone on a scanned box does not pop the destructive "Remove Box?" prompt.
- The camera is paused (`CameraView active={false}`) whenever the Sales tab loses focus or the app goes to background — bottom tabs never unmount their screens, so this gating is what stops the camera when switching tabs.
- Non-admin users see departed challans only for departure day plus the next two days.
- Admin can see active, departed, and deleted challans (deleted show a warning banner).
- Delete is soft delete by setting status to `deleted`, never a hard delete.
- Sales totals in Reports use departed challans only and sum gross weight from items.
- Duplicate challan numbers show a friendly message (Postgres `23505` is mapped client-side; DB backstop is the `challans_number_active_uq` unique constraint).

## Production

Purpose: capture daily production-side activity — raw material usage, finished output, and power events — without full stock management.

Access: Admin, General Manager, Production Manager.

### Raw Materials (`ProductionScreen`)

Backend: `raw_material_types`, `raw_material_entries`, `restart_raw_material_shift(entry_id uuid)`, `activity_logs`.

Core flow:

1. User selects a date. Future dates are blocked; non-admin/non-GM users stay on today.
2. Production users enter raw material quantities for the current shift (day/night).
3. Saving creates or updates one shift entry.
4. End Shift locks the entry; creator, Admin, and General Manager can end.
5. Admin or General Manager can restart ended shifts through RPC.

Key behavior:

- Raw material names are strings and can be renamed later; materials can be added, renamed, disabled, and enabled.
- Disabled materials remain in historical entries and can be re-enabled.
- Date navigation uses date-only helpers to avoid timezone drift; iOS picker applies only on Done.

### Production Output (`ProductionOutputScreen`)

Backend: `production_product_types`, `production_shifts`, `production_outputs`, `restart_production_shift(shift_id uuid)`, `activity_logs`.

Categories:

- `stretch` (Stretch Film): output is boxes; product has average weight; total weight = boxes × average weight.
- `bubble` (Bubble Roll): output is rolls; total weight = rolls × average weight.
- `pouch`: dynamic box / pieces-per-box lines; total pieces.
- `baby` (Baby Product): simple box/unit output.

Key behavior:

- Products support add, rename, disable, enable.
- Shift behavior matches raw materials (creator edits open shift; creator/Admin/GM end; Admin/GM restart via RPC).
- Reports combine day and night shifts into daily production totals.

### Power (`PowerScreen`)

Backend: `power_events`, `activity_logs`.

Core flow and validation:

1. User records a Power Cut event; the next event must be Power In.
2. Event date/time must be in the past; Power In cannot be before the matching Power Cut; duplicate same-direction events are blocked.
3. The event records "now" at submit time unless the operator explicitly picked a date/time.
4. Each event is logged.

Reports include power cut count, power in count, and downtime minutes computed from chronological cut/in pairs.

## Purchases And Stock

Purpose: capture raw material purchases and compare purchased quantity against usage for stock-style reporting.

Access: Admin, Purchase Manager. Feature-flag controlled via `SHOW_PURCHASES_MODULE` (currently `true`).

Screens: `PurchasesScreen`, plus the Purchases and Stock sections in `ReportsScreen`.

Key behavior:

- Purchase entries are date-based and material-based; purchases reuse `raw_material_types` as the material catalog.
- Stock balance = cumulative purchases − cumulative raw material usage as of a date.
- Stock shows a "no purchase data yet" state when `purchase_entries` is empty (balance cannot be computed meaningfully).

## Reports

Purpose: admin summaries for production, raw materials, sales, power, purchases, and stock-style balances.

Access: Admin. Screen/service: `ReportsScreen`, `reportService`.

Date filtering:

- Preset ranges: Today, This Week, Last 7/15/30 days, This Month.
- Single-day pick (`CUSTOM_DATE:YYYY-MM-DD`).
- Custom from–to range (`CUSTOM_RANGE:YYYY-MM-DD:YYYY-MM-DD`, clamped to 90 days) via the compact `DateRangeSelector` control.

Sections: Overview, Input/Output, Insights, Production, Raw Materials, Sales, Power, and (flag-gated) Purchases and Stock.

Key behavior:

- Sales only includes departed challans; sales date uses `status_changed_at` with fallback to `created_at`.
- Production totals combine day and night shifts.
- Raw material totals preserve historical names through stored entry JSON fallback.
- Daily breakdowns default to the latest 7 rows and can expand to the full selected range.
- Tables are fit-to-width (`DataTable`) — on phones the priority columns are shown and tapping a row opens a labeled detail card; tablets show all columns. Nothing scrolls horizontally.
- All charts size from the live window width and re-layout on rotation.

## Website And Inquiries

Purpose: collect website inquiries into the app, track unique website visitors, and manage the website theme from mobile.

Access: Admin. Mobile screen: `InquiriesScreen`. Website files: `website/index.html`, `website/inquiry.html`, `website/theme.js`.

Backend: `website_inquiries`, `website_visits`, `site_config`, `website_unique_counts(today_start, week_start)`, `activity_logs`.

Core flow:

1. Website visitor submits party name, mobile, email, and requirements.
2. Website inserts a row into `website_inquiries`; mobile admin sees a badge for new inquiries (realtime subscription in `App.js`).
3. Opening Inquiries marks new rows as seen automatically.
4. Admin can update status: new → seen / contacted / quoted / closed. Status changes are logged.
5. Visitor analytics count distinct `visitor_id`, not raw hits; top cities over 7 days are shown.
6. Website theme changes update `site_config` and apply on the live website instantly.

## Admin And Audit

Purpose: operational control over users, logs, and backups.

Access: Admin. Screens/services: `AdminUsersScreen`, `LogsScreen`, `ProfileScreen`, `authService`, `backupService`, `logService`.

Key behavior:

- Admin creates users through the `create-user` Edge Function and resets passwords through `update-user-password`.
- Admin can enable/disable users, except protected self/other-admin paths.
- Users can hold multiple roles; disabled users are prevented from staying logged in.
- Logs cover challans, production, raw materials, power, inquiries, website theme, user management, and backup actions; the Logs screen groups consecutive challan item-add rows.
- Backup download (Profile screen, admin only) calls `backup-export` and produces a ZIP with CSVs, Supabase JSON, auth-user export, manifest, and a restore script, then opens the native share sheet. Logged as `backup.create`.

## App Reliability And UX

Main files: `ChallanContext`, `RefreshBusContext`, `useRefreshOnFocus`, `dateOnly.js`, `DateNavigator`, `useResponsiveLayout`.

Key behavior:

- QR scanning uses optimistic local state, a debounced write-behind flush, and a background sync queue.
- Screens refresh automatically on navigation focus, sub-tab switch, and refresh-bus events after mutations.
- Date-only helpers avoid one-day drift; "today" is always the IST business day regardless of device timezone; the picker stays fully device-local and round-trips exactly.
- Every screen shares one `ScreenHeader`; forms chain focus with the keyboard (Next moves to the next field, the last field submits) for OTG/hardware keyboard users; layout adapts to tablets (content max-width, 2-column grids) and landscape via `useResponsiveLayout`.

## Backend Surface By Feature

| Feature area | Tables | Edge Functions/RPCs |
| --- | --- | --- |
| Auth/users | `profiles`, `auth.users` | `create-user`, `update-user-password` |
| Sales/challans | `challans`, `activity_logs` | None currently required |
| Raw materials | `raw_material_types`, `raw_material_entries`, `activity_logs` | `restart_raw_material_shift` |
| Production output | `production_product_types`, `production_shifts`, `production_outputs`, `activity_logs` | `restart_production_shift` |
| Purchases/stock | `purchase_entries`, `raw_material_types`, `raw_material_entries` | None currently required |
| Power | `power_events`, `activity_logs` | None currently required |
| Reports | Operational tables above | `website_unique_counts` for visitor analytics |
| Website/inquiries | `website_inquiries`, `website_visits`, `site_config`, `activity_logs` | `website_unique_counts` |
| Backup | Exported operational tables plus auth users | `backup-export` |
