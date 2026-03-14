# qRemote — Codebase Improvement Plan

> A prioritized, actionable plan covering architectural improvements, maintainability,
> performance, design gaps, and missing features for the qRemote React Native (Expo) app.
>
> **Codebase snapshot:** ~23 000 LOC across 70+ source files · Expo SDK 54 · React Native 0.81 · TypeScript (strict)

---

## Table of Contents

1. [Architectural Improvements](#1-architectural-improvements)
2. [Maintainability Improvements](#2-maintainability-improvements)
3. [Performance Improvements](#3-performance-improvements)
4. [Design Gaps](#4-design-gaps)
5. [Missing Features](#5-missing-features)
6. [Priority Matrix](#6-priority-matrix)

---

## 1. Architectural Improvements

### 1.1 Adopt Feature-Based Folder Structure

**Current state:** Layer-based layout (`components/`, `services/`, `context/`, `hooks/`, `utils/`).
Every component lives in a flat `components/` directory (24 files), every service in `services/`, etc.

**Problem:** As the app grows, files that logically belong together (e.g. torrent card, torrent detail, torrent API, torrent context) are scattered across four directories. Discoverability and code ownership suffer.

**Recommendation:**
```
src/
├── app/                   # Expo Router file-based routes (unchanged)
├── features/
│   ├── torrent/
│   │   ├── components/    # TorrentCard, TorrentDetails, ExpandableTorrentCard, …
│   │   ├── hooks/         # useSpeedTracker, useSpeedHistory
│   │   ├── api/           # torrents.ts, sync.ts
│   │   ├── context/       # TorrentContext.tsx
│   │   └── types.ts
│   ├── transfer/
│   │   ├── components/    # SpeedGraph, CircularProgress
│   │   ├── api/           # transfer.ts
│   │   └── context/       # TransferContext.tsx
│   ├── server/
│   │   ├── components/    # ServerForm (shared between add & edit)
│   │   ├── api/           # auth.ts, application.ts
│   │   └── context/       # ServerContext.tsx
│   ├── settings/
│   └── logs/
├── shared/
│   ├── components/        # Toast, InputModal, AnimatedButton, SkeletonLoader, …
│   ├── constants/
│   ├── hooks/
│   ├── services/          # storage.ts, apiClient, server-manager, color-theme-manager
│   ├── i18n/
│   └── utils/
└── types/                 # Global API types
```

**Effort:** Medium · **Impact:** High

---

### 1.2 Replace Context + Polling with TanStack Query (React Query)

**Current state:** `TorrentContext`, `TransferContext`, and `ServerContext` each implement their own polling loops, background recovery, error thresholds, and stale-closure workarounds via `useRef`. The `rid`-based incremental sync in `TorrentContext` is reimplemented from scratch.

**Problem:**
- Duplicated data-fetching, caching, retry, and background-refetch logic across three contexts.
- Manual `setInterval` / `AppState` handling is error-prone (several `useEffect` dependency issues already exist).
- No request deduplication, no stale-while-revalidate, no optimistic updates.

**Recommendation:**
- Introduce **TanStack Query v5** for all server-state (torrents, transfer info, logs, categories, tags, trackers, files, peers).
- Keep **Context** (or migrate to **Zustand**) only for client-state: theme preference, selected server, UI toggles, toast queue.
- TanStack Query's `refetchInterval`, `refetchOnWindowFocus`, `retry`, and `onlineManager` (via `@react-native-community/netinfo`) replace all hand-rolled polling.

**Effort:** High · **Impact:** Very High

---

### 1.3 Centralize the API Client Configuration

**Current state:** Every API module (`transfer.ts`, `torrents.ts`, `auth.ts`, etc.) repeats `const API_VERSION = 'v2'` and directly imports the singleton `apiClient`. The client stores `apiTimeout` but never uses it, captures a `csrfToken` but never sends it, and applies retry logic (`withRetry`) only to `GET` requests.

**Recommendation:**
- Move `API_VERSION` to a single constant in `client.ts` and expose it on the client instance.
- Actually use `apiTimeout` or remove it.
- Decide on a retry strategy for POST requests (at least idempotent ones like pause/resume) or document why they are excluded.
- Implement CSRF token injection if the server version supports it, or remove dead code.
- Support the new **API-key authentication** (qBittorrent v5.1+) as an alternative to cookie-based auth.

**Effort:** Low-Medium · **Impact:** Medium

---

### 1.4 Extract a Shared Server Form Component

**Current state:** `app/server/add.tsx` (665 lines) and `app/server/[id].tsx` (702 lines) contain nearly identical form fields, validation, `stripProtocol` helper, debug panel, tooltip, and connection-test logic.

**Recommendation:** Extract a `<ServerForm />` component that receives `initialValues`, an `onSave` callback, and an optional `onDelete`. Both routes become thin wrappers.

**Effort:** Low · **Impact:** Medium

---

### 1.5 Introduce a Proper Error Boundary

**Current state:** No React error boundary exists. Unhandled render errors crash the app.

**Recommendation:** Add a root `<ErrorBoundary>` wrapping the `Stack` navigator. Show a friendly "Something went wrong" screen with a "Retry" button that resets navigation.

**Effort:** Low · **Impact:** Medium

---

### 1.6 Introduce a Navigation Service / Deep-Link Schema

**Current state:** Navigation is implicit through Expo Router file conventions. There is no documented URL scheme map and the `app.config.js` declares `scheme: 'qremote'` but no deep-link routes are handled.

**Recommendation:**
- Document the URL map (`qremote://torrent/<hash>`, `qremote://server/add`, etc.).
- Handle incoming deep links (e.g. `magnet:` URIs from the share sheet) to open the add-torrent flow.
- Add universal-link / App-Link support for self-hosted qBittorrent WebUI URLs.

**Effort:** Medium · **Impact:** Medium

---

## 2. Maintainability Improvements

### 2.1 Break Up Mega-Components

| File | Lines | Recommended Extraction |
|------|------:|------------------------|
| `app/(tabs)/settings.tsx` | 1 590 | Sub-screens per section (Connection, Appearance, Advanced, Danger Zone); extract `SwipeableServerItem`, `InfoRow` |
| `app/(tabs)/index.tsx` | 1 260 | Extract `AddTorrentModal`, `FilterSortBar`, `BulkActionsBar`, `QuickConnectPanel` |
| `app/(tabs)/transfer.tsx` | 1 150 | Extract `StatBox`, `SpeedLimitSection`, `QuickActionsGrid`, `QuickConnectPanel` (shared with index) |
| `app/torrent/[hash].tsx` | 1 170 | Extract `QuickTools`, `AdvancedTools`, `PeerModal`, `InfoSection` |
| `components/TorrentCard.tsx` | ~800 | Extract `TorrentContextMenu` into its own component |
| `components/TorrentDetails.tsx` | ~1 500 | Extract `StatCard`, `InfoRow`, `ToggleRow`, tab sections |

**Effort:** Medium · **Impact:** High

---

### 2.2 Eliminate Duplicated Helper Code

- `avatarColor` / `serverAddress` helpers are duplicated between `index.tsx` and `transfer.tsx`.
- `formatSize`, `formatSpeed`, `formatTime` are re-implemented inline in `TorrentDetails.tsx` and `torrent/[hash].tsx` despite existing in `utils/format.ts`.
- `stripProtocol` is copy-pasted between `server/add.tsx` and `server/[id].tsx`.
- `isNetworkError` detection logic is duplicated four times in `server-manager.ts`.

**Recommendation:** Consolidate each into a single utility and import everywhere.

**Effort:** Low · **Impact:** Medium

---

### 2.3 Complete i18n Coverage

**Current state:** `react-i18next` is set up and five locales exist, but many screens still use hardcoded English strings:

- `logs.tsx` — "Application Logs", "Peer Logs", "Not connected to a server", filter labels
- `torrent/add.tsx` — all strings
- `torrent/manage-trackers.tsx` — "Manage Trackers", "Add New Tracker", etc.
- `torrent/[hash].tsx` — tool labels, stat labels
- `transfer.tsx` — "Not Connected", "YOUR SERVERS", button labels
- `index.tsx` — "Torrent Only", "With Files", "Connect", etc.
- `onboarding.tsx` — all slide text
- `settings.tsx` — several section headers

Additionally, non-English locale files have untranslated keys still in English (e.g. `firstLastPiecePriority`, `viewLogs`, `shutdownConfirm`).

**Recommendation:**
1. Audit all screens for raw string literals; replace with `t('key')`.
2. Add missing keys to all locale files.
3. Add a CI check (e.g. `i18next-parser`) to detect missing/unused keys.

**Effort:** Medium · **Impact:** Medium

---

### 2.4 Add a Test Suite

**Current state:** Zero automated tests (no test files, no test runner configured).

**Recommendation:**
1. Add **Jest** + **React Native Testing Library** for unit/component tests.
2. Priority targets for first tests:
   - `utils/format.ts` (pure functions, easy wins)
   - `services/server-manager.ts` (critical auth/connect logic)
   - `services/api/client.ts` (interceptor behavior, retry logic)
   - `context/TorrentContext.tsx` (incremental sync merge logic)
3. Add **Detox** or **Maestro** for E2E testing of critical flows (connect, add torrent, pause/resume).
4. Integrate into CI via GitHub Actions.

**Effort:** High · **Impact:** Very High

---

### 2.5 Add ESLint, Prettier, and Strict TypeScript Rules

**Current state:** No `.eslintrc`, no `.prettierrc`. Several `eslint-disable` comments exist in-line. TypeScript strict mode is on but `any` is used liberally (~30+ occurrences in source).

**Recommendation:**
1. Add `eslint` with `@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-native`.
2. Add `prettier` with a shared config.
3. Enable `noImplicitAny` enforcement and gradually eliminate `any`:
   - `colors: any` in theme-related props → define `ThemeColors` interface
   - `error: any` in catch blocks → use `unknown`
   - `categories: { [name: string]: any }` → type the `Category` object
   - `ApplicationPreferences: { [key: string]: any }` → type against qBittorrent API
4. Add pre-commit hooks via `husky` + `lint-staged`.

**Effort:** Medium · **Impact:** High

---

### 2.6 Remove Dead Code and Unused Files

- `App.tsx` — Default Expo boilerplate, never used (entry is `expo-router/entry`).
- `app/torrent/add.tsx` — Standalone add-torrent screen with no theme, no i18n, fewer options than the modal in `index.tsx`. Appears to be legacy.
- `hooks/useDynamicColors.ts` — Placeholder returning `null`; references non-existent `colorUtils`.
- `csrfToken` in `ApiClient` — Captured but never sent.
- `apiTimeout` in `ApiClient` — Stored but never used.
- Several commented-out `console.log` statements across API modules.

**Effort:** Low · **Impact:** Low-Medium

---

### 2.7 Standardize Error Handling

**Current state:** Error handling is inconsistent:
- `auth.ts` sometimes throws, sometimes returns `{ status: 'Fails' }`.
- `storageService.getServers` swallows errors and returns `[]`; `deleteServer` lets them bubble.
- `colorThemeManager.getCustomColors` swallows errors; `saveCustomColors` re-throws.
- `log-storage.ts` has retry logic in `clearLogs` that hints at a flaky storage layer.

**Recommendation:**
1. Adopt a consistent pattern: service methods **throw** on failure; callers decide whether to show UI or swallow.
2. Define typed error classes (`NetworkError`, `AuthError`, `StorageError`) instead of string matching on `error.message`.
3. Replace `error: any` with `error: unknown` and use type guards.

**Effort:** Medium · **Impact:** Medium

---

## 3. Performance Improvements

### 3.1 Memoize Torrent List Items

**Current state:** `TorrentCard` is not wrapped in `React.memo`. The torrent list in `index.tsx` maps over a filtered/sorted array and re-renders every card on every 2-second poll tick, even when individual torrent data hasn't changed.

**Recommendation:**
1. Wrap `TorrentCard` in `React.memo` with a custom comparator on `torrent.hash`, `torrent.state`, `torrent.progress`, `torrent.dlspeed`, `torrent.upspeed`.
2. Use `useCallback` for `onPress`, `onLongPress`, and action handlers passed to cards.
3. Replace `FlatList` with `FlashList` from `@shopify/flash-list` for significantly faster list rendering (especially with 100+ torrents).

**Effort:** Low-Medium · **Impact:** High

---

### 3.2 Migrate from Animated API to Reanimated Worklets

**Current state:** Several components use the legacy `Animated` API from React Native (`Confetti`, `ContextualFAB`, `SkeletonLoader`, `AnimatedProgressBar`, `Toast`, `AnimatedButton`). `AnimatedTorrentCard` already uses Reanimated correctly.

**Problem:** Legacy `Animated` runs on the JS thread, competing with polling/rendering. Reanimated runs on the UI thread.

**Recommendation:** Migrate all animation code to `react-native-reanimated` worklets. Priority:
1. `SkeletonLoader` (visible during every load)
2. `AnimatedProgressBar` (rendered per card)
3. `Toast` (appears frequently)
4. `ContextualFAB`
5. `Confetti` (also fix the **hooks-in-loop bug** — `useRef` is called inside `Array.from`, violating Rules of Hooks)

**Effort:** Medium · **Impact:** Medium-High

---

### 3.3 Reduce Unnecessary Re-Renders in Contexts

**Current state:**
- `TorrentContext` provides a single value object recreated every render, causing all consumers to re-render even when only one field changes.
- `TransferContext` creates a new `value` object every poll interval.
- `useSpeedHistory` updates state on every `transferInfo` change (every 3 seconds), creating new arrays.

**Recommendation:**
1. Split context values into **read** and **dispatch** contexts (or use selectors via Zustand).
2. Memoize context value objects with `useMemo`.
3. Throttle `useSpeedHistory` updates (e.g. once per 5 seconds).
4. In `TorrentContext`, stop mutating objects inside `setTorrents` (`t.progress = 0`, `incrementalUpdate.hash = hashKey`) — use immutable updates to allow `React.memo` to work correctly.

**Effort:** Medium · **Impact:** High

---

### 3.4 Eliminate Inline Style Objects

**Current state:** Many components create new style objects inside `render` / return statements (e.g. `{ color: colors.text }`, `{ backgroundColor: colors.background }`). Each creates a new reference, defeating shallow equality checks.

**Recommendation:**
1. Use `StyleSheet.create` for static styles.
2. For theme-dependent styles, use `useMemo` to create style objects keyed on relevant theme values.
3. Audit and fix the most impactful screens first: `index.tsx`, `transfer.tsx`, `settings.tsx`.

**Effort:** Medium · **Impact:** Medium

---

### 3.5 Optimize Polling & Network

- **Adaptive polling:** Slow down the poll interval (currently 2–3 seconds) when the app is idle or the torrent list is unchanged. Use the `rid`-based sync response to detect no-change situations.
- **Batch API calls:** `transfer.tsx` makes separate calls for transfer info, speed limits, and connection status. Batch where possible or use the sync endpoint which includes transfer info.
- **Cancel in-flight requests:** When switching servers or navigating away, abort pending requests. Some `AbortController` support exists but is not used consistently.

**Effort:** Medium · **Impact:** Medium

---

### 3.6 Use MMKV for Hot-Path Storage

**Current state:** `AsyncStorage` is used for all persistent data (servers, preferences, logs). It is JSON-serialized and asynchronous.

**Recommendation:** Replace `AsyncStorage` with `react-native-mmkv` for frequently accessed data (preferences, theme, poll settings). MMKV is ~30× faster and synchronous, eliminating first-render flicker from async preference loading.

Keep `expo-secure-store` for passwords.

**Effort:** Low-Medium · **Impact:** Medium

---

## 4. Design Gaps

### 4.1 Critical Bugs

| Bug | Location | Impact |
|-----|----------|--------|
| `backgroundColor: 'colors.r'` (string literal instead of variable) | `app/_layout.tsx:31` | Root layout has invalid background color |
| Hooks called inside a loop (`useRef` inside `Array.from`) | `components/Confetti.tsx` | Violates Rules of Hooks; can crash or produce undefined behavior |
| `ExpandableTorrentCard` pause button has no `onPress` handler | `components/ExpandableTorrentCard.tsx:173–178` | Button does nothing when tapped |
| `Alert.prompt` used on Android (iOS-only API) | `app/torrent/[hash].tsx`, `components/TorrentDetails.tsx` | Crashes or fails silently on Android |
| `ActionSheetIOS` used without Android fallback | `app/torrent/manage-trackers.tsx` | Tracker menu non-functional on Android |
| `usesCleartextTraffic: 'true'` (string, should be boolean) | `app.config.js` | May not enable cleartext traffic on Android |
| Extra space in app name: `'qRemote '` | `app.config.js` | App name has trailing space |

### 4.2 Hardcoded Colors Outside Theme

Many components ignore `ThemeContext` and use hardcoded color values:

- `logs.tsx` — `#007AFF`, `#FF9500`, `#FF3B30`, `#8E8E93`, `#F2F2F7`, `#E5E5EA`
- `torrent/add.tsx` — `#F2F2F7`, `#FFFFFF`, `#007AFF`
- `onboarding.tsx` — `#0A84FF`, `#30D158`, `#FF9F43`
- `constants/buttons.ts` — `#FFFFFF`
- `constants/shadows.ts` — `#007AFF`
- `OptionPicker.tsx` — `rgba(0, 0, 0, 0.1)`
- Multiple components use hardcoded grays for borders and backgrounds

**Fix:** Route all colors through `useTheme()` so dark mode, custom themes, and future dynamic colors work everywhere.

### 4.3 Weak Type Safety

- `colors: any` in `ThemeContext` color-row props, `TorrentCard` `MenuOption`
- `error: any` in ~15 catch blocks
- `categories: { [name: string]: any }` in `TorrentContext`
- `ApplicationPreferences: { [key: string]: any }` in types
- `dynamicColors: any` in `useDynamicColors`
- `as any` casts in button/typography constants
- `formData.append('torrents', { uri, type, name } as any)` in `torrents.ts`

### 4.4 Stale Closure / useEffect Dependency Issues

| File | Issue |
|------|-------|
| `logs.tsx` | `loadLogs` used in `useEffect` but not in dependency array |
| `manage-trackers.tsx` | `fetchTrackers` in `useEffect` without `hash` in deps |
| `settings/theme.tsx` | `reloadCustomColors` in `useEffect([], [])` |
| `TorrentContext.tsx` | `sync` excluded from effect deps via eslint-disable |
| `TransferContext.tsx` | `refresh` omitted from effect deps |
| `ServerContext.tsx` | `checkAndReconnect` uses `currentServer` from closure without dep |
| `LogViewer.tsx` | `loadLogs` not in `useEffect` deps |

### 4.5 Accessibility

The app has very limited accessibility support:

- **Missing `accessibilityLabel`** on almost all interactive elements (buttons, cards, modals, inputs).
- **Missing `accessibilityRole`** on custom buttons, toggles, progress bars.
- **Missing `accessibilityState`** on toggles, expandable cards, selected items.
- **Missing `accessibilityValue`** on progress bars, speed graphs, circular progress.
- **No `accessibilityViewIsModal`** on most modals (`InputModal`, `LogViewer`, `ColorPicker`).
- **No `accessibilityLiveRegion`** for dynamic content (toast messages, speed updates).
- **Swipe actions** not announced to screen readers (`SwipeableTorrentCard`).
- **Drag-to-reorder** inaccessible (`DraggableTorrentList`).

**Recommendation:** Audit all components against WCAG 2.1 AA. Priority:
1. Add `accessibilityLabel` and `accessibilityRole` to all interactive elements.
2. Add `accessibilityValue` to progress indicators.
3. Make toasts announce via `accessibilityLiveRegion`.
4. Provide alternative interactions for swipe and drag gestures.

### 4.6 Android Compatibility

Several iOS-only APIs are used without Android alternatives:
- `Alert.prompt` (used for setting limits, renaming, changing location)
- `ActionSheetIOS` (used for tracker menu)
- Haptics are disabled on Android entirely (`utils/haptics.ts`)

**Recommendation:** Replace `Alert.prompt` with the existing `InputModal` component. Replace `ActionSheetIOS` with a cross-platform action sheet or bottom-sheet. Enable basic haptics on Android using `expo-haptics`.

### 4.7 Missing Loading / Error States

- Several screens don't show loading indicators during API calls (e.g. bulk actions, tracker operations).
- Error toasts often have generic messages; structured error types would allow more helpful messages.
- `torrent/files.tsx` and `manage-trackers.tsx` don't handle the disconnected state explicitly.

### 4.8 `isRecoveringFromBackground` Bug in TorrentContext

`TorrentContext` exposes `isRecoveringFromBackground` as `isRecoveringFromBackground.current` (a ref value) which does **not** trigger re-renders when recovery state changes. `TransferContext` correctly uses `useState` for this. Consumers relying on this value will see stale data.

---

## 5. Missing Features

Based on the qBittorrent WebUI API v2 capabilities and feature parity with competing apps (qBitController, Transdrone, etc.):

### 5.1 RSS Feed Management (High Priority)

**qBittorrent API support:** Full (`/api/v2/rss/*`)

- Add, edit, remove RSS feeds
- View feed items with torrent metadata
- Create and manage auto-download rules (pattern matching, category, save path)
- Mark items as read

**Why:** RSS auto-downloading is one of qBittorrent's most powerful features. qBitController already supports this. Users who rely on RSS feeds currently have no way to manage them from mobile.

### 5.2 Torrent Search (High Priority)

**qBittorrent API support:** Full (`/api/v2/search/*`)

- Start/stop searches across installed plugins
- View results with name, size, seeds, leeches, engine
- Download directly from results
- Manage search plugins (enable, disable, install, update)

**Why:** Searching for torrents without leaving the app is a major convenience feature. qBitController supports this. The API is fully available since qBittorrent 4.1.

### 5.3 Bandwidth Scheduling (Medium Priority)

**qBittorrent API support:** Via application preferences (`scheduler_enabled`, `schedule_from_hour`, `schedule_to_hour`, `scheduler_days`)

- Configure scheduled speed limits (time windows, days of week)
- Visual schedule editor (grid or timeline)
- Quick toggle for schedule on/off

**Why:** Many users need to limit bandwidth during work hours or peak times. The preferences API supports reading and writing schedule settings.

### 5.4 API Key Authentication (Medium Priority)

**qBittorrent API support:** Available in v5.1+ (PR #23212)

- Authenticate via API key header instead of cookie-based login
- Stateless, no session management needed
- More reliable for mobile apps with intermittent connectivity

**Why:** API keys eliminate the need for cookie refresh, CSRF tokens, and session expiry handling — all pain points in the current implementation.

### 5.5 Push Notifications (Medium Priority)

**Current state:** No notification support.

- Notify when a torrent completes downloading
- Notify on connection loss / recovery
- Notify when disk space is low
- Notify on torrent errors

**Implementation:** Use `expo-notifications` with a background task that periodically checks torrent states, or implement a lightweight push relay server.

### 5.6 Widget Support (Medium Priority)

- iOS home-screen widget showing active download count, total speed
- Android widget with similar info
- Quick actions from widget (pause all, resume all)

**Implementation:** Use `expo-widgets` (community) or native modules.

### 5.7 Torrent Creation (Low-Medium Priority)

**qBittorrent API support:** Not directly, but the app could create `.torrent` files client-side using a JS library.

- Select files from device
- Set piece size, trackers, comment
- Add to qBittorrent or share the `.torrent` file

### 5.8 Multi-Server Dashboard (Low-Medium Priority)

**Current state:** Only one server connected at a time.

- Overview screen showing status of all configured servers at a glance
- Total download/upload across all servers
- Quick switch without full disconnect/reconnect flow

### 5.9 Tablet / iPad Optimized Layout (Low-Medium Priority)

**Current state:** Phone layout only; no responsive design for larger screens.

- Split-view: torrent list on left, detail on right
- Larger touch targets and more information density
- iPad multitasking support (Split View, Slide Over)

### 5.10 Torrent Queue Management (Low Priority)

**qBittorrent API support:** Via `torrents/topPrio`, `torrents/bottomPrio`, `torrents/increasePrio`, `torrents/decreasePrio`

- Visual queue ordering
- Drag-to-reorder queue position (`DraggableTorrentList` exists but is not wired up to the main list)
- Max active downloads / seeds configuration

### 5.11 Export / Import Server Configurations (Low Priority)

**Current state:** Backup/restore exists in settings but is basic.

- Export encrypted server config (excluding passwords) as QR code or file
- Import by scanning QR code
- Share server configs between devices

### 5.12 Connection Profiles (Low Priority)

- Per-server profiles with different speed limits, save paths, categories
- Switch profile based on network (Wi-Fi vs. cellular)
- Automatic profile selection

---

## 6. Priority Matrix

### Critical (Fix Immediately)

| Item | Section | Effort |
|------|---------|--------|
| Fix `backgroundColor: 'colors.r'` bug | 4.1 | Trivial |
| Fix Confetti hooks-in-loop violation | 4.1 | Low |
| Fix `Alert.prompt` / `ActionSheetIOS` on Android | 4.1, 4.6 | Low |
| Fix `ExpandableTorrentCard` missing `onPress` | 4.1 | Trivial |
| Fix `app.config.js` `usesCleartextTraffic` type | 4.1 | Trivial |
| Fix `isRecoveringFromBackground` ref vs state bug | 4.8 | Low |

### High Priority (Next Sprint)

| Item | Section | Effort |
|------|---------|--------|
| Break up mega-components (settings, index, transfer, torrent detail) | 2.1 | Medium |
| Add ESLint + Prettier + pre-commit hooks | 2.5 | Medium |
| Memoize TorrentCard + adopt FlashList | 3.1 | Low-Med |
| Reduce context re-renders (split/memoize) | 3.3 | Medium |
| Add basic test suite (utils, services) | 2.4 | Medium |
| Complete i18n coverage | 2.3 | Medium |
| RSS Feed Management feature | 5.1 | High |

### Medium Priority (Next Quarter)

| Item | Section | Effort |
|------|---------|--------|
| Adopt feature-based folder structure | 1.1 | Medium |
| Introduce TanStack Query for server-state | 1.2 | High |
| Torrent Search feature | 5.2 | High |
| Accessibility audit and fixes | 4.5 | Medium |
| Migrate animations to Reanimated | 3.2 | Medium |
| Bandwidth Scheduling feature | 5.3 | Medium |
| API Key Authentication | 5.4 | Medium |
| Standardize error handling | 2.7 | Medium |
| Centralize API client config | 1.3 | Low-Med |
| Push Notifications | 5.5 | Medium |
| Extract shared ServerForm | 1.4 | Low |

### Low Priority (Backlog)

| Item | Section | Effort |
|------|---------|--------|
| Replace AsyncStorage with MMKV | 3.6 | Low-Med |
| Eliminate inline styles | 3.4 | Medium |
| Remove dead code | 2.6 | Low |
| Optimize polling (adaptive intervals) | 3.5 | Medium |
| Deep-link / URL scheme support | 1.6 | Medium |
| Error boundary | 1.5 | Low |
| Widget support | 5.6 | High |
| Tablet layout | 5.9 | High |
| Torrent creation | 5.7 | Medium |
| Multi-server dashboard | 5.8 | Medium |
| Queue management | 5.10 | Low |
| Connection profiles | 5.12 | Medium |

---

*Generated from a full codebase review on 2026-03-14.*
