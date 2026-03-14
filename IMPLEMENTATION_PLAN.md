# Implementation Plan: Torrent Display & Controls Improvements

**Branch:** `cursor/torrent-display-and-controls-4bad`  
**Base:** `main`

---

## 1. Alternative Speed Limits Display

**Problem:** When alternative speed limits are enabled (`use_alt_speed_limits === true`), the speed limits bar on the Transfer screen shows the *regular* limits (`dl_rate_limit`, `up_rate_limit`) instead of the *alternative* limits that are actually in effect.

**Current behavior:** `app/(tabs)/transfer.tsx` lines 424–648 always display `transferInfo.dl_rate_limit` and `transferInfo.up_rate_limit`. The qBittorrent API stores alternative limits separately in application preferences (`alt_dl_limit`, `alt_up_limit` in kB/s).

**Plan:**
1. **Fetch alt limits when alt mode is on:** In `TransferContext` or the Transfer screen, when `use_alt_speed_limits === true`, call `applicationApi.getPreferences()` to get `alt_dl_limit` and `alt_up_limit` (in kB/s).
2. **Convert units:** qBittorrent preferences use kB/s; convert to bytes for display/consistency (`alt_dl_limit * 1024`).
3. **Update speed limits bar:** In the "Limits" bar (lines 424–448 of `transfer.tsx`), when `isAltSpeedEnabled`:
   - Use `alt_dl_limit`/`alt_up_limit` instead of `dl_rate_limit`/`up_rate_limit` for display.
   - Optionally add a small badge like "Alt" so it’s clear alternative limits are active.
4. **SpeedGraph maxValue:** Pass the effective limits (alt or regular) to `SpeedGraph` so the graph scale reflects the correct ceiling.

**Files:** `app/(tabs)/transfer.tsx`, `context/TransferContext.tsx`, `services/api/application.ts`, `types/api.ts` (extend `ApplicationPreferences` if needed).

---

## 2. Pause Button on Main Card (Far Right)

**Problem:** User wants a pause button “on the main card display or something far right.” The card currently has a small play/pause control next to the progress bar.

**Current layout (TorrentCard):**
- Row 1: Title | Status badge | Menu (⋮)
- Row 2: Progress bar | Play/Pause button (compact, ~28×28)
- Row 3: Stats (compact) or expanded stats

**Plan:**
1. **Add a prominent pause button on the right:** In `components/TorrentCard.tsx`, add a pause/play button in the header row on the far right, before or instead of/in addition to the existing one.
2. **Layout options:**
   - **A:** Move the play/pause from beside the progress bar to the far right of the header (next to the menu or replacing a redundant element).
   - **B:** Keep both: one inline with progress bar and one as a more visible icon on the far right.
3. **Recommendation:** Put the primary pause/play button on the far right of the header (before the menu button). Make it larger and easier to tap. Keep progress bar full width without an inline button to avoid crowding.
4. **Consider:** Moving the menu (⋮) slightly left so the pause button is the rightmost element for quick one-hand access.

**Files:** `components/TorrentCard.tsx`

---

## 3. Progress Bar Appears Never 100%

**Problem:** At 100% progress, the bar doesn’t look fully filled because there’s too much horizontal space.

**Current styling (`TorrentCard`):**
```tsx
progressBar: {
  flexGrow: 1,
  flexShrink: 1,
  height: 5,
  minWidth: 80,
  ...
}
```

**Plan:**
1. **Fix fill width:** Ensure `progressFill` uses `width: \`${progress}%\`` on the *parent* progress bar’s actual width, not a sibling that grows differently. Verify the parent has a defined width (e.g. `flex: 1` so it takes remaining space).
2. **Cap progress at 100:** Use `Math.min(100, progress)` so values slightly over 100 don’t cause layout issues.
3. **Optional visual tweaks:**
   - Add `overflow: 'hidden'` and `borderRadius` so the fill doesn’t stick out.
   - At 100%, consider a different style (e.g. solid color, checkmark) to make completion obvious.
4. **Check `TorrentCard` structure:** The progress bar is in `progressBarRow` with `flexGrow: 1`; the fill should correctly occupy a percentage of that. Re-check if the pause button or other flex siblings are stealing space.

**Files:** `components/TorrentCard.tsx`

---

## 4. Pause-on-Add Setting Bug

**Problem:** Pause-on-add was “off” in the UI, but new torrents were added paused. After toggling the setting a few times, it started behaving correctly.

**Possible causes:**
- Stale/default value on first load.
- Race between loading preferences and adding a torrent.
- Toggle not writing to storage before add.
- UI state not synced with persisted preference.

**Current flow:**
- **Settings:** `app/(tabs)/settings.tsx` — `pauseOnAdd` from `loadPreferences()` (line 205), toggle calls `savePreference('pauseOnAdd', value)`.
- **Add torrent:** `app/(tabs)/index.tsx` `handleSubmitTorrent` (line 414) — `prefs = await storageService.getPreferences()`, then `stopped: prefs.pauseOnAdd === true`.
- **Storage:** `storageService.getPreferences()` returns `{}` if no data; `prefs.pauseOnAdd` can be `undefined`, so `undefined === true` is `false`.

**Plan:**
1. **Explicit default:** When loading preferences, set `pauseOnAdd: prefs.pauseOnAdd === true` (treat `undefined` as `false`). Ensure default is consistent in both Settings and Add flow.
2. **Await save on toggle:** Confirm `savePreference` is awaited when the switch changes. In Settings, the switch `onValueChange` should `await savePreference('pauseOnAdd', value)` and only then update local state if desired (or rely on persisted value).
3. **Read at add time:** Keep reading `storageService.getPreferences()` right before add; avoid using in-memory React state for the add decision.
4. **Debugging:** Add optional logging (or a debug screen) to log `prefs.pauseOnAdd` at add time and after toggle, to verify write/read order.
5. **Optional:** Add a “Pause on add” toggle in the Add Torrent modal so the user can override the global setting per-add.

**Files:** `app/(tabs)/settings.tsx`, `app/(tabs)/index.tsx`, `services/storage.ts`

---

## 5. Detailed View (Non-Compact) – More Torrent Info

**Problem:** Non-compact view is the “detailed” view but doesn’t show enough information. User wants more fields like “originally.”

**Current expanded content in `TorrentCard`:**
- DL Speed, ETA, Downloaded, UL Ratio, Availability.
- UL Speed, Percent, Size, Seeds, Peers.

**Plan:**
1. **Review old design:** If there’s git history or specs for the original detailed card, compare and restore missing fields.
2. **Add more fields (as available from `TorrentInfo`):**
   - `added_on` (formatted date)
   - `completed` / `completion_on`
   - `category`
   - `tags`
   - `save_path` (truncated)
   - `tracker` (primary tracker, truncated)
   - `time_active` (formatted)
   - `downloaded_session` / `uploaded_session`
   - `max_ratio` / `seeding_time_limit` (if relevant)
3. **Layout:** Use a grid or list of label/value pairs, grouped by: General, Transfer, Seeds/Peers, Limits/Paths.
4. **Rename:** Consider renaming “expanded” to “detailed” in settings and UI copy for clarity.

**Files:** `components/TorrentCard.tsx`, `app/(tabs)/settings.tsx` (card view mode labels), `types/api.ts` (TorrentInfo fields)

---

## 6. Search Bar Layout – Center with Sort & Add

**Problem:** Search bar is not centered. Desired layout: **Sort by** (left) | **Search** (center) | **Add new torrent** (right).

**Current layout (`app/(tabs)/index.tsx` ~lines 578–637):**
- `searchRow`: Search input (flex: 1), optional sync indicator, Sort button.
- No “Add new torrent” in the header (handled by FAB).

**Plan:**
1. **Header structure:** Implement a 3-column header:
   - **Left:** “Sort by” control (dropdown/picker showing current sort + direction).
   - **Center:** Search input, with `flex: 1` and `alignSelf: 'stretch'` so it takes remaining space and stays centered.
   - **Right:** “Add new torrent” button (or icon + label).
2. **Flexbox:** Use `flexDirection: 'row'`, `justifyContent: 'space-between'`, `alignItems: 'center'`, with left/right having `minWidth` or fixed width so the center can grow.
3. **Sort control:** Move the sort dropdown trigger to the left; keep the same options.
4. **Add button:** Either move the FAB into the header as a pill/button, or add a separate header button that opens the add modal (and optionally hide or reduce the FAB when header is visible).
5. **Sync indicator:** Place it so it doesn’t break the 3-column layout (e.g. inside the search area or as a small badge).

**Files:** `app/(tabs)/index.tsx`

---

## Implementation Order (Suggested)

1. **Pause-on-Add bug** – Fix first, as it affects behavior.
2. **Progress bar at 100%** – Quick fix.
3. **Search bar layout** – UX improvement, moderate effort.
4. **Pause button placement** – Clear UX change.
5. **Detailed card info** – Expand content in expanded view.
6. **Alternative speed limits display** – May require new API usage and preference fetching.

---

## Testing Checklist

- [ ] Alt speed on: limits bar shows alt limits; off: shows regular limits.
- [ ] Pause button on card is easy to tap and behaves correctly.
- [ ] 100% progress fills the bar completely.
- [ ] Pause-on-add: add with toggle off → not paused; on → paused; persists across app restart.
- [ ] Detailed view shows all planned fields.
- [ ] Search bar: Sort left, search center, Add right; layout correct on different screen sizes.
- [ ] All changes on `cursor/torrent-display-and-controls-4bad`; commit and push incrementally.

---

## Notes

- Use the same branch for all changes; push as you complete each item.
- Prefer small, focused commits over a single large change.
- If qBittorrent’s transfer/info returns effective limits when alt is on, the alt-limits work can be simplified to just using that response.
