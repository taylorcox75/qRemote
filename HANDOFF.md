# Handoff: Server Settings rebuild, category/tag colors, path autocomplete

**Branch:** `feature/#121-#87` (based on `dd3a062`)
**Scope of this doc:** only the changes described below — this branch also carries unrelated pre-existing/concurrent RSS work (`app/(tabs)/rss/*`, deletion of `rule.tsx`/`rules.tsx`) that this session did not touch and did not review.

## Context

Started as "rename the Torrent List settings screen to Server Settings and add Saving Management options" and grew, across many rounds of user feedback, into a full rebuild of that screen plus two adjacent features (per-category/tag sticker colors, directory-path autocomplete). Everything below was driven by explicit user requests in-session; nothing was speculative.

## 1. Server Settings screen (`app/(tabs)/settings/torrent-defaults.tsx`)

Renamed from "Torrent List" and reorganized to mirror qBittorrent's actual Downloads preferences tab (verified field-by-field against qBittorrent's live source, not guessed — see "API field verification" below):

- **Categories / Tags** (moved to top, right after Sorting & Filtering) — chip-based UI matching each other's style. Categories now fetch fresh from `categoriesApi.getAllCategories()` on focus instead of `TorrentContext`'s cached sync snapshot, because qBittorrent's incremental sync only reports categories *added* since last request, not *edited* — a real bug this fixes (a category's save path changed externally, e.g. via Radarr, would never refresh in the old code path).
  - Tapping a category chip opens a floating edit modal (Category Name + Category Save Path). Renaming is a real rename: since qBittorrent's API has no rename endpoint, it creates the new category, reassigns any torrents currently in the old one (`torrentsApi.getTorrentList` + `setTorrentCategory`), then deletes the old category — no orphaned torrents.
  - Save Path field placeholder (when empty) shows `{defaultSavePath}/{categoryName} (Default)` — illustrative only, never written as an actual value.
- **Torrent Behavior** — unchanged app-specific extras (pauseOnAdd, autoCategorizeByTracker, firstLastPiecePriority).
- **Add Torrent** (+ Duplicate Torrents subsection) — content layout, add-to-top-of-queue, stop condition, merge trackers, delete-.torrent-after-adding.
- **Files** — pre-allocate disk space, `.!qB` extension, unwanted-files folder.
- **Save Locations** — TMM mode + the three relocate-on-change fields as dropdowns (not toggles — matches the real WebUI's `<select>` semantics), use-category-paths, default save path, keep-incomplete-in, copy-.torrent-file paths (each with an always-visible path row separate from its toggle, edit icon on the path row itself).
- **Automatic Import** — monitored folders (add/remove, per-folder override picker: Monitored Folder / Default Location / Other...), excluded file names.
- **Advanced** (new nested screen, `server-settings-advanced.tsx`) — Email Notifications + Automation run-scripts, kept off the main screen per user request to avoid clutter.

### API field verification
All qBittorrent preference field names (`auto_tmm_enabled`, `torrent_changed_tmm_enabled`, `use_category_paths_in_manual_mode`, `torrent_content_layout`, `use_unwanted_folder`, `add_to_top_of_queue`, `torrent_stop_condition`, `merge_trackers`, `auto_delete_mode`, `scan_dirs`, `excluded_file_names*`, `mail_notification_*`, `autorun_*`, `export_dir`/`export_dir_fin`) were cross-checked against qBittorrent's actual `appcontroller.cpp` and `preferences.html` source (not the wiki, which is stale/incomplete for some of these) — **reviewer should spot-check a couple of these against a live qBittorrent 5.x server if possible**, since I could not run one in this environment.

### Known gap
`torrent_content_layout` (3-way enum) is used instead of the older `create_subfolder_enabled` boolean, which I initially implemented wrong and then corrected — worth a second look that the OptionPicker values (`Original`/`Subfolder`/`NoSubfolder`) exactly match server expectations.

## 2. Category/tag sticker colors

New user-configurable coloring system, separate from the existing `customColors`/`ColorTheme` structure (deliberately — `ColorTheme` is a closed set of named theme-role keys stored per dark/light mode; category/tag names are arbitrary, so a new structure was required to avoid touching the Critical-Rule-3-protected `colors` object).

- **`types/preferences.ts`**: new fields `defaultCategoryColor`, `defaultTagColor`, `categoryColors: Record<string,string>`, `tagColors: Record<string,string>` — all additive, all read with `prefs.field || default` fallback everywhere (verified — see Backward Compatibility below).
- **New screen** `app/(tabs)/settings/category-tag-colors.tsx`, linked from Theme & Colors (`theme.tsx`) with its own reset button.
- **`components/TorrentCard.tsx`**: category/tag stickers render as an icon (folder/tag) tinted with the resolved color (`categoryColors[name] ?? defaultCategoryColor ?? avatarColor(name)` — `avatarColor` is the pre-existing hash-based fallback, so cards render sensibly even before a user ever visits the new color screen) + label text in the card's normal secondary text color. Sticker text size matches the "Downloaded / Total" text next to it (12pt) per explicit request. This went through several rounds of live user iteration (filled chip → outline circle → icon-only, opacity 0.22 → 0.55, color-on-text → theme-text) — **worth a fresh visual check on a real device**, since I could not render any of this myself.
- **Server Settings chips** (torrent-defaults.tsx) got the same treatment for consistency: icon tinted with resolved color, neutral border (glow/solid-fill were tried and explicitly reverted per user feedback — final state is icon-only tint).

## 3. Directory path autocomplete

New `components/PathAutocompleteInput.tsx`, a drop-in `TextInput` replacement. When connected to qBittorrent 5.0+ (`GET /api/v2/app/getDirectoryContent`, verified against live qBittorrent source — **not documented in the WebUI API wiki**, so if a reviewer checks the wiki and doesn't find it, that's expected, not a hallucination), it suggests directory names as the user types, mirroring the official WebUI's `pathAutofill.js` mechanism (list the parent directory, filter suggestions client-side).

- New `ApiFeatures.supportsGetDirectoryContent` flag in `utils/apiVersion.ts`, gated the same way as other WebAPI-2.11+ features.
- New `applicationApi.getDirectoryContent(dirPath, mode)` in `services/api/application.ts`.
- Wired into every directory-path field in the app: `InputModal` (new `pathAutocomplete` prop) for default save path, temp path, copy-`.torrent` dirs, monitored-folder "Other" path; and direct `PathAutocompleteInput` usage for the category add/edit forms, monitored-folder add form, and the add-torrent screen's save path + new-category path fields.
- **Untested against a live server** — the parent-directory-detection logic (`text.startsWith('/')`, split on last `/`) assumes Unix-style absolute paths; Windows-hosted qBittorrent servers won't get suggestions (silently, not an error) since qBittorrent's own `dir.isAbsolute()` check also wouldn't match a bare `C:\...` the way this client-side heuristic expects. Worth deciding if that's acceptable or needs a Windows path branch.

## 4. `autoCategorizeByTracker` wiring (`app/(tabs)/search.tsx`)

This preference existed before this session but was dead — saved, never read anywhere. Wired up: when enabled, torrents added from Search get tagged (not categorized, despite the pref's name — this was clarified by the user mid-session) with the result's tracker/indexer label (`resultTrackerLabel`, an existing heuristic already used for the search screen's tracker filter chips).

- `torrentsApi.addTorrent` path: tag passed directly in the add call (reliable, no polling).
- `searchApi.downloadTorrent` path (plugin-native downloads): qBittorrent never reports which torrent it added, so a new `tagNewlyDownloadedTorrent()` polls the torrent list (up to 8× / 2s) for a name match, then tags it — silently, no toast, best-effort only. **This is the one part of this session's work with no reconciliation guarantee** — if two identically-named results are added in quick succession, or the torrent never appears within ~16s, tagging silently fails (logged via `clogWarn`, not surfaced to the user). Flagging for review since it's the least deterministic piece.

## Backward compatibility (explicitly audited this session)

- **No preference key was renamed or removed** — `types/preferences.ts` and `types/api.ts` changes are 100% additive (new optional fields / new keys with fallback defaults).
- **Every new preference read** goes through `prefs.field || DEFAULT_PREFERENCES.field` (or `|| {}` for the two color-override maps) — confirmed via `grep` across every call site touching `defaultCategoryColor`/`defaultTagColor`/`categoryColors`/`tagColors`. An existing user's stored `AsyncStorage` blob (missing these keys entirely) degrades cleanly to defaults on first load post-upgrade.
- **Every new `savePreferences()` call spreads `...prefs` first** (fetched immediately prior) — verified no call site does a bare overwrite that would wipe unrelated stored settings.
- **Settings export/import** (`advanced.tsx`) round-trips the whole preferences blob with no strict schema check — old exports import fine into the new app (missing new keys → defaults), and new exports would import fine into an older app build (extra unknown keys are just ignored).
- **No route was removed**; `torrent-defaults.tsx`'s route path (`/settings/torrent-defaults`) is unchanged, only its nav label and internal content changed. Two new routes were added (`server-settings-advanced`, `category-tag-colors`) — purely additive.
- **`i18n` key renames** (`torrentList` → `serverSettings`, and a few `categoryUsesDefaultSavePath`-style churn) are label-only; nothing in stored user data references i18n keys by name, so these carry zero data-loss risk. Confirmed no dangling references to old key names remain in code.
- The category-rename flow (delete-old/create-new via the edit modal) is a **write operation gated behind explicit user action** — it never runs automatically on app launch/upgrade, so it isn't an upgrade risk, only a feature to review for correctness in normal use.

## Verification status

- `npx tsc --noEmit`: clean.
- `npm test`: 848/848 passing (includes updated assertions for the intentional opacity/text-size changes in `TorrentCard.test.tsx`, a new `ServerContext` mock added to `InputModal.test.tsx` to isolate it from the new `PathAutocompleteInput` import chain, and 3 new `apiVersion.test.ts` assertions for the new feature flag).
- `npm run lint`: 0 errors repo-wide (199 warnings, consistent with the project's documented pre-existing baseline — none of these are new `no-unused-vars`/etc. from this session's files).
- **Not verified**: nothing in this session was checked on an actual device/simulator or against a live qBittorrent server. All qBittorrent API field names were checked against source code, not tested at runtime. This is the single biggest gap for a reviewer to close.

## Suggested review order

1. `types/preferences.ts` + `types/api.ts` diffs — confirm the compatibility audit above by inspection.
2. `app/(tabs)/settings/torrent-defaults.tsx` — largest and highest-risk file; check the category-rename flow (`handleSaveCategoryEdit`) and the new server-preference field names against a live server if at all possible.
3. `components/PathAutocompleteInput.tsx` + `components/InputModal.tsx` — small, self-contained, easy to verify in isolation.
4. `components/TorrentCard.tsx` — mostly styling; low functional risk, but visually unverified.
5. `app/(tabs)/search.tsx` `tagNewlyDownloadedTorrent` — the one non-deterministic piece; decide if the best-effort/silent-failure behavior is acceptable as-is.
