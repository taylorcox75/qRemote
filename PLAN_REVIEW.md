# PLAN.md — Review

> Reviewed against the actual codebase on 2026-03-14.

## Overall Assessment

**The plan is well-structured, thorough, and largely accurate.** It correctly identifies real bugs, real duplication, and real architectural problems. The phased approach with dependency ordering is sound. The task granularity is appropriate for parallel AI agent execution.

Below are specific issues found during validation, organized by severity.

---

## Errors (must fix before agents execute)

### 1. Alert.prompt count is wrong — 14, not 13

The plan states "Alert.prompt used in 13 places" in the Known Bugs section of the AGENTS.md template. Actual count:

| File | Count |
|------|-------|
| `app/torrent/[hash].tsx` | 7 |
| `components/TorrentDetails.tsx` | **6** (plan says 5) |
| `components/TorrentCard.tsx` | 1 |
| **Total** | **14** |

**Impact:** Task 1.5 lists `TorrentDetails.tsx` as having "6 callsites" (correct in the task body), but the AGENTS.md template says "13 places" and attributes 5 to TorrentDetails.tsx. The AGENTS.md Known Bugs section should say **14 places** and list **6** for `TorrentDetails.tsx`.

### 2. `react-native-gesture-handler` import claim is inaccurate

The AGENTS.md template and Task 1.4g say it's "imported in 2 components" (`SwipeableTorrentCard.tsx` and `DraggableTorrentList.tsx`). In reality, only `SwipeableTorrentCard.tsx` imports it. `DraggableTorrentList.tsx` does not import `react-native-gesture-handler`.

**Impact:** Minor — the fix (installing the package) is the same either way, but the stated justification is partially wrong.

### 3. `getStateLabel` duplication claim is overstated

The plan says `getStateLabel` is duplicated in `TorrentCard.tsx`, `torrent/[hash].tsx`, and `ExpandableTorrentCard.tsx`. In reality:

- `TorrentCard.tsx` — yes, has `getStateLabel`
- `torrent/[hash].tsx` — yes, has `getStateLabel` (different implementation using `state.includes()` vs exact matches)
- `ExpandableTorrentCard.tsx` — **no `getStateLabel`**, only has inline `stateColor` logic

Task 1.6 should note that `getStateLabel` exists in 2 files, not 3. `getStateColor` exists in 2 files as a function plus 1 inline implementation.

### 4. `TorrentDetails.tsx` is 2,086 lines — not listed in Task 1.7 header candidates correctly

`TorrentDetails.tsx` is the **largest file in the codebase** at ~2,086 lines, larger even than `settings.tsx` (1,958). It is listed in Task 1.7 but its extreme size deserves special mention — it may benefit from extraction (similar to how Task 2.7 splits settings).

---

## Warnings (should fix for accuracy, low execution risk)

### 5. Invalid `rgb()` usage is more widespread than stated

The AGENTS.md template mentions fixing `rgb(0, 0, 0,1)` format in Task 2.1. The actual scope is much larger — `ThemeContext.tsx` has **many** colors using `rgb()` with 4 parameters (an alpha channel), which is invalid CSS/RN syntax:

- Light theme: `text: 'rgb(0, 0, 0,1)'`, `textSecondary: 'rgb(142, 142, 147,1)'`, etc.
- Dark theme: `text: 'rgb(255, 255, 255,1)'`, `textSecondary: 'rgb(190, 190, 190,1)'`, etc.
- Both themes: `error: 'rgb(255, 13, 0,0.5)'`, `success: 'rgb(4, 134, 37,0.5)'`, etc.

Task 2.1 should explicitly enumerate all invalid `rgb()` calls, or state "fix all `rgb()` calls that include an alpha parameter — change to `rgba()`".

### 6. `expo-dev-client` is in dependencies

`package.json` includes `"expo-dev-client": "~6.0.20"` in dependencies. The AGENTS.md template warns "do NOT add native modules that require `expo-dev-client`" — but `expo-dev-client` is already installed. This isn't necessarily wrong, but the AGENTS.md guidance implies Expo Go is the only workflow. Agents should be aware that dev-client builds may also be in use. Clarify whether the project uses Expo Go exclusively, or also uses development builds.

### 7. Quick Connect panel duplication is larger than described

Task 1.6 says the Quick Connect panel is "~100 lines of identical JSX." The actual duplication is substantially larger — each instance includes avatar rendering, server card layout, error handling, connect/retry buttons, and the "add another server" row. Additionally, `transfer.tsx` uses hardcoded English strings while `index.tsx` uses i18n. The extraction in Task 1.6 should note this i18n inconsistency and ensure the shared component uses `t()`.

### 8. `getStateColor` implementations have diverged

The plan notes this as a risk ("Verify that each inline copy has identical logic before deduplicating") — good. To be specific:

- `TorrentCard.tsx` uses a `switch` statement
- `torrent/[hash].tsx` uses `if/else` chains
- `ExpandableTorrentCard.tsx` uses nested ternaries inline

The canonical version in `utils/torrent-state.ts` should be tested against all three to ensure no behavior changes.

### 9. Missing risk: `TorrentCard.tsx` imports claim

Task 2.2 says "TorrentCard is imported in 5+ files." This should be validated before execution. If some of those imports are from dead code files (e.g., `AnimatedTorrentCard.tsx`), the "blast radius" is smaller than stated.

---

## Suggestions (improvements to the plan)

### 10. Task 1.5 should account for InputModal's empty-value behavior

The plan notes: "InputModal validates non-empty trimmed value. Some prompts accept empty (e.g. '0' for unlimited)." This is a critical risk. Before replacing Alert.prompt calls, an agent should **read InputModal.tsx's onConfirm logic** to verify whether it passes through empty/zero values. If it blocks them, InputModal needs a prop like `allowEmpty?: boolean` — and that prerequisite should be an explicit sub-task.

### 11. Task 1.8 dependency on Task 1.6

Task 1.8 says to create `tests/utils/torrent-state.test.ts` testing `getStateColor` and `getStateLabel` "after Task 1.6 extracts them." Since Phase 1 tasks are described as "truly independent — run them all in parallel," this is a contradiction. Either:
- Move the `torrent-state.test.ts` creation to after Task 1.6, or
- Note that Task 1.8 has a partial dependency on Task 1.6, or
- Have the test import directly from the duplicated location and update the import path later

### 12. Task 2.2 and Task 1.5 have an implicit dependency

Task 1.5 explicitly skips `TorrentCard.tsx` Alert.prompt fixes ("Task 2.2 will remove all action handlers"). But Task 2.2 says the actions move to `useTorrentActions.ts` and "must use InputModal, not Alert.prompt." This means the one Alert.prompt callsite in TorrentCard.tsx gets fixed as part of Task 2.2, not Task 1.5. This is stated correctly but could be clearer — add a note in Task 2.2's acceptance criteria: "Zero `Alert.prompt` calls remain in `TorrentCard.tsx` or `useTorrentActions.ts`."

### 13. Consider adding a task for `app/onboarding.tsx`

The file exists as a dead route (nothing navigates to it, no gate in `_layout.tsx`). It's listed in Task 3.5's dead code section implicitly (AGENTS.md says "route exists but nothing navigates to it"), but it's **not** in the explicit deletion list for Task 3.5. Either add it to the deletion list or note that it's intentionally kept for future use.

### 14. LOC and file count are accurate

The plan states "~23,000 LOC · 70+ source files." Actual: **23,348 LOC · 72 files**. This is accurate.

### 15. Phase ordering and dependency graph are sound

The dependency constraints are correctly stated:
- Phase 1 tasks are genuinely independent (with the exception of 1.8's partial dependency on 1.6, noted above)
- Phase 2 ordering (2.1 → 2.2 → 2.4/2.5, with 2.3/2.6/2.7 parallel after 2.1) is correct
- Phase 3 sequential ordering makes sense

### 16. The `avatarColor` palettes have different constant names but same values

`index.tsx` uses `AVATAR_PALETTE` and `transfer.tsx` uses `AVATAR_PALETTE_T`. The values are the same. Task 1.6 should note that only one constant is needed in the shared `utils/server.ts`.

---

## Summary

| Category | Count |
|----------|-------|
| Errors (must fix) | 4 |
| Warnings (should fix) | 5 |
| Suggestions | 7 |

The plan is **ready for execution** after fixing the 4 errors above. The warnings and suggestions improve accuracy but won't cause agent failures if left as-is. The overall architecture, phasing, risk identification, and task decomposition are strong.
