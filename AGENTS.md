# AGENTS.md

## Project Overview
qRemote is a React Native (Expo SDK 57) mobile app for remotely controlling
qBittorrent servers via the WebUI API v2. Runs on iOS and Android via Expo Go.

## Dev Commands
- `npm start` — Start Expo dev server (Expo Go)
- `npm run ios` — iOS simulator
- `npm run android` — Android emulator

### Verification (COMMIT TIME ONLY — never mid-task)
Do NOT run typecheck, tests, or lint after individual edits or "to be safe" while working — on this hardware (Raspberry Pi) every run is expensive and the user has explicitly said not to. Run the checks ONCE, as a batch, only when getting ready to commit:
- `npx tsc --noEmit` — typecheck (currently clean; incremental via `.tsbuildinfo`, ~25s warm / ~85s cold)
- `npm test` — Jest (ts-jest), 241 tests across 14 suites. When only one module changed, `npm test -- tests/utils/<name>.test.ts` runs a single suite (~18s vs minutes)
- `npm run lint` — the warning baseline (~149, all pre-existing) is expected noise. Zero *errors* is the bar.
- `npm run format` — Prettier

### File Index (complete map — trust it, don't re-explore; only open the files you're changing)

**Screens (`app/`, Expo Router):**
- `app/(tabs)/index.tsx` — Torrents list: filters/sort/swipe actions, collapsing header (scroll pattern copied in search.tsx)
- `app/(tabs)/search.tsx` — Search tab: job polling UI, plugin/category/indexer filter chip rows, client-side sort, collapsing header
- `app/(tabs)/transfer.tsx` / `app/(tabs)/settings.tsx` / `app/(tabs)/logs.tsx` — transfer stats, settings hub, connectivity logs
- `app/(tabs)/_layout.tsx` — tab bar; `app/_layout.tsx` — root providers/theme/deep-link handling
- `app/settings/` — sub-screens, names = content: `about`, `add-torrent-dialogue`, `advanced`, `appearance`, `detailed-card-fields`, `notifications`, `servers`, `theme`, `torrent-defaults`, `whats-new`
- `app/torrent/[hash].tsx` — torrent detail (single source; old TorrentDetails.tsx component was deleted); `app/torrent/files.tsx` — file list/priorities; `app/torrent/manage-trackers.tsx` — tracker add/edit/remove
- `app/torrents/add.tsx` — add-torrent flow (magnet/.torrent, options)
- `app/search/plugins.tsx` — search plugin install/enable/uninstall
- `app/server/add.tsx`, `app/server/[id].tsx` — server add/edit; presented as native modal sheets → they mount `<ModalToast/>` locally (see ToastContext)

**Contexts (`context/`):**
- `ServerContext.tsx` — connection lifecycle; `checkAndReconnect()` ALWAYS does a full re-login (no session-validity probe) and de-dupes concurrent calls via a shared in-flight promise. qBittorrent ties search jobs to the session — never call it eagerly on foreground/AppState events, only reactively after a request actually fails
- `TorrentContext.tsx` — rid-based incremental torrent sync + the reactive auto-reconnect effect other providers piggyback on
- `TransferContext.tsx` — transfer-info poll; relies on TorrentContext's reactive reconnect
- `ToastContext.tsx` + `components/Toast.tsx` — global toast is a plain view (NEVER wrap in RN `<Modal>` — a Modal captures all touches and freezes the UI); native-modal-sheet screens need the locally-mounted `ModalToast`
- `ThemeContext.tsx` — `useTheme()`, `colors` object, user color overrides; `ApiVersionContext.tsx` — detected qBittorrent API version → feature gating via `utils/apiVersion.ts`

**Components (`components/`, all PascalCase function components taking a `…Props` interface):**
- Modals/pickers: `ActionMenu`, `InputModal` (preferred over `Alert.prompt`), `OptionPicker`, `MultiSelectPicker`, `CategoryModal`, `TagsModal`, `ColorPicker`
- Torrent/search UI: `TorrentCard` (React.memo with custom comparator — keep it in sync when adding rendered fields), `SearchResultRow` (+internal ActionPill), `FilterChip`, `EmptyState`, `SkeletonLoader` (+`SkeletonTorrentCard`)
- Visuals: `SpeedGraph`, `CircularProgress`, `AnimatedProgressBar`, `AnimatedButton`, `Confetti`
- Chrome/diagnostics: `FocusAwareStatusBar`, `SettingRow`, `QuickConnectPanel`, `LogViewer`, `DebugRow`, `SuperDebugPanel` (connection diagnostics steps)

**API wrappers (`services/api/`, thin objects over `apiClient`):**
- `client.ts` — `apiClient` axios singleton; normalizes HTTP errors into human-text `Error`s (callers substring-match these — grep before rewording any message); holds server config, cookies, API version, Basic Auth header
- `auth.ts` (login/logout) · `sync.ts` (getMainData rid-sync, getTorrentPeers) · `transfer.ts` (global speed limits, alt-speed toggle, banPeers) · `application.ts` (version/buildInfo/preferences/cookies) · `categories.ts` · `tags.ts` · `logs.ts` (main+peer logs) · `search.ts` (job start/stop/status/results/delete + plugin management + downloadTorrent)
- `torrents.ts` — everything per-torrent: list/properties/trackers/webseeds/contents/pieces, pause/resume/delete/recheck/reannounce, add (URL+file), tracker & peer edits, priorities (queue + file), limits/share-limits, location/name/category/tags, AMM/sequential/firstLastPiece/forceStart/superSeeding, renameFile/renameFolder

**Services (`services/`):**
- `server-manager.ts` — server CRUD + connect/reconnect/test (`ConnectionTestResult`, `isNetworkError`)
- `storage.ts` — AsyncStorage preferences (typed shape + defaults in `types/preferences.ts`)
- `query-client.ts` — shared TanStack `QueryClient`; `color-theme-manager.ts` — save/load/apply user color themes
- `connectivity-log.ts` — in-memory ring log, `clogDebug/Info/Warn/Error(tag, msg)`; `log-storage.ts` — persisted log entries for the Logs tab

**Hooks (`hooks/`):**
- `useSearchJob.ts` — search job lifecycle: start/stop/delete, 2s status+results polling, cleanup on unmount
- `useTorrentActions.ts` — builds the per-torrent action menu (pause/resume/delete/etc.) used by list + detail
- `useReactiveReconnect.ts` — feeds query errors into ServerContext reconnect (`isReconnectableError`)
- `useSpeedTracker.ts` / `useSpeedHistory.ts` — sampling for SpeedGraph

**Utils (`utils/`, pure, well-tested — add logic here when it doesn't need React):**
- `format.ts` (size/speed/time/ratio/percent/progress/availability/date — progress & availability FLOOR, never round up) · `torrent-state.ts` (state→color/label, completion/eta rules) · `error.ts` (`getErrorMessage`) · `apiVersion.ts` (parse + `ApiFeatures` gating) · `server.ts` (endpoint resolution incl. fallback URL, avatar colors) · `magnet.ts` / `torrent-file.ts` (incoming link/file parsing) · `searchResult.ts` (indexer-label heuristics) · `login-response.ts` (qBittorrent login body/cookie interpretation) · `basicAuth.ts` · `haptics.ts` (global toggle + wrappers) · `tags.ts` (CSV tag parsing) · `add-torrent-dialogue.ts` (compact/full variant choice) · `version.ts` (`APP_VERSION`)

**i18n:** `i18n/index.ts` initializes react-i18next; each locale is ONE file `locales/{en,es,zh,fr,de,ru}/translation.json` containing all namespaces: `common`, `states`, `screens`, `placeholders`, `actions`, `alerts`, `server`, `torrentDetail`, `filters`, `sort`, `toast`, `errors`. Keys look like `t('actions.pause')`.

**Types/constants:** `types/api.ts` (all qBittorrent API shapes, `TorrentInfo`, `ServerConfig`), `types/preferences.ts` (typed prefs + defaults); `constants/`: `changelog.ts` (in-app "What's New" — see Changelog discipline), `spacing.ts`, `typography.ts`, `shadows.ts`, `buttons.ts` (shared style tokens — use these, don't invent ad-hoc spacing)

### Task Recipes (exact touch-lists for recurring changes — follow, don't rediscover)
- **Add/change a user-facing string:** add the key to ALL SIX `locales/*/translation.json` (really translate — the parity test rejects lazily-copied English ≥16 chars), use via `t('ns.key')`. Verify with `npm test` (parity test will name any file you missed).
- **Add a preference:** typed shape + default in `types/preferences.ts` → read/write via `storageService` (`services/storage.ts`) → UI in the relevant `app/settings/*` screen using `SettingRow` + `OptionPicker`/switch → i18n the label (recipe above). NEVER rename existing keys.
- **Add a qBittorrent API call:** method on the matching `services/api/*.ts` object (follow its neighbors' style) → response/param types in `types/api.ts` → if availability depends on qBittorrent version, gate via `ApiFeatures` in `utils/apiVersion.ts`.
- **Add a torrent action:** API method (above) → menu item in `hooks/useTorrentActions.ts` → strings in `actions`/`toast` namespaces.
- **Add a settings sub-screen:** create `app/settings/<name>.tsx` (copy structure of a sibling — the route registers itself, `_layout.tsx` needs no edit), link from `app/(tabs)/settings.tsx`.
- **User-facing change of any kind:** finish with the Changelog discipline step (Critical Rule 8).

## Architecture
- **Routing:** Expo Router file-based routing in `app/`. The `(tabs)` directory uses parentheses because Expo Router requires this syntax for route groups — it is a framework convention, not a naming choice. The parens cannot be removed.
- **State:** React Context + TanStack Query (ThemeContext, ServerContext, TorrentContext, TransferContext, ToastContext)
- **Data sync:** TanStack Query with `refetchInterval` (2-3s), rid-based incremental sync for torrents via custom queryFn
- **Storage:** AsyncStorage for preferences, SecureStore for passwords
- **API:** Thin wrappers in `services/api/` over a singleton axios-based `apiClient`
- **Styling:** All colors via `useTheme()` → ThemeContext. Users can override any color via the color picker.
- **i18n:** react-i18next with 6 locales (en, es, zh, fr, de, ru). `tests/locales/i18n-parity.test.ts` guards against locale drift: it fails if a locale is missing/adds keys vs `en`, or if a long string (≥16 chars) is left byte-identical to the English source (the exact failure mode that let the `torrentDetail` namespace regress to ~170 untranslated keys per locale in v3.5.1). Legitimate coincidental matches (loanwords like "tracker"/"Status"/"OK", literal URL/path placeholders) are tracked in that test's `COINCIDENTAL_MATCH_ALLOWLIST` — extend it only after verifying by hand that a match is intentional, not a translation gap. A few screens may still have hardcoded English strings; when you touch a screen, i18n any you find.
- **Basic Auth credentials:** Reverse-proxy Basic Auth (`useBasicAuth`, added in #118) follows the same secure-storage split as the main server password: `basicAuthUsername` is plain text in AsyncStorage (`services/storage.ts`), but `basicAuthPassword` is written to `expo-secure-store` under `server_basic_auth_password_{id}` and stripped to `''` before the server record is persisted to AsyncStorage. `services/api/client.ts` reads it back off the in-memory `ServerConfig` to build the `Authorization` header via `utils/basicAuth.ts`. Follow this pattern for any future per-server secret.

## Critical Rules
1. NEVER hardcode colors — always use `useTheme()` and `colors.*`
2. Prefer `InputModal` over `Alert.prompt` for user text input. `Alert.prompt` is iOS-only, which is acceptable for the current iOS-first focus, but `InputModal` is already available and provides a consistent UX.
3. NEVER rename keys in the `colors` object (ThemeContext) — users store color overrides keyed by these names in AsyncStorage. Renaming silently breaks their customizations.
4. NEVER rename preference keys — there is no migration system. Old keys become orphaned.
5. All user-facing strings must use i18n: `const { t } = useTranslation()` then `t('key')`.
6. The preferences object is `Record<string, any>` — see `types/preferences.ts` for the typed version.
7. Color defaults use mixed formats (rgb, rgba, hex). The color picker only handles 6-digit hex. Changing a default from `rgba(...)` to `#hex` removes the alpha channel and changes visual appearance.
8. **Changelog discipline (user-facing changes only).** The in-app "What's New" panel reads `constants/changelog.ts` (`CHANGELOG`, newest first). When your change is **user-facing** (feature, bug fix, visible UI/behavior change):
   1. Compare `package.json` `version` to the top entry `CHANGELOG[0].version`.
   2. **If they are EQUAL** → the latest entry is already released. Add ONE **new** entry at the top with a **patch bump only** (`x.y.(z+1)`), today's date (`YYYY-MM-DD`), and your change in `changes[]`. **Do NOT touch `package.json`** — the release process owns the app version.
   3. **If they DIFFER** (changelog is ahead of package.json) → a previous agent already opened the unreleased entry. **Append** your change line to that top entry's `changes[]`. Do **NOT** create a new entry and do **NOT** change its `version`.

   This keeps a single unreleased entry accumulating until a human cuts a release by bumping `package.json` to match. Internal-only work (docs, config, refactors, tests, tooling) gets **no** changelog entry.

   **Ignore semver instinct.** You never decide major/minor/patch — the only version edit you ever make is a single patch bump, and only in the EQUAL case. A new feature does NOT mean a minor bump. When in doubt, you are almost always in the DIFFER case → just append a line, touch nothing else.

   *Worked example:* `package.json` is `3.3.0`, top changelog entry is `3.3.1` → they DIFFER → append your line to `3.3.1`'s `changes[]`. (A wrong fix would be creating a `3.4.0` entry — don't.)
9. ~~Search feature flag~~ — retired in v3.7.0. In-app search ships publicly; `constants/features.ts` and the `FEATURES.search` gate were removed entirely. Do not reintroduce a feature-flag system for it without being asked.

## Dead Code
All dead code files and unused client fields have been removed (Task 3.5 complete). Precedent: `components/TorrentDetails.tsx` was deleted after its markup was consolidated into `app/torrent/[hash].tsx`, which is now the single torrent-detail screen — when replacing a component with a route-level screen (or vice versa), delete the superseded file in the same change rather than leaving it as unreferenced dead code.

## Known Bugs
None currently tracked. Do not trust a static bug list — run `npx tsc --noEmit` and `npm test`, and read the actual code before assuming a defect exists. (All previously documented bugs were fixed in v3.1.0; see `constants/changelog.ts`.)

## Naming Conventions
- Components: PascalCase (`TorrentCard.tsx`)
- Utilities/hooks: camelCase (`formatSpeed.ts`, `useTorrentActions.ts`)
- Services: kebab-case (`server-manager.ts`, `color-theme-manager.ts`)
- Tests: `tests/` at repo root, organized by module (`tests/utils/`, `tests/services/`, `tests/locales/`). NOT `__tests__/`.
- Route groups: `(groupname)` with parentheses is Expo Router syntax, not a naming choice.
- Dynamic routes: `[param].tsx` with square brackets is Expo Router syntax for URL parameters (like `/torrent/:hash`). The brackets cannot be removed. The name inside becomes the param key in `useLocalSearchParams()`.
- Layout files: `_layout.tsx` with the underscore prefix is Expo Router syntax for layout routes. Cannot be renamed.

## Verification / Environment
- This is an iOS-first app. iOS-only APIs (`ActionSheetIOS`, `Alert.prompt`, etc.) are acceptable. Android parity is a future concern.
- `expo-*` packages are approved for use even if they require `expo-dev-client` (e.g. `expo-symbols`). Third-party native modules (`react-native-ios-context-menu`, `lottie-react-native`) still require explicit approval before adding.
- The app cannot be launched in a headless/cloud agent environment (requires Expo Go / dev client on a device or simulator). When you can't run the app, verify with `npx tsc --noEmit` and `npm test`.
