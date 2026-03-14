# PLAN.md — Review

> Reviewed against the actual codebase on 2026-03-14.

## Overall Assessment

The plan is well-structured, accurate, and ready for execution. Phasing, dependency ordering, and task granularity are sound. Below are the remaining issues found during validation.

---

## Errors

### 1. `react-native-gesture-handler` — imported in 1 file, not 2

AGENTS.md template (line 109) says "imported in 2 components." Only `SwipeableTorrentCard.tsx` imports it. `DraggableTorrentList.tsx` does not. Fix the AGENTS.md template text.

### 2. `getStateLabel` duplication is overstated (Task 1.6)

Task 1.6 implies `getStateLabel` is duplicated across `TorrentCard.tsx`, `torrent/[hash].tsx`, and `ExpandableTorrentCard.tsx`. Actual:
- `TorrentCard.tsx` — yes (switch statement)
- `torrent/[hash].tsx` — yes (if/else with `state.includes()`)
- `ExpandableTorrentCard.tsx` — **no** (only has inline `stateColor` logic, no label function)

`getStateColor` exists in all 3 (2 functions + 1 inline ternary), but the implementations have diverged. The canonical version should be tested against all three.

### 3. `TorrentDetails.tsx` is the largest file at ~2,086 lines

Larger than `settings.tsx` (1,958). Not called out specially anywhere. May benefit from extraction similar to how Task 2.7 splits settings.

---

## Warnings

### 4. Invalid `rgb()` usage is more widespread than stated

Task 2.1 mentions fixing `rgb(0, 0, 0,1)`. The actual scope is much larger — `ThemeContext.tsx` has dozens of colors using `rgb()` with 4 parameters (alpha), which is invalid. Examples: `error: 'rgb(255, 13, 0,0.5)'`, `success: 'rgb(4, 134, 37,0.5)'`, `text: 'rgb(0, 0, 0,1)'`, etc. Task 2.1 should say "fix **all** `rgb()` calls that include an alpha parameter — change to `rgba()`."

### 5. `expo-dev-client` is already a dependency

`package.json` has `"expo-dev-client": "~6.0.20"`. The AGENTS.md template says "do NOT add native modules that require `expo-dev-client`" implying Expo Go only, but dev-client is already installed. Clarify whether the project uses Expo Go exclusively or also development builds.

### 6. Quick Connect panel has i18n inconsistency

`index.tsx` uses `t()` for strings while `transfer.tsx` uses hardcoded English ("add a server to set sail", "Connect"). Task 1.6 extraction should ensure the shared component uses i18n throughout.

### 7. InputModal empty-value behavior needs verification

Task 1.5 notes: "Some prompts accept empty (e.g. '0' for unlimited)." Before replacing Alert.prompt calls, agents should verify InputModal passes through empty/zero values. If it blocks them, a prop like `allowEmpty?: boolean` is a prerequisite.

---

## Validated Claims (all correct)

- LOC: 23,348 actual vs "~23,000" stated — accurate
- File count: 72 actual vs "70+" stated — accurate
- All bug claims verified true (background color string literal, trailing space, boolean string, Confetti hooks violation, ActionSheetIOS fallback, ref vs state, unused apiTimeout/csrfToken, iOS-only haptics guard)
- Dead code files all exist and are genuinely unused
- `avatarColor`/`serverAddress` duplication confirmed (identical logic, different names)
- `isNetworkError` duplicated 4 times in `server-manager.ts` — confirmed
- `settings.tsx` is 1,958 lines — confirmed
- Phase dependencies are correctly ordered
