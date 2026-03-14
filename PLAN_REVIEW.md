# PLAN.md — Review

> Cross-checked against the actual codebase on 2026-03-14.

## Overall Assessment

The plan is well-structured, accurate, and ready for execution. Phasing, dependency ordering, and task granularity are sound. Below are the remaining issues found during validation.

---

## Errors

### 1. `react-native-gesture-handler` — imported in 1 file, not 2

The proposed AGENTS.md says "imported in 2 components." Only `SwipeableTorrentCard.tsx` imports it. `DraggableTorrentList.tsx` does not. Fix the AGENTS.md template text.

### 2. `isNetworkError` duplicated 3 times, not 4 (Task 1.6)

Task 1.6 says "currently duplicated 4 times inline." Grep on `services/server-manager.ts` shows exactly **3** inline definitions (lines 67, 98, 126). Update to "3 times."

### 3. `getStateLabel` duplication is overstated (Task 1.6)

Task 1.6 implies `getStateLabel` is duplicated across `TorrentCard.tsx`, `torrent/[hash].tsx`, and `ExpandableTorrentCard.tsx`. Actual:
- `TorrentCard.tsx` — yes (switch statement)
- `torrent/[hash].tsx` — yes (if/else with `state.includes()`)
- `ExpandableTorrentCard.tsx` — **no** (only `stateColor` inline logic, no label function)

`getStateColor` exists in all 3 but implementations have diverged. The canonical version should be tested against all three.

### 4. `TorrentDetails.tsx` is the largest file at ~2,085 lines

Larger than `settings.tsx` (1,957). Task 2.3 redesigns its UI but does not propose splitting it structurally. Consider adding a note that section extraction (e.g. `TorrentInfoSection`, `TorrentFilesSection`) is a follow-up candidate, similar to how Task 2.7 decomposes settings.

---

## Warnings

### 5. "Expo Go project" language is inaccurate (AGENTS.md Cursor Cloud section)

`package.json` has `"expo-dev-client": "~6.0.20"` as a runtime dependency and `eas.json` has `"developmentClient": true`. The project already uses EAS development builds. The note "do NOT add native modules that require `expo-dev-client`" is contradictory since dev-client is already installed. Clarify: native modules that are already linked are fine; new unlinked modules require approval.

### 6. Invalid `rgb()` usage is more widespread than stated (Task 2.1)

Task 2.1 mentions fixing `rgb(0, 0, 0,1)`. The actual scope is larger — `ThemeContext.tsx` has many colors using 4-argument `rgb()` (invalid CSS): `error: 'rgb(255, 13, 0,0.5)'`, `success: 'rgb(4, 134, 37,0.5)'`, `text: 'rgb(0, 0, 0,1)'`, etc. Task 2.1 should say "fix **all** `rgb()` calls that include an alpha parameter — change to `rgba()`."

### 7. `@react-navigation/bottom-tabs` is in `devDependencies`

This is a runtime navigation package used by the tab layout but placed under `devDependencies`. It will be excluded from production builds by some bundlers. Worth adding as a one-line fix in Task 1.4 (move to `dependencies`).

### 8. Quick Connect panel has i18n inconsistency

`index.tsx` uses `t()` for strings while `transfer.tsx` uses hardcoded English ("add a server to set sail", "Connect"). Task 1.6's extracted `QuickConnectPanel` component must use `t()` throughout, not copy the hardcoded strings from `transfer.tsx`.

### 9. InputModal empty-value behavior needs verification (Task 1.5)

Task 1.5 notes "some prompts accept empty (e.g. '0' for unlimited)." Before replacing Alert.prompt calls, verify that InputModal passes through zero/empty values. If it blocks them, a prop like `allowEmpty?: boolean` is a prerequisite.

---

## Advisory

- **Task 2.2 scope is large.** It combines hook extraction, visual redesign, and `index.tsx` changes in one task. If agent parallelism is desired, consider splitting: 2.2a (extract `useTorrentActions` + `ActionMenu`) → 2.2b (visual redesign of TorrentCard) → 2.2c (update `index.tsx`).

---

## Validated Claims

- LOC: 23,348 actual vs "~23,000" stated — accurate.
- File count: 72 actual vs "70+" stated — accurate.
- All bug claims verified: background color string literal, app name trailing space, `usesCleartextTraffic` string vs boolean, Confetti hooks violation, ActionSheetIOS iOS-only, `isRecoveringFromBackground` ref vs state, `apiTimeout` stored but not applied to requests, `csrfToken` captured but used only for debug logging (never sent in headers), iOS-only haptics guard.
- Dead code files all exist and have zero live imports.
- `avatarColor`/`serverAddress` duplication confirmed (identical logic, different names in each file).
- `settings.tsx` is 1,957 lines.
- Phase dependencies are correctly ordered.

---

*Merged from two independent reviews — 2026-03-14.*
