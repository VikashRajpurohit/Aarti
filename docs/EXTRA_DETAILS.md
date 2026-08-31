# Extra Details

Implementation history, fix records, known issues, open questions, and pending work. Read `FEATURES.md` for what the app does and `ARCHITECTURE.md` for how it's built; this file explains **why it looks the way it does** and what's still open.

## Implementation History (chronological summary)

### Foundation and modules

- **Supabase setup**: app moved to project `kwsubbcefpmzbctgtjnu`; tables, RLS, and Edge Functions were created/adjusted largely through Supabase MCP (which is why local migrations are incomplete); operational test data and non-admin users were cleaned up on request.
- **Roles**: `admin`, `general_manager`, `sales_manager`, `purchase_manager`, `production_manager`; multi-role support via `profiles.roles`; access centralized in `roleTabs.js`; GM was given production access including shift end/restart.
- **Admin user management**: create-user and password-reset Edge Functions, disable/enable flow, multi-role assignment UI; self-service password change was removed by request.
- **Challans/QR**: create → scan → depart → soft delete → PDF/Excel export; admin sees deleted/older departed challans; non-admins see departed for departure day + 2; offline-first scanning (optimistic local update, AsyncStorage persistence, background sync queue, foreground/interval retry, dedupe guard).
- **Raw materials**: shift-based entries; initial materials LL, LD, PFB, SLI, Extra; rename/disable/enable; creator edits open shift; creator/Admin/GM end; Admin/GM restart via RPC.
- **Production output**: four categories (stretch, bubble, pouch, baby) with category-specific math; category accordion UI; same shift rules as raw materials.
- **Power**: cut/in events with past-only timestamps, ordering validation, and downtime in reports.
- **Website/inquiries**: inquiry form (party name, mobile, email, requirements) → `website_inquiries`; visit tracking with unique `visitor_id`; admin Inquiries tab with new-inquiry badge and auto-mark-seen; statuses new/seen/contacted/quoted/closed; website theme management from mobile.
- **Reports**: admin tab with presets, sections (Overview, Input/Output, Insights, Production, Raw, Sales, Power, Purchases/Stock), charts, summary cards, and expandable daily breakdowns.
- **Logs**: `activity_logs` across all modules with labels/icons; consecutive challan item-adds grouped for readability.
- **Backup**: admin-only ZIP export (CSV + JSON + auth users + manifest + restore script) with native share.
- **Refresh/UX reliability**: `RefreshBusContext` + `useRefreshOnFocus`; date-only helpers fixed future dates, selection drift, skipped days, and iOS picker apply-on-Done.

### Reports accuracy + date selection fix (implemented 2026-07-02)

The client reported that every report section showed "incorrect data" and date selection "worked like hell". Investigation (via Supabase MCP) reframed it — **the aggregation math was correct and the DB was simply dormant** (latest rows: production ≤ 03-25, raw ≤ 03-26, power ≤ 03-29, departed challans ≤ 04-29, `purchase_entries` empty), plus several real defects that made correct-but-empty output look broken:

1. **Date off-by-one on non-IST devices** — "today" and the applied picked day mixed IST instants with device-local conversion. Fixed model: **"today" = IST business day** (`getTodayIST()`), but the **picker stays fully device-local** — seeded with `fromDateOnlyString(getTodayIST())` and read back with `toDateOnlyString(picked)`, which round-trips exactly in every timezone. (A first attempt converting the picked date through IST re-introduced an off-by-one east of IST and was corrected.)
2. **Stock structurally broken** with zero purchases — `getStockBalance` rebuilt to return `{ hasPurchases, materials[] }` (cumulative balance) and the UI shows a "no purchase data yet" state.
3. **Stray Power cards** rendered inside the Production and Raw report sections (copy-paste artifact) — removed.
4. **Misleading defaults** — default range changed Today → Last 7; empty sections now name the active range.
5. **53 emoji `console.log`s** across the report path — removed. All queries capped at `REPORT_ROW_LIMIT = 10000`.

Ground truth was hand-verified against live rows (25-Mar production = 24 stretch boxes / 904 kg; 29-Apr sales = 2 challans / 13 boxes / 6425 pcs / 86.41 kg) and a SQL harness was checked in at `docs/reports_verification.sql`.

**Ops follow-up (still open):** the DB has been idle since April. If the client believes data is still being entered, confirm the installed build actually points at `kwsubbcefpmzbctgtjnu` (no older APK / different project).

### Scanner performance (commit `dcef803`)

Scan hot-path optimized: synchronous state mirroring via `challansRef` (no dropped boxes on rapid scans), a debounced (700 ms) write-behind flush replacing per-scan persistence + refresh emits, memoized reversed item list, synchronous duplicate lookup, and FlatList perf props. **Do not reintroduce per-scan persistence or refresh emits.**

### Full UI/UX overhaul (2026-07-03)

Client was unhappy with inconsistent title bars (0–62 px header padding variance, mixed title sizes), 3 stacked horizontal scroll strips in Reports, cramped 10 px report tables, and zero tablet/landscape support (tablet users attach OTG keyboards). All 14 screens were refactored onto the shared system described in `ARCHITECTURE.md` (ScreenHeader, AppTextInput, AppModal, FilterPills, DataTable, StatCard, EmptyState, DateRangeSelector, `useResponsiveLayout`, radii/iconSizes/sizes tokens, SafeAreaProvider). Also fixed in the same pass:

- Camera kept running after switching bottom tabs (no `active` gating; tabs never unmount screens) — now paused on blur/background.
- Reports gained the custom from–to date range (`CUSTOM_RANGE:from:to`, 90-day clamp); the service layer already supported arbitrary ranges.
- `colors.border.medium` was referenced but undefined (border silently fell back to black).
- Uncapped tablet spacing scale (2.7× inflation) — now `min(w,h)`-based, capped 1.25×.
- Core RN `SafeAreaView` (a no-op on Android) replaced with real insets.
- Stray render-time `console.log` in `App.js`; mixed StatusBar APIs standardized.

The whole overhaul is OTA-safe on runtimeVersion `1.1.1` (portrait stays locked until the Stage 2 build below).

### Space-efficient nav — custom "squeeze-rail" bottom bar (2026-07-05, v1.2.0 build)

Operators lost too much vertical space to nav chrome: every grouped screen stacked **two** rows — the bottom group tabs *and* a top segment control (`TabGroupScreen`) — plus a tall header with stat "chips". On small phones the Scanner's fixed flex split overflowed. Reworked in one pass (ships in the v1.2.0 native build, since it adds native deps):

- **New custom bottom bar** `src/components/BottomNav.js`, passed to `Tab.Navigator` via `tabBar`. Merges both nav levels: Browse state (all groups) → Focus state (tap a multi-sub-tab group: the other groups **hide** and its sub-tabs fill the bar as a **segmented control** with a spring-driven sliding indicator beside the active-group pill; tap the pill to collapse). The old top segment control is gone. (First drafted as a "squeeze-rail" that shrank the other groups; changed on client feedback — hiding them gives the sub-tabs full width and a cleaner tab feel.)
- **State lift** `src/context/NavContext.js` (`useNav`, `getSubTab`) holds sub-tab-per-group + expanded; the active *group* stays in React Navigation. `TabGroupScreen` was gutted to just render the active sub-tab from context (keeps `refreshSignal` + `navigateToTab`).
- **Header slimming**: `ScreenHeader` `verticalPad` md→sm; removed `chips` + redundant subtitles from Production Output, Raw Material, Power, Purchases (chips were already null-guarded). `hasSegmentBar` is now always false (header pays its own top inset). ~90 px reclaimed at the top.
- **Scanner fix**: removed the in-camera "SCANNING"/"Align QR" badges, slimmed the list header to "Scanner" + count (kept Manual/Clear), dropped camera `minHeight` 300→200, and set `listSection` `paddingBottom: tabBarHeight` so "Clear All" clears the floating bar (it was previously hidden behind the tab bar).
- **Deps/build**: `react-native-reanimated@3.10.1` + `expo-haptics@13.0.1` (`expo install`), reanimated Babel plugin added last, bar animated with `FadeIn*`/`LinearTransition` and haptics on press (respects reduce-motion). `useResponsiveLayout.tabBarHeight` reconciled to `tabBarBase + max(insets.bottom, sm)` to match the bar exactly.

## Pending Work

### Stage 2 native build (v1.2.0) — code done, APK not yet built

This build now carries **both** the dormant landscape unlock **and** the squeeze-rail bottom-nav redesign (above). Current state of the code as of 2026-07-05:

- `app.json`: `orientation` is already unlocked (the `"portrait"` line is commented out); `version`/`runtimeVersion` bumped to `1.2.0`, `android.versionCode` 1 → 2, `ios.buildNumber` "1" → "2". (The earlier "3→4 / 2→3" note was stale — actual codes were 1.)
- `expo-haptics@13.0.1` + `react-native-reanimated@3.10.1` are now installed (`expo install`); the optional-require pattern in `DateNavigator`/`LoginScreen`/production screens can stay but haptics now actually fire.
- **Remaining:** confirm `android.versionCode`/`ios.buildNumber` are higher than the last published EAS build (EAS may use remote versioning), then `yarn build:production`, distribute the APK, and resume OTA updates on runtimeVersion `1.2.0`. Do NOT OTA this JS onto an old `1.1.x` binary — reanimated/haptics are native.

### Deferred security/backend items (need go-ahead — production DB / Edge Function changes)

- **User delete leaves the auth account alive** (only the `profiles` row is deleted; credentials still work). Needs a `delete-user` Edge Function (service role `auth.admin.deleteUser`) or switching delete → disable-only.
- **`site_config` RLS is `USING (true)`** — any signed-in role can rewrite the public website config via the REST API. Restrict to `is_admin()`.
- Supabase advisor hygiene: revoke `anon` EXECUTE on `is_*` helpers and `restart_*_shift` RPCs (they self-check roles internally, so exposure-surface only); pin `search_path = public` on `is_purchase_manager`, `set_updated_at`, `set_challan_status_timestamps`; enable leaked-password protection in Auth settings; consider rate-limiting the public website insert policies.

### Known issues / accepted trade-offs (from the 2026-07-02 QA review)

Resolved in code at that time: broken sub-tab navigation buttons (H1 → `TabGroupContext`), role-less sessions on profile-fetch failure (H3 → retry + fail login), unbounded challan fetch (H4 → limit 3000, real pagination still TODO), missing refresh emits on shift/purchase saves (M1/M2), 700 ms scanner dedupe (M4 → 3000 ms), power event recording screen-open time (M5 → "now at submit"), conditional hooks in TabGroupScreen (M9), raw duplicate-challan Postgres error (M10), untrimmed login email (L2).

Still open (needs product decision or larger change):

- **M3** Duplicate focus fetches — each screen still loads 2–3× on focus (mount effect + `useRefreshOnFocus` + `refreshSignal`); refactor to a single trigger.
- **M6** Power cut/in ordering is client-side only — two devices can both record "cut"; needs a DB trigger/RPC.
- **M7** Stock balance skips legacy name-keyed usage rows and inactive materials → stock can be overstated.
- **M8** Soft-deleting a departed challan retroactively removes it from historical sales totals — confirm intended behavior.
- **M11** Offline scope — only item scans are queued; challan create/depart are network-direct and fail offline.
- **M12** Date pickers cap "today" with the device clock, not IST (day-off-by-one on wrongly-configured devices).
- **L-items**: sync queue retries forever without backoff (L7); user search doesn't match email (L8); `last_login` actually means "last active" (L9); downtime pairing ignores range-boundary-spanning cuts (L10); saving output writes zero rows for untouched products (L11); `qrParser` field-shift on empty QR fields (L12); pieces input uses `defaultValue` and can show stale counts (L5); Power header totals only cover the last 200 events (L6); departed-visibility window uses device-local time (L3).

### Behavior questions to confirm with the client

1. Admin can't edit others' in-progress shifts (but can end/restart them) — intended?
2. Night shift entry is blocked until the day shift is ended for non-admins — what happens on a day with no day shift?
3. Purchases date navigation is open to all purchase managers (no `canChangeDate` gate like production) — intended asymmetry?
4. Should deleting a departed challan remove it from historical sales totals (M8)?

## Operational Notes

- **Supabase project**: `https://kwsubbcefpmzbctgtjnu.supabase.co` — service-role key only in Edge Function env vars, never in app/website code.
- **EAS project**: `e38f88a5-37ce-4cb4-b57c-12479156de35` (`https://expo.dev/accounts/rvg24/projects/aarti-polymers`). Channels: `preview`, `production`. Current runtimeVersion: `1.1.1`.
- **Backup caveat**: Supabase never exports password hashes; after a restore, users need temporary passwords/reset. Keep `backup-export`'s table list in sync when adding tables.
- **Schema source of truth**: the live Supabase project, not `supabase/migrations/` (most changes were applied via MCP).
- **Report verification**: `docs/reports_verification.sql` mirrors the app's aggregation per section against raw rows — use it whenever "the numbers look wrong".
- **Tablet spacing note**: the responsive scale change (capped 1.25×, min-dimension basis) deliberately de-inflates tablet spacing versus the pre-overhaul look — flag before/after screenshots to the client on first tablet rollout.
