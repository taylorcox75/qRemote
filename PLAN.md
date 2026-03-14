# qRemote v3 — Master Plan

> Single source of truth for all codebase improvements, UI redesign, and restructuring.
> Organized into parallelizable work streams for AI agent execution.
>
> **Codebase:** ~23,000 LOC · 70+ source files · Expo SDK 54 · React Native 0.81 · TypeScript (strict)

---

## How to Use This Document

This plan is organized into **three phases** executed in order. Within each phase, work is broken into **independent tasks** that can be assigned to parallel agents. Each task includes:

- **Files to read** before starting
- **Files to modify** (the blast radius)
- **Acceptance criteria** (how to verify the task is done)
- **Risks** (things that will break if you're not careful)

**Golden rule:** Every task should be independently testable and independently revertible. Never combine a visual change with a structural change in the same commit. The app must build and run at every commit.

### Task Dependencies

Most Phase 1 tasks are independent and can run in parallel, with these constraints:
- **1.6** must complete before **1.8** (`tests/utils/torrent-state.test.ts` depends on extracted utilities)
- **1.7** should run after structural edits in the same files to avoid merge conflicts

Phase 2 tasks have ordering constraints:
- **2.1** (design system) must complete before 2.2–2.7 (they use updated constants)
- **2.2** (TorrentCard) must complete before 2.4 (swipe actions) and 2.5 (FAB removal), because 2.2 creates `useTorrentActions.ts` and modifies `index.tsx`
- **2.3** (torrent detail), **2.6** (transfer), **2.7** (settings) can run in parallel after 2.1
- **2.4** and **2.5** can run in parallel after 2.2

Phase 3 tasks are sequential (each builds on the prior).

### Import Convention for New Code

After Task 1.3 (path aliases), all **newly created files and new imports** must use `@/` aliases. Do NOT use relative `../` paths in new code. Task 3.1 migrates old imports later, but new code should be clean from the start.

### Naming Conventions

- **`app/(tabs)/`** — The parentheses are an Expo Router framework requirement. `(tabs)` is a "route group" — the parens tell Expo Router this folder is a layout group that won't appear in the URL. The parens **cannot be removed** without breaking routing. The name inside can change (e.g. `(main)`) but the syntax is mandatory.
- **Test directories** — Use `tests/` at the repo root, not `__tests__/` colocated. Keep tests organized by module: `tests/utils/`, `tests/services/`, etc.
- **Files** — PascalCase for components (`TorrentCard.tsx`), camelCase for utilities and hooks (`formatSpeed.ts`, `useTorrentActions.ts`), kebab-case for services (`server-manager.ts`). Match whatever convention the file already uses.

---

## Phase 1: AI & Developer Infrastructure

> Make the codebase faster and safer for AI agents to work with.
> These tasks have ZERO user-facing impact and should not break anything.

---

### Task 1.1 — Create AGENTS.md

**Read first:** `README.md`, `app/_layout.tsx`, `tsconfig.json`, `app.config.js`, `package.json`

**Create:** `AGENTS.md` at repo root with this content:

```markdown
# AGENTS.md

## Project Overview
qRemote is a React Native (Expo SDK 54) mobile app for remotely controlling
qBittorrent servers via the WebUI API v2. Runs on iOS and Android via Expo Go.

## Dev Commands
- `npm start` — Start Expo dev server (Expo Go)
- `npm run ios` — iOS simulator
- `npm run android` — Android emulator
- No test runner configured yet (adding tests is a separate task)

## Architecture
- **Routing:** Expo Router file-based routing in `app/`. The `(tabs)` directory uses parentheses because Expo Router requires this syntax for route groups — it is a framework convention, not a naming choice. The parens cannot be removed.
- **State:** React Context (ThemeContext, ServerContext, TorrentContext, TransferContext, ToastContext)
- **Data sync:** Polling-based, 2-3s interval, rid-based incremental sync for torrents
- **Storage:** AsyncStorage for preferences, SecureStore for passwords
- **API:** Thin wrappers in `services/api/` over a singleton axios-based `apiClient`
- **Styling:** All colors via `useTheme()` → ThemeContext. Users can override any color via the color picker.
- **i18n:** react-i18next with 5 locales (en, es, zh, fr, de). Many screens still have hardcoded English strings.

## Critical Rules
1. NEVER hardcode colors — always use `useTheme()` and `colors.*`
2. NEVER use `Alert.prompt` — it is iOS-only and silently fails on Android. Use the `InputModal` component.
3. NEVER rename keys in the `colors` object (ThemeContext) — users store color overrides keyed by these names in AsyncStorage. Renaming silently breaks their customizations.
4. NEVER rename preference keys — there is no migration system. Old keys become orphaned.
5. All user-facing strings must use i18n: `const { t } = useTranslation()` then `t('key')`.
6. The preferences object is `Record<string, any>` — see `types/preferences.ts` for the typed version (create if missing).
7. Color defaults use mixed formats (rgb, rgba, hex). The color picker only handles 6-digit hex. Changing a default from `rgba(...)` to `#hex` removes the alpha channel and changes visual appearance.

## Dead Code (scheduled for deletion in Task 3.5 — do NOT modify, do NOT build on)
- `App.tsx` — unused boilerplate (entry is `index.ts` → `expo-router/entry`)
- `app/onboarding.tsx` — route exists but nothing navigates to it (no gate in _layout.tsx)
- `app/torrent/add.tsx` — standalone screen, superseded by the modal in `app/(tabs)/index.tsx`
- `hooks/useDynamicColors.ts` — placeholder, always returns null
- `components/DraggableTorrentList.tsx`, `SwipeableTorrentCard.tsx`, `ExpandableTorrentCard.tsx`, `SharedTransitionCard.tsx`, `AnimatedTorrentCard.tsx`, `ContextualFAB.tsx`, `GradientCard.tsx`, `HealthRing.tsx`, `AnimatedStateIcon.tsx` — none imported by any live screen
- `apiTimeout` in `services/api/client.ts` — stored but never used
- `csrfToken` in `services/api/client.ts` — captured but never sent

## Known Bugs
- `app/_layout.tsx:32` — `backgroundColor: 'colors.r'` is a string literal, should be `colors.background`
- `components/Confetti.tsx` — `useRef` called inside `Array.from` loop (Rules of Hooks violation)
- `components/ExpandableTorrentCard.tsx:173-178` — Pause button has no `onPress` handler
- `app.config.js` — `usesCleartextTraffic: 'true'` should be boolean `true`
- `app.config.js` — App name has trailing space: `'qRemote '`
- `Alert.prompt` used in multiple places (all broken on Android), including `TorrentCard.tsx`, `torrent/[hash].tsx`, and `TorrentDetails.tsx`
- `ActionSheetIOS` in `manage-trackers.tsx` — no Android fallback
- `isRecoveringFromBackground` in `TorrentContext.tsx` — exposed as ref value, doesn't trigger re-renders (should be state like TransferContext)
- `react-native-gesture-handler` imported in 2 components but NOT in package.json

## Naming Conventions
- Components: PascalCase (`TorrentCard.tsx`)
- Utilities/hooks: camelCase (`formatSpeed.ts`, `useTorrentActions.ts`)
- Services: kebab-case (`server-manager.ts`, `color-theme-manager.ts`)
- Tests: `tests/` at repo root, organized by module (`tests/utils/`, `tests/services/`). NOT `__tests__/`.
- Route groups: `(groupname)` with parentheses is Expo Router syntax, not a naming choice.
- Dynamic routes: `[param].tsx` with square brackets is Expo Router syntax for URL parameters (like `/torrent/:hash`). The brackets cannot be removed. The name inside becomes the param key in `useLocalSearchParams()`.
- Layout files: `_layout.tsx` with the underscore prefix is Expo Router syntax for layout routes. Cannot be renamed.

## Cursor Cloud Specific Instructions
- This is an Expo Go project. Do NOT add native modules that require `expo-dev-client` without explicit approval.
- The app cannot be run in this cloud environment (requires Expo Go on a device/simulator). Verify changes compile with `npx tsc --noEmit`.
```

**Acceptance:** File exists, contains all sections above. Agent sessions that read this file should not need to explore the codebase to understand architecture or conventions.

---

### Task 1.2 — Type the Preferences Object

**Read first:** `services/storage.ts`, `types/api.ts`, then grep all files for `getPreferences\(\)` and `savePreferences` to find every key used.

**Create:** `types/preferences.ts`

The file must:
1. Define an `AppPreferences` interface with every preference key currently used in the codebase, with correct types
2. Export `DEFAULT_PREFERENCES` with sensible defaults matching current behavior
3. Types should cover: theme, customColors, defaultSortBy, defaultSortDirection, defaultFilter, cardViewMode, pauseOnAdd, defaultSavePath, defaultPriority, toastDuration, hapticFeedback, autoConnect, connectionTimeout, apiTimeout, retryAttempts, debugMode, refreshInterval, hasCompletedOnboarding, and any others found by grepping

Note: `cardViewMode` is transitional. If Task 2.2 removes multi-view UI, keep the key typed as deprecated for backward compatibility unless an explicit migration task is added.

**Modify:** `services/storage.ts` — change `getPreferences` return type to `Promise<Partial<AppPreferences>>` and `savePreferences` param to `Partial<AppPreferences>`. Import from `types/preferences.ts`.

**Risks:** The `as Record<string, any>` cast must be preserved at the AsyncStorage boundary (JSON.parse returns any). The typed interface is a layer on top, not a runtime guarantee.

**Acceptance:** `npx tsc --noEmit` passes. Every call to `getPreferences()` and `savePreferences()` still compiles.

---

### Task 1.3 — Add Path Aliases

**Read first:** `tsconfig.json`, `babel.config.js`, `package.json`

**Modify:** `tsconfig.json` — add `baseUrl` and `paths`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

**Modify:** `babel.config.js` — add `babel-plugin-module-resolver`:
```javascript
plugins: [
  ['module-resolver', { root: ['.'], alias: { '@': '.' } }],
  'react-native-reanimated/plugin',
]
```

**Install:** `npm install --save-dev babel-plugin-module-resolver`

**Do NOT** convert existing imports yet. This task only adds the alias infrastructure. A separate task will migrate imports.

**Acceptance:** `npx tsc --noEmit` passes. A test import using `@/utils/format` resolves correctly.

---

### Task 1.4 — Fix All Critical Bugs

**These are small, isolated fixes. Each can be a separate commit.**

**1.4a** — `app/_layout.tsx:32`: Change `backgroundColor: 'colors.r'` to `backgroundColor: colors.background`. Read the file first — the fix goes inside the `StackNavigator` component which has access to `useTheme()`.

**1.4b** — `app.config.js`: Change `usesCleartextTraffic: 'true'` to `usesCleartextTraffic: true` (boolean). Remove trailing space from app name `'qRemote '` → `'qRemote'`.

**1.4c** — `utils/haptics.ts`: Remove the `Platform.OS === 'ios'` guard. `expo-haptics` supports Android. Keep the `hapticsEnabled` flag.

**1.4d** — `context/TorrentContext.tsx`: Change `isRecoveringFromBackground` from a ref to state (like `TransferContext` does). Find where it's exposed in the context value and ensure consumers see updates.

**1.4e** — `components/Confetti.tsx`: The `useRef` calls inside `Array.from` violate Rules of Hooks (hooks cannot be called in loops). Fix by creating the refs array at the top level of the component using a single `useRef` that holds an array, or by using `useMemo` to create the animated values once.

**1.4f** — `app/torrent/manage-trackers.tsx`: Replace `ActionSheetIOS` with a cross-platform solution. Use a `Modal` with action options (similar to the existing option picker pattern), or use the `OptionPicker` component. The current code falls back to only `handleEditTracker` on Android — meaning delete, copy URL, and reannounce are inaccessible on Android.

**1.4g** — `react-native-gesture-handler`: Run `npm install react-native-gesture-handler` to add it to `package.json`. It's currently imported in dead code files (`SwipeableTorrentCard.tsx`, `DraggableTorrentList.tsx`) but NOT in `package.json` — it only works because it's a transitive dependency. Task 2.4 (swipe actions) needs it explicitly installed.

**Risks for 1.4d:** Components that read `isRecoveringFromBackground` will now trigger re-renders when recovery state changes. This is correct behavior but could cause visual flicker if not handled. Test by reviewing all consumers (grep for `isRecoveringFromBackground`).

**Acceptance:** Each fix compiles. No other files need to change for 1.4a-c, 1.4e, 1.4g. For 1.4d, verify all consumers still work. For 1.4f, verify tracker menu works cross-platform.

---

### Task 1.5 — Replace Alert.prompt with InputModal (Android Fix)

**Read first:** `components/InputModal.tsx` (understand its API), then every file using `Alert.prompt`.

**Files to modify (all Alert.prompt callsites in these files — skip TorrentCard.tsx, it's rewritten in Task 2.2):**
- `app/torrent/[hash].tsx` — `handleSetDownloadLimit`, `handleSetUploadLimit`, `handleSetCategory`, `handleAddTags`, `handleRemoveTags`, `handleSetLocation`, `handleRenameTorrent`
- `components/TorrentDetails.tsx` — `handleAddCategory`, `handleShareLimit`, `handleSetLocation`, `handleRenameTorrent`, `handleAddPeers`, `handleRenameFile`

**Do NOT fix Alert.prompt in `TorrentCard.tsx`** — Task 2.2 will remove all action handlers from TorrentCard entirely. Fixing it here is wasted work that creates merge conflicts.

**Pattern:** Each `Alert.prompt` becomes local state (`[modalVisible, setModalVisible]`, `[modalConfig, setModalConfig]`) plus an `<InputModal>` in the JSX. The modal's `onConfirm` callback runs the same logic that was in Alert.prompt's onPress.

**Risks:**
- `InputModal` validates non-empty trimmed value. Some prompts accept empty (e.g. "0" for unlimited). Verify that `InputModal` passes the raw value, not just truthy values.
- `handleSetDownloadLimit` needs `keyboardType="numeric"` on the InputModal.
- Each file that gains an InputModal needs a new state variable. In `TorrentCard.tsx`, this state lives inside each card instance — OK for now, but note that FlashList migration (later task) will need to lift this out.

**Acceptance:** `grep -r "Alert\.prompt" --include="*.tsx"` returns results ONLY in `components/TorrentCard.tsx` (deferred to Task 2.2) — zero results elsewhere. App compiles.

---

### Task 1.6 — Deduplicate Shared Utilities

**Create:** `utils/server.ts` containing:
- `avatarColor(name: string): string` — currently duplicated in `app/(tabs)/index.tsx` and `app/(tabs)/transfer.tsx`
- `serverAddress(server: ServerConfig): string` — same duplication
- `AVATAR_PALETTE` constant

**Create:** `utils/torrent-state.ts` containing:
- `getStateColor(state, progress, dlspeed, upspeed, colors): string` — currently duplicated in `TorrentCard.tsx`, `torrent/[hash].tsx`, `ExpandableTorrentCard.tsx`
- `getStateLabel(state, progress, dlspeed, upspeed): string` — same duplication

**Modify:** `services/server-manager.ts` — extract `isNetworkError(error): boolean` helper (currently duplicated 4 times inline).

**Create:** `components/QuickConnectPanel.tsx` — the "not connected" server list UI with connect buttons, avatars, and error states. Currently duplicated (~100 lines of identical JSX) in both `app/(tabs)/index.tsx` and `app/(tabs)/transfer.tsx`. Extract into a shared component that takes `onConnect` and `onAddServer` callbacks.

**Modify:** Remove inline copies from all source files, replace with imports from the new utility files and shared components.

**Risks:** `getStateColor` currently takes `colors` from `useTheme()` which is a hook — the utility must accept colors as a parameter, not call the hook itself. Verify that each inline copy has identical logic before deduplicating — some may have diverged.

**Acceptance:** No duplicate `avatarColor`, `serverAddress`, `getStateColor`, `getStateLabel`, or `isNetworkError` functions remain. `grep` confirms each exists in exactly one file.

---

### Task 1.7 — Add File Headers to Complex Files

**Scope:** Only files over 200 lines. Small, self-explanatory files (e.g. `FocusAwareStatusBar.tsx` at 21 lines) don't need headers. Dead files scheduled for deletion in Task 3.5 don't need headers — they're being deleted.

**Files that need headers (over 200 lines):**
- `app/(tabs)/index.tsx`, `app/(tabs)/settings.tsx`, `app/(tabs)/transfer.tsx`, `app/(tabs)/logs.tsx`
- `app/torrent/[hash].tsx`, `app/torrent/files.tsx`, `app/torrent/manage-trackers.tsx`
- `app/server/add.tsx`, `app/server/[id].tsx`
- `components/TorrentCard.tsx`, `components/TorrentDetails.tsx`, `components/SuperDebugPanel.tsx`, `components/ColorPicker.tsx`, `components/LogViewer.tsx`, `components/OptionPicker.tsx`
- `context/TorrentContext.tsx`, `context/TransferContext.tsx`, `context/ServerContext.tsx`
- `services/api/client.ts`, `services/api/torrents.ts`, `services/server-manager.ts`
- `types/api.ts`

**Pattern:** Add a JSDoc block at line 1:
```typescript
/**
 * FileName — One-line description of what this file does.
 *
 * Key exports: list main exports
 * Known issues: any bugs or limitations (reference AGENTS.md known bugs)
 */
```

**Risks:** None. Comments don't affect behavior.

**Acceptance:** All files over 200 lines have a descriptive header comment.

---

### Task 1.8 — Add Unit Tests for Core Utilities

**Install:** `npm install --save-dev jest @types/jest ts-jest`

**Create:** `jest.config.js` with ts-jest preset for React Native. Configure `roots: ['<rootDir>/tests']`.

**Create test files (all under `tests/` at repo root):**
- `tests/utils/format.test.ts` — test `formatSize`, `formatSpeed`, `formatTime`, `formatDate`, `formatRatio`, `formatPercent` with edge cases (0, null, undefined, NaN, negative, very large numbers)
- `tests/utils/torrent-state.test.ts` — test `getStateColor` and `getStateLabel` with a truth table covering all `TorrentState` values (after Task 1.6 extracts them)
- `tests/services/color-theme-manager.test.ts` — test `mergeColors`, `hexToRgba`, `rgbaToHex`

**Acceptance:** `npx jest` runs and all tests pass. Tests cover the highest-risk pure functions.

---

### Task 1.9 — Add ESLint and Prettier

**Install:** `npm install --save-dev eslint prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier`

**Create:** `.eslintrc.js` with TypeScript, React, React Hooks rules. Set `no-explicit-any: warn` (not error — too many existing violations).

**Create:** `.prettierrc` with single quotes, trailing commas, 100 print width, 2-space indent.

**Add scripts to `package.json`:**
```json
"lint": "eslint . --ext .ts,.tsx",
"format": "prettier --write '**/*.{ts,tsx,js,json}'"
```

**Do NOT** fix all existing lint warnings in this task. Only configure the tools. A separate pass can fix warnings incrementally.

**Acceptance:** `npx eslint . --ext .ts,.tsx` runs without errors (warnings OK). `npx prettier --check .` runs.

---

## Phase 2: UI Redesign

> Transform the app from a utility to a premium iOS experience.
> Depends on Phase 1 being complete (especially AGENTS.md, path aliases, typed preferences, Alert.prompt fix).

---

### Task 2.1 — Update Design System Constants

**Read first:** `context/ThemeContext.tsx`, `constants/spacing.ts`, `constants/typography.ts`, `constants/shadows.ts`, `constants/buttons.ts`, `services/color-theme-manager.ts`, `app/settings/theme.tsx`

**Modify `context/ThemeContext.tsx`:**
- Update `darkColors` defaults to cleaner values. Keep ALL 11 state color keys. Map multiple states to fewer visual colors in the defaults (e.g. `stateMetadata`, `stateChecking`, `stateQueued` all default to the same orange/gray).
- Dark mode background: change from `rgb(15, 15, 15)` to `#000000` (true black for OLED).
- Fix invalid `rgb(0, 0, 0,1)` format → `#000000` or `rgba(0,0,0,1)`.
- Update surface colors to `#1C1C1E` / `#2C2C2E` tier system.

**Modify `constants/typography.ts`:**
- Add `largeTitle` (34pt Bold), `headline` (17pt Semibold).
- Increase torrent name size: update the convention from 15pt to 17pt Semibold.

**Modify `constants/shadows.ts`:**
- Remove or zero-out all dark mode shadows (they're invisible on dark backgrounds anyway).
- Simplify light mode to a single barely-visible card shadow.

**Risks:**
- Changing dark mode background from `rgb(15,15,15)` to `#000000` is a visual change every user will see. Users with custom background colors won't be affected (overrides take precedence).
- The color picker in `settings/theme.tsx` uses `colorThemeManager.rgbaToHex()` to display colors. If you change a default from `rgb(...)` to hex, the display should still work — but test it.
- **Do NOT remove any color keys from the `ColorTheme` interface.** Only change default values.

**Acceptance:** Both themes render correctly. Color picker still works. `npx tsc --noEmit` passes.

---

### Task 2.2 — Redesign TorrentCard

**Read first:** `components/TorrentCard.tsx`, `app/(tabs)/index.tsx` (how it's used), `utils/torrent-state.ts` (after Task 1.6)

**Modify `components/TorrentCard.tsx`:**

New 4-line card layout:
```
  Torrent Name Here                          (17pt Semibold)
  ● Downloading · 8.4 MB/s ↓                (13pt Regular, secondary color)
  ████████████████░░░░░░░░  72% · 23m left   (3px progress bar + footnote)
  3.2 / 4.4 GB                               (13pt, tertiary)
```

Changes:
- Remove the 10-value stat grid (expanded mode). Keep compact stats as the only mode.
- Remove the inline play/pause circle button (will be replaced by swipe in Task 2.4).
- Replace the solid-color state badge with a small colored dot (4-6px) + text label in secondary color.
- Remove the left border color stripe.
- Wrap the component in `React.memo` with a custom comparator.
- Remove all action handlers from TorrentCard — move them to `useTorrentActions` hook.
- **Keep the context menu, but simplify it.** Replace the custom `Modal` + `measureInWindow` positioning logic (~200 lines) with a simple `Modal` overlay that doesn't do manual position calculation. Use a centered or bottom-anchored action list instead. Do NOT remove the menu entirely — it's the only way users access 9 actions. Native context menus (`react-native-ios-context-menu`) require native modules which break Expo Go — we cannot use them.

**The menu replacement approach:** Create a new `components/ActionMenu.tsx` — a reusable bottom-anchored modal with a list of labeled actions. TorrentCard receives an `onLongPress` prop that the parent list uses to open this shared menu (one menu instance at the list level, not per-card). This eliminates the per-card menu state that causes problems with list recycling.

**Create:** `hooks/useTorrentActions.ts` — extract all action handlers from TorrentCard into a reusable hook that takes a `torrent` parameter and returns action callbacks + an `actionMenuItems` array for the menu.

**Create:** `components/ActionMenu.tsx` — a simple, reusable modal that takes `visible`, `onClose`, and `items: { label, icon, onPress, destructive? }[]`. Renders as a bottom-anchored list. No manual positioning math. No `measureInWindow`. This replaces the 200-line custom popup.

**Modify `app/(tabs)/index.tsx`:**
- Add single shared `ActionMenu` instance at the list level (not per-card)
- State: `selectedTorrent` for the menu target
- `onLongPress` on each card sets `selectedTorrent` and opens the menu
- Action handlers come from `useTorrentActions(selectedTorrent)` hook
- Remove `viewMode` UI state (one mode only now). Keep reading `cardViewMode` as a deprecated compatibility key until preferences migration is explicitly scheduled.

**Risks:**
- The custom menu currently uses 9 different actions. All must remain accessible via the new ActionMenu. Don't delete functionality — move it.
- `TorrentCard` is imported in 5+ files. All must still compile after the props change. New props: `torrent`, `onPress`, `onLongPress` (replaces internal menu).
- `React.memo` comparator must include all props that affect rendering. Missing a field = stale display.
- InputModal callsites that were in TorrentCard (Alert.prompt for download limit) move into `useTorrentActions`. These must use InputModal, not Alert.prompt.

**Acceptance:** Cards render with new layout. Long-press opens the ActionMenu with all 9 actions. No stat grid. No per-card menu state. App compiles.

---

### Task 2.3 — Redesign Torrent Detail

**Read first:** `app/torrent/[hash].tsx`, `components/TorrentDetails.tsx`

Replace the "Quick Tools" (4 colored buttons) + "Advanced" (16 rainbow buttons) layout with grouped inset list sections:

**Sections:** Hero (name, state, progress), Actions (Pause/Delete/Recheck — 3 max), General, Transfer, Network, Content (Files/Trackers as navigation rows), Advanced (Priority picker, toggles for Sequential/First-Last/Super Seed/Force Start, Rename/Move as input rows), Dates.

**Pattern for each row type:**
- **Static info:** Label left, value right, no interaction
- **Toggle:** Label left, Switch right, calls API on toggle
- **Picker:** Label left, current value + `›` right, opens OptionPicker on tap
- **Input:** Label left, current value + `›` right, opens InputModal on tap
- **Navigation:** Label left, summary + `›` right, calls `router.push()` on tap

**Risks:**
- The 16 buttons all call different API endpoints. Every endpoint must remain accessible. Map each button to a row type:
  - Force Start → toggle
  - Super Seed → toggle
  - Sequential DL → toggle
  - First/Last Priority → toggle
  - ↑Priority / ↓Priority / Max Priority / Min Priority → single "Priority" picker row with options
  - DL Limit / UL Limit → input rows
  - Edit Trackers → navigation row
  - Set Category → picker row
  - Add Tags / Remove Tags → input rows
  - Set Location → input row
  - Rename → input row
- All InputModal usage must use the component (not Alert.prompt — Task 1.5 prerequisite).

**Acceptance:** All 16 actions are still accessible. Zero colored button grids remain. Detail screen uses grouped inset sections.

---

### Task 2.4 — Add Swipe Actions to Torrent List

**Read first:** `app/(tabs)/index.tsx`, `components/TorrentCard.tsx`, `hooks/useTorrentActions.ts` (from Task 2.2)

**Install:** Verify `react-native-gesture-handler` is in `package.json`. If not, `npm install react-native-gesture-handler`.

**Implement:** Wrap each torrent card in a swipeable container (can use `Swipeable` from `react-native-gesture-handler`). The existing `SwipeableTorrentCard.tsx` is dead code but can be referenced for patterns.

- **Swipe left (short):** Pause/Resume
- **Swipe left (full):** Delete (with confirmation alert)
- **Swipe right (short):** Force start or priority

**Risks:**
- `react-native-gesture-handler` may not be in `package.json` (it's imported in dead code but might be a transitive dependency). Install it explicitly.
- Swipe actions need the same optimistic update + error revert pattern as the old play/pause button.
- Haptic feedback should fire at the swipe threshold.

**Acceptance:** Swipe left on a card shows pause/resume action. Swiping triggers the API call. Haptic fires at threshold.

---

### Task 2.5 — Replace FAB with Nav Bar Button

**Read first:** `app/(tabs)/index.tsx` (the FAB), `app/(tabs)/_layout.tsx` (tab layout)

**Modify `app/(tabs)/index.tsx`:**
- Remove the `Animated.View` FAB and all FAB-related animation code (fabScale, isFabVisible, etc.)
- Remove tab bar hide/show logic on scroll (simplify dramatically)
- The "+" action should be triggered via `navigation.setOptions` with a `headerRight` button, OR via a button in the filter/search bar area (since `headerShown: false`)

**Since `headerShown: false`**, the cleanest approach is a "+" button in the top-right of the custom header area (next to the sort button).

**Modify `app/(tabs)/_layout.tsx`:** If using native header, set `headerShown: true` and configure `headerRight`.

**Risks:**
- The FAB animation code is intertwined with the header hide/show and tab bar hide/show logic. Removing it cleans up ~100 lines of scroll handling. Make sure pull-to-refresh still works.
- The add-torrent modal is triggered by `setShowAddModal(true)`. This trigger just moves to a different button.

**Acceptance:** No FAB visible. "+" button accessible in the header/toolbar area. Add torrent modal still opens.

---

### Task 2.6 — Redesign Transfer Screen

**Read first:** `app/(tabs)/transfer.tsx`

**Redesign into grouped inset sections:**
1. Hero section: large speed numbers (34pt bold) + speed graph full width
2. SPEED LIMITS: grouped list (Download Limit, Upload Limit, Alternative Speeds toggle). Tapping a limit row opens OptionPicker with presets + custom input.
3. ACTIONS: grouped list (Resume All, Pause All, Force Start All). Power-user actions (Pause All DL, Pause All UL) behind a long-press or "More" row.
4. THIS SESSION / ALL TIME / CONNECTION: grouped list sections with static info rows.

**Remove:** The 6 colored square buttons, the chip grid for speed presets, the dashboard-style widget layout.

**Risks:**
- Quick-connect panel (when disconnected) is duplicated from `index.tsx`. After Task 1.6, it should be a shared component. If 1.6 isn't done yet, leave the duplication.
- Speed limit presets currently shown as chips need a new UI (OptionPicker with checkmark for current selection).
- "Force Start All" calls `torrentsApi.setForceStart` on all torrents — verify API call is preserved.

**Acceptance:** Transfer screen uses grouped inset sections. No colored button grid. All functionality preserved.

---

### Task 2.7 — Redesign Settings (Sub-Screen Navigation)

**Read first:** `app/(tabs)/settings.tsx` (1957 lines), `app/settings/theme.tsx`

**This is the hardest UI task.** Break the 1957-line settings screen into sub-screens:

1. **Top-level `settings.tsx`** (~200 lines): Connection status card + 6-8 navigation rows (Servers, Appearance, Torrent Defaults, Notifications, Advanced, What's New, About)
2. **`app/settings/servers.tsx`** (new): Server list, add/edit/delete, auto-connect toggle
3. **`app/settings/appearance.tsx`** (new): Theme toggle, refresh interval. Links to existing `settings/theme.tsx` for colors.
4. **`app/settings/torrent-defaults.tsx`** (new): Default sort, filter, pause-on-add, save path, priority
5. **`app/settings/notifications.tsx`** (new): Toast duration, haptic feedback
6. **`app/settings/advanced.tsx`** (new): API timeout, retries, debug mode, logs, backup/restore, danger zone (shutdown)
7. **`app/settings/whats-new.tsx`** (new): Release notes/changelog currently shown by inline modal
8. **`app/settings/about.tsx`** (new): App version, build info, links/credits

**Approach:** Extract one section at a time. After each extraction, the app must build and the settings screen must still work. Start with the simplest section (Appearance), end with the most complex (Servers — has the swipeable server list and quick-connect logic).

**Routing requirement:** The new `app/settings/` sub-screens work automatically with Expo Router — they're resolved as routes under the root Stack. However, if you want a "Settings" header with a back button on each sub-screen, you may need to create `app/settings/_layout.tsx` with a nested Stack navigator. Test navigation first: push to `/settings/servers` from the settings tab and verify the back button works. If it doesn't, add the layout file.

**Risks:**
- Settings currently uses `useFocusEffect` to reload data. Each sub-screen needs its own focus handling.
- Categories and tags sections depend on `isConnected` — only shown when connected. Handle this in the sub-screen.
- `SwipeableServerItem` is defined inline in settings.tsx. Extract it as a component.
- The "What's New" content is currently inline. Move it to `app/settings/whats-new.tsx` and keep behavior equivalent.
- The existing `app/settings/theme.tsx` already works as a route — use it as a reference for how settings sub-screens should be structured.

**Acceptance:** Top-level settings shows ~8 rows. Each row navigates to a sub-screen. All settings still functional. `settings.tsx` is under 300 lines.

---

## Phase 3: Architecture & Restructure

> Deeper structural changes. Depends on Phase 1 and Phase 2 being substantially complete.

---

### Task 3.1 — Migrate Imports to Path Aliases

**Prerequisite:** Task 1.3 (path aliases configured)

**Scope:** Every `.ts` and `.tsx` file in the project.

**Pattern:** Replace all relative imports with `@/` prefixed imports:
```typescript
// Before
import { useTheme } from '../../context/ThemeContext';
import { formatSpeed } from '../utils/format';

// After
import { useTheme } from '@/context/ThemeContext';
import { formatSpeed } from '@/utils/format';
```

**Approach:** Process one directory at a time. After each directory, run `npx tsc --noEmit` to verify.

**Risks:** Expo Router requires `app/` relative paths for route resolution. Do NOT change imports inside `app/_layout.tsx` that reference route files — only change imports of non-route modules (context, components, utils, services, etc.).

**Acceptance:** All relative `../` imports of shared modules are replaced with `@/`. `npx tsc --noEmit` passes.

---

### Task 3.2 — Eliminate Remaining `any` Types

**Scope:** All source files.

**Target replacements:**
- `error: any` → `error: unknown` with type narrowing (`if (error instanceof Error)`)
- `colors: any` in component props → import and use the `ThemeContextType['colors']` type or define `ThemeColors`
- `categories: { [name: string]: any }` → type `Category` from `types/api.ts`
- `ApplicationPreferences: { [key: string]: any }` → type against qBittorrent API docs
- `as any` casts in constants → use proper RN style types
- `menuButtonRef: useRef<any>` → `useRef<TouchableOpacity>`

**Risks:** Some `any` types exist because React Native's type system is imprecise (e.g. `formData.append` with file objects). These may need `@ts-expect-error` comments instead. Don't force-type things that genuinely don't fit — document why.

**Acceptance:** `grep -r ": any" --include="*.ts" --include="*.tsx"` returns fewer than 5 results (down from ~30+).

---

### Task 3.3 — Complete i18n Coverage

**Read first:** `locales/en/translation.json`, then grep for hardcoded strings in all screen files.

**Files with hardcoded English strings:**
- `app/(tabs)/logs.tsx`
- `app/torrent/manage-trackers.tsx`
- `app/torrent/[hash].tsx`
- `app/(tabs)/transfer.tsx`
- `app/(tabs)/index.tsx`
- `app/(tabs)/settings.tsx`
- `components/TorrentCard.tsx`
- `components/TorrentDetails.tsx`

**For each file:**
1. Find all raw string literals in JSX (button labels, section headers, error messages, placeholder text)
2. Add keys to `locales/en/translation.json`
3. Replace with `t('key')` calls
4. Add the same keys (with English values as placeholders) to `locales/es/translation.json`, `locales/zh/translation.json`, `locales/fr/translation.json`, `locales/de/translation.json`

**Risks:** Some strings contain interpolation (e.g. `Download limit set to ${limitKB} KB/s`). These need i18next interpolation: `t('toast.dlLimitSet', { limit: limitKB })`.

**Acceptance:** `grep -rn "'\w.*'" --include="*.tsx" app/` returns no user-visible hardcoded English strings (ignore imports, keys, style values).

---

### Task 3.4 — Introduce TanStack Query

**This is the highest-effort task.** It replaces the hand-rolled polling in TorrentContext, TransferContext, and ServerContext.

**Install:** `npm install @tanstack/react-query`

**Create:** `services/query-client.ts` — configure a QueryClient with defaults.

**Modify `app/_layout.tsx`:** Wrap the app in `QueryClientProvider`.

**Migrate one context at a time:**

1. **TransferContext** (simplest — single `transferApi.getGlobalTransferInfo()` call):
   - Replace the `setInterval` polling with `useQuery({ queryKey: ['transfer'], queryFn: ..., refetchInterval: 3000 })`
   - Replace `refresh()` with `queryClient.invalidateQueries(['transfer'])`
   - Keep the context wrapper but make it thin — just provides the query result

2. **TorrentContext** (complex — has `rid`-based incremental sync):
   - The `rid` flow doesn't map cleanly to TanStack Query's cache model. Options:
     - Use `useQuery` with a custom `queryFn` that internally tracks `rid` via a ref
     - Or keep the manual sync but wrap it in a query for retry/refetch/background handling
   - Mutation hooks for pause, resume, delete, etc.

3. **ServerContext** (auth + connection state):
   - `useMutation` for connect/disconnect
   - Server list as a query

**Risks:**
- TanStack Query's background refetch fires when the app comes to foreground — this replaces the manual `AppState` handling but may have different timing.
- The `rid`-based sync is qBittorrent-specific and not a standard cache-invalidation pattern. Don't try to force it into TanStack Query's model — use a custom queryFn that handles `rid` internally.
- Every screen that calls `useTorrents()`, `useTransfer()`, `useServer()` must still work with the same API. Change the implementation, not the interface.

**Acceptance:** All polling works as before. `AppState` background recovery works. No manual `setInterval` in any context file.

---

### Task 3.5 — Delete Dead Code

Git history preserves everything. Dead code doesn't belong in the working tree.

**Delete these files (verify zero live imports before each deletion):**
- `App.tsx` — unused boilerplate, entry is `expo-router/entry`
- `hooks/useDynamicColors.ts` — placeholder, always returns null
- `app/onboarding.tsx` — route exists but has no active navigation path
- `app/torrent/add.tsx` — superseded by the add-torrent modal in `app/(tabs)/index.tsx`
- `components/DraggableTorrentList.tsx` — not imported by any screen
- `components/SwipeableTorrentCard.tsx` — not imported by any screen
- `components/ExpandableTorrentCard.tsx` — not imported by any screen
- `components/SharedTransitionCard.tsx` — not imported by any screen
- `components/AnimatedTorrentCard.tsx` — not imported by any screen
- `components/ContextualFAB.tsx` — not imported by any screen
- `components/GradientCard.tsx` — not imported by any screen
- `components/HealthRing.tsx` — not imported by any screen
- `components/AnimatedStateIcon.tsx` — not imported by any screen

**In `services/api/client.ts`:** Remove unused `csrfToken` storage. Remove unused `apiTimeout` field (or actually use it — pick one).

**Verification before each delete:** `grep -r "from.*FileName" --include="*.ts" --include="*.tsx"` must return zero results (excluding the file itself and this plan). If a file IS imported somewhere, do NOT delete it — investigate.

**Acceptance:** All listed files deleted. `npx tsc --noEmit` passes. App compiles.

---

## Appendix A: Missing Features (Future Backlog)

Not part of the v3 launch, but documented for future planning:

| Feature | qBittorrent API | Priority | Effort |
|---------|----------------|----------|--------|
| RSS Feed Management | `/api/v2/rss/*` | High | High |
| Torrent Search | `/api/v2/search/*` | High | High |
| Bandwidth Scheduling | Via app preferences | Medium | Medium |
| API Key Auth (v5.1+) | Header-based | Medium | Medium |
| Push Notifications | N/A (client-side) | Medium | Medium |
| Home Screen Widgets | N/A (native) | Medium | High |
| Tablet/iPad Layout | N/A (responsive) | Medium | High |
| Multi-Server Dashboard | N/A (client-side) | Low | Medium |
| Torrent Creation | N/A (client-side) | Low | Medium |
| Queue Management | `/api/v2/torrents/*Prio` | Low | Low |
| Deep Links / Magnet Handling | N/A (client-side) | Low | Medium |
| Connection Profiles | N/A (client-side) | Low | Medium |

---

## Appendix B: Risk Quick-Reference

| Risk | Why It Breaks | How to Avoid |
|------|--------------|-------------|
| Renaming a color key | Users' saved overrides keyed by old name become orphaned | Never rename keys. Change defaults only. |
| Renaming a preference key | No migration system. Old value silently ignored. | Never rename. Add new keys. |
| Adding native modules | Breaks Expo Go workflow. Must switch to dev-client. | Don't add without explicit approval. No `react-native-ios-context-menu`, no `lottie-react-native`, no `expo-symbols`. |
| Removing the context menu without a replacement | Users lose access to 9 torrent actions (pause, delete, force start, priority, limit, verify, reannounce, magnet copy) | Always provide a working replacement BEFORE removing the existing UI. Task 2.2 uses `ActionMenu.tsx` as the replacement. |
| Moving `app/` directory | Expo Router requires `app/` at root. | Never move `app/`. Only move shared code. |
| Changing `RGB(...)` defaults to `#hex` | Removes alpha channel. Badges and borders look more saturated. | Test visually in both themes after changes. |
| FlashList + card-local state | Recycling causes state bleed between cards. | Lift menu/loading state out of card first (Task 2.2 does this). |
| `react-native-gesture-handler` | Imported in dead code but not in package.json. | Task 1.4g installs it explicitly. Must be done before Task 2.4. |
| Two agents editing the same file | Merge conflicts between parallel tasks. | Check task dependencies section. Tasks 2.2 and 2.5 both edit `index.tsx` — they cannot run in parallel. |
| Settings sub-screens need routing | New files in `app/settings/` may need a `_layout.tsx` for proper navigation. | Test navigation after creating the first sub-screen. Add layout if back button doesn't work. |

---

*Combined from codebase review, UI redesign, risk register, and AI maintainability audit. 2026-03-14.*
