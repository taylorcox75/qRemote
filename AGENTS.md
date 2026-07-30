# AGENTS.md

qRemote is an iOS-only React Native (Expo SDK 57) app for remotely controlling
qBittorrent servers over the WebUI API v2.

Read this file top to bottom once. The **File Index** is a complete map — trust
it instead of re-exploring, and open only the files you're actually changing.

## How to work a task

1. **Read it as an API question first** — [§1](#think-in-api-terms-first): which
   endpoint, does it break stored data, does it still work on qBittorrent 4.x?
2. **Locate files in the [File Index](#5-file-index).** Don't search the tree.
3. **Copy the nearest sibling.** Whatever you're adding — a screen, a test, a
   settings row, a loading or empty state — one like it already exists. Match it
   instead of inventing a pattern.
4. **Edit. Run nothing while you work.**
5. **Verify narrowly** — the impacted suite only, and only if the change is
   non-trivial ([§1](#dont-burn-runs)). **Skip this entirely if you're heading
   straight to a commit** — step 7's full batch supersedes it. Never run both.
6. **Reply in a few lines**: what changed, file links, anything surprising.
7. **Stop.** Commit only when asked — and when asked, go all the way to a PR
   ([§1](#when-asked-to-commit-go-all-the-way-to-a-pr)).

**Decide, don't ask.** When something's ambiguous, make the reasonable call and
name it in your reply so it can be corrected. Stop only when genuinely blocked.

**Don't spawn subagents** unless the user asks for one by name or says something
like "thorough" or "review." Each one starts cold and re-derives context you
already have.

---

## 1. Working Agreement

How to work in this repo, before anything about the code itself.

### Think in API terms first

The target is the **qBittorrent WebUI API v2**
([5.0 reference](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0))).
Almost every request the user makes is an API question wearing a UI costume. Work
through these three before writing code, and raise a problem early rather than
shipping a plausible-looking guess:

**1. What API will I be using?**
Name the specific endpoint(s) and confirm they exist in the 5.0 wiki, along with
their exact parameter names and response fields. If nothing in the API supports
the request, say so up front — that's far more useful than an implementation
built on an endpoint that isn't there.

**2. Will this break existing users?**
The app has users with data on their devices. Anything that renames or changes
the meaning of a stored key silently breaks them, and there is **no migration
system**. Check against: preference keys (`types/preferences.ts`), `colors` keys
(ThemeContext), stored `ServerConfig` records, and saved color themes. Adding is
safe; renaming and repurposing are not. See [§8 Critical Rules](#8-critical-rules).

**3. Does it still work on qBittorrent 4.x?**
([4.1 reference](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1)))
Not every feature has to — some endpoints genuinely only exist in 5.0 — but the
**main features must stay usable on 4.x**. When a capability is version-dependent,
gate it rather than dropping 4.x support.

Gating lives in `utils/apiVersion.ts` (`ApiFeatures`), keyed on the **WebAPI**
version rather than the qBittorrent version:

- **WebAPI ≥ 2.11.0 = qBittorrent 5.0** — the main boundary. Start/stop endpoints,
  `content_path`, inactive-seeding limits, cookies, `search/downloadTorrent`,
  `getDirectoryContent`.
- **WebAPI ≥ 2.8.0 = qBittorrent 4.3.x** — ratio and seeding-time limit fields.
- **Unknown or unparseable version → assume the 5.0 feature set**, so a detection
  failure doesn't silently downgrade a modern server.

> ⚠️ **A wrong parameter name looks like success.** qBittorrent silently drops
> form fields it doesn't recognize and still returns 200. So a 5.0-only parameter
> sent to a 4.x server doesn't error — the feature just quietly does nothing.
> qBit 5.0 renamed several things (`paused` → `stopped` on `torrents/add`,
> `start_paused_enabled` → `add_stopped_enabled` in preferences), and these
> renames are per-site: handling one does not handle the others. When you add a
> version-dependent parameter, gate it *and* verify against the older wiki.

### Don't burn runs

Every typecheck / test / lint run costs real tokens and wall time. There are
exactly **three** moments to run anything, and no others:

**1. Mid-task → run nothing.** Never fire `tsc`, `jest`, or `eslint` after an
individual edit or "just to be safe." Trust the edit and keep working.

**2. Handing back a non-trivial change → the impacted suites only.** Never the
full run here. Pick the narrowest command that covers what you actually touched:

| What you changed | What to run |
|---|---|
| One module that has a test | That one suite — `npm test -- tests/utils/format.test.ts` (~18s). Same form for `tests/services/…` and `tests/rn/…`. |
| Pure logic — `utils/`, `services/`, locales | `npm test -- --selectProjects node` (skips the slow jest-expo project) |
| Components, hooks, context | `npm test -- --selectProjects rn` |
| Types, or a change that crosses many files | `npx tsc --noEmit` |

**Trivial edits need nothing** — a comment, a copy tweak, a doc line, a single
string. Use judgment; the point is to catch real breakage, not to perform rigor.

**3. Before a commit → the full batch.** See [Commit-time checks](#commit-time-checks).

### Read narrowly

Tool output is **permanent and recurring**: whatever a command prints stays in
the conversation and is re-sent on every later turn. A single careless dump of a
few hundred lines is a tax on the whole rest of the session, so the cost of
reading too much is much higher than it looks at the moment you do it.

- **Never `cat` a whole file** to answer a narrow question. Use `grep -n` (with
  `-A`/`-B` for context) or a ranged read. Reach for the file's shape first —
  `grep -n "^export\|^## "` beats reading it.
- **Especially never dump** generated, lock, or config-heavy files:
  `package-lock.json`, anything under `ios/`, `.github/workflows/*` (they embed
  long inline scripts), coverage output, `dist/`.
- **Don't re-list the tree.** The [File Index](#5-file-index) is complete and
  maintained. Use it instead of `find` or a recursive `ls`.
- **Don't re-read a file you just edited** to confirm the edit — the edit tool
  already failed loudly if it didn't apply.
- **Read the whole file when you're about to change it substantially.** This rule
  is about avoiding *incidental* bulk, not about editing blind.

### Commit-time checks

Only now do you run the whole thing — once, as a batch:

| Command | Bar |
|---|---|
| `npx tsc --noEmit` | Exit 0. Currently clean. Incremental via `.tsbuildinfo` (~25s warm, ~85s cold). |
| `npm test` | All passing, both projects — see [Testing](#7-testing). |
| `npm run lint` | **Zero errors.** Warnings are baseline noise; the count drifts, don't chase it. |
| `npm run format` | Prettier. Run it last, so it also formats anything you just changed. |

Then, in the same pre-commit pass:

- **Update the [File Index](#5-file-index)** if you added, removed, or renamed a
  module. The index promises to be complete; a stale entry is what forces the
  next session to re-explore, which costs far more than this edit.
- **Changelog** — only if the user explicitly asked (see above).

### Changelog is opt-in

**Do not touch `constants/changelog.ts` on your own initiative** — not even for
a user-facing change. Only edit it when the user explicitly asks ("update the
changelog", "add a changelog entry"). When they do ask, follow
[docs/RELEASING.md](docs/RELEASING.md) exactly — read it at that point, not
before.

### Branches — always work on one

**Never commit to `main`. Never commit to `develop`.** Both are protected by
convention: work reaches them only through a PR. There is no exception for a
one-line fix or a "quick" change.

Every change starts on its own branch cut from `develop`:

```bash
git switch develop && git pull && git switch -c bugfix/#123-short-description
```

Naming follows what's already in the repo — `feature/…`, `bugfix/…`, or `fix/…`,
usually carrying the issue number (`bugfix/#177`, `feature/#121`). Agent-created
branches use a `claude/…` prefix.

**Always cut from `develop` — there is no hotfix exception.** However urgent a
fix is, it goes branch → PR → `develop` → `main`. Never branch from `main`, and
never shortcut a fix straight into it.

| Branch | Role |
|---|---|
| *your branch* | Where every commit goes. Cut from `develop`, merged back by PR. |
| `develop` | Integration branch. Receives work by PR only. Its changelog entry is a `.TESTFLIGHT` placeholder — see [docs/RELEASING.md](docs/RELEASING.md). |
| `main` | Release branch. Receives `develop` by PR. **Pushing it with `"easBuild": true` in `package.json` builds and submits to the App Store** — see [docs/RELEASING.md](docs/RELEASING.md). |

**Commit and push only when asked.** If you're asked to commit and you're sitting
on `main` or `develop`, branch first, then commit — don't ask whether the rule
applies this time.

### When asked to commit, go all the way to a PR

"Commit this" means the full sequence, not just the commit:

1. Run the [commit-time checks](#commit-time-checks) and the File Index pass.
2. Branch if you aren't already on one.
3. Commit. **No `Co-Authored-By: Claude` trailer** on this repo.
4. `git push -u origin <branch>`
5. `gh pr create --base develop` with a short summary and a test-plan line
   covering what you ran.

Stop there. **Never merge the PR** — review and merge are the user's.

---

## 2. Dev Commands

- **`npm run xcode`** — the one command that gets you building. Fresh-clone-safe:
  `npm install` → `npx expo prebuild -p ios` → `pod install` → opens
  `ios/qRemote.xcworkspace`. Safe to re-run any time (after pulling native or
  dependency changes). Build/run with Cmd+R once Xcode is open.
- **`npm start`** — Metro for the dev-client build (`expo start --dev-client`).
  **Not** `--go`: this app is bare with custom native code, so plain Expo Go
  can't run it. Run alongside a dev-client build for JS fast refresh.

---

## 3. iOS Native Workflow

**`ios/` is generated, not committed.** It (and `android/`) have been gitignored
since #154 (commit `ba511cd`). `npm run xcode` regenerates it from scratch, so a
fresh clone builds with no committed native files. Whatever sits under `ios/`
locally is machine-local and disposable.

Consequences:

- **Native config goes in `app.config.js`**, not in `ios/`. Info.plist keys,
  entitlements, URL schemes and document types all live in the `ios.infoPlist`
  block, which prebuild applies when generating the project. Hand-edits under
  `ios/` are wiped by the next prebuild.
- **When `app.config.js` can't express it, write a config plugin.** There's one
  precedent: `plugins/withNativeTorrentFileCopy.js`, which patches `AppDelegate`
  so an incoming `.torrent` is copied natively inside the open-URL callback —
  while the security-scoped access is still valid — instead of racing the async
  JS Linking bridge on cold launch.
- **`app.config.js` is tested.** `tests/utils/app-config.test.ts` asserts the
  magnet scheme and `.torrent` document-type registration survive. Update it if
  you change those blocks; the comments in `app.config.js` explain why each key
  is set the way it is (several encode hard-won App Store / Files.app fixes —
  read them before flipping a value).
- **Expo SDK upgrades (57 → 58…)** are the normal managed path: bump the
  packages, re-run `npm run xcode`, and prebuild regenerates from the new
  template.

Android support was removed entirely — no platform, no build target, no plan to
re-add one without being asked.

---

## 4. Architecture

- **Routing** — Expo Router, file-based, in `app/`. Parenthesized `(groupname)`
  segments are route *groups*: they organize files but are **omitted from URLs**.
  The tab bar lives in `app/(tabs)/_layout.tsx`. Screens that must keep the tab
  bar visible live in nested Stacks *under* a tab, never as siblings of `(tabs)`
  on the root stack. The root stack (`app/_layout.tsx`) anchors on `(tabs)`, so
  dismissing a modal doesn't wipe the tab navigator.
- **State** — React Context + TanStack Query.
- **Data sync** — TanStack Query with `refetchInterval` (2–3s); torrents use
  rid-based incremental sync through a custom `queryFn`.
- **Storage** — AsyncStorage for preferences, `expo-secure-store` for secrets.
- **API** — thin wrapper objects in `services/api/` over one axios singleton
  (`apiClient`).
- **Styling** — every color comes from `useTheme()`. Users can override any
  color via the in-app picker.
- **i18n** — react-i18next, six locales.
- **Deep links** — magnet URLs and `.torrent` files arrive via a `Linking`
  listener in `app/_layout.tsx`. `app/+native-intent.ts` returns `null` for those
  URLs so Expo Router doesn't try to treat a `file://…torrent` path as a route
  and land the user on "Unmatched Route".

### Per-server secrets

Reverse-proxy Basic Auth (`useBasicAuth`, #118) shows the pattern every
per-server secret must follow:

- Non-secret half (`basicAuthUsername`) → plain AsyncStorage via `services/storage.ts`.
- Secret half (`basicAuthPassword`) → `expo-secure-store` under
  `server_basic_auth_password_{id}`, and forced to `''` before the server record
  is written to AsyncStorage.
- `services/api/client.ts` reads it back off the in-memory `ServerConfig` to
  build the header via `utils/basicAuth.ts`.

Be deliberate whenever you touch code that persists a `ServerConfig` — including
paths that rewrite the *whole* server list, such as add, edit, delete, and
import. A secret must never reach AsyncStorage, and bulk rewrites are the easiest
place to let one slip through.

### Auth modes

A server's auth mode is *derived*, not stored — see `utils/authMode.ts`
(`password` | `apiKey` | `none`). Legacy records that only ever set `bypassAuth`
keep working; when both `useApiKey` and `bypassAuth` are set, API key wins.

---

## 5. File Index

Complete map. Trust it.

### Screens (`app/`, Expo Router)

| Path | Notes |
|---|---|
| `app/(tabs)/(torrents)/` | Torrents tab as a nested stack: `index` list, `torrent/[hash]`, `torrent/files`, `torrent/manage-trackers`. Group is omitted from URLs → `/`, `/torrent/[hash]`. |
| `app/(tabs)/search.tsx` | Search tab: job polling UI, plugin/category/indexer filter chips, client-side sort, collapsing header. Optional auto-tag-by-tracker on add (`autoCategorizeByTracker` pref — tags Search downloads only; the key name is historical). |
| `app/(tabs)/transfer.tsx` | Transfer stats, global speed and seeding limits. |
| `app/(tabs)/logs.tsx` | Connectivity logs. `href: null` — reached from Settings → Advanced, not a visible tab. |
| `app/(tabs)/rss/` | RSS Feeds tab (`index` tree + `feed` detail). `href` is null until connected **and** the server's `rss_processing_enabled` is on. Rules and settings screens do **not** go here — they live under Settings. |
| `app/(tabs)/settings/` | Settings tab as a nested stack. See sub-screens below. |
| `app/(tabs)/_layout.tsx` | Tab bar and tab gating. |
| `app/_layout.tsx` | Root providers, theme, deep-link handling. Anchors on `(tabs)`. |
| `app/+native-intent.ts` | Suppresses Router navigation for magnet / `.torrent` URLs. |
| `app/torrents/add.tsx` | Add-torrent flow (magnet or file, plus options). Root stack → no tab bar. Uses `PathAutocompleteInput`. |
| `app/search/plugins.tsx` | Search plugin install/enable/uninstall (`app/search/_layout.tsx` stack). Root stack. Also linked from the Settings hub. |
| `app/server/add.tsx`, `app/server/[id].tsx` | Server add/edit, presented as native modal sheets → they mount `<ModalToast/>` locally. |

**Settings sub-screens** — hub order on `index` is Servers → Appearance → Server
Settings → RSS → Search Plugins → Advanced, then What's New → About, then
Community links (source / issues / Beer Fund / Rate). Notifications & Feedback is
nested under `advanced`, not on the hub.

`about` · `add-torrent-dialogue` · `advanced` · `appearance` ·
`category-tag-colors` · `detailed-card-fields` · `notifications` · `rss` ·
`rss-rules` · `rss-rule` · `servers` (list + secret-free export/import) ·
`server-settings-advanced` (qBit email/automation) · `theme` ·
`torrent-defaults` (nav label is **Server Settings**; route path unchanged) ·
`whats-new`

> **Do not recreate** top-level `app/settings/` or `app/torrent/` trees, the old
> `app/(tabs)/index.tsx` / `app/(tabs)/settings.tsx` hub files, or the deleted
> `app/(tabs)/rss/rule.tsx` / `rules.tsx`. They were moved deliberately so the
> tab bar stays visible.

### Contexts (`context/`)

- **`ServerContext.tsx`** — connection lifecycle. `checkAndReconnect()` **always**
  does a full re-login (no session-validity probe) and de-dupes concurrent calls
  behind a shared in-flight promise. qBittorrent ties search jobs to the session,
  so **never call it eagerly** on foreground/AppState events — only reactively,
  after a request has actually failed. `disconnect()` clears the session but
  *keeps* `currentServer` for one-tap reconnect from Settings; call
  `forgetCurrentServer()` when that server is deleted, and `updateCurrentServer()`
  after editing it so one-tap Connect doesn't retry stale credentials.
- **`TorrentContext.tsx`** — rid-based incremental sync, plus the reactive
  auto-reconnect effect the other providers piggyback on.
- **`TransferContext.tsx`** — transfer-info poll; relies on TorrentContext's reconnect.
- **`ToastContext.tsx`** + `components/Toast.tsx` — the global toast is a plain
  view. **Never wrap it in an RN `<Modal>`** — a Modal captures all touches and
  freezes the UI. Native-modal-sheet screens mount `ModalToast` locally instead.
- **`ThemeContext.tsx`** — `useTheme()`, the `colors` object, user overrides.
- **`ApiVersionContext.tsx`** — detected qBittorrent API version → feature gating
  through `utils/apiVersion.ts`.

### Components (`components/`)

All PascalCase function components taking a `…Props` interface.

- **Modals / pickers** — `ActionMenu` (anchored popover), `ConfirmModal` (themed
  confirm), `InputModal` (themed text input; optional `pathAutocomplete` prop),
  `OptionPicker`, `MultiSelectPicker`, `CategoryModal`, `TagsModal`, `ColorPicker`,
  `PathAutocompleteInput` (live directory suggestions via `app/getDirectoryContent`,
  qBit 5.0+ / WebAPI ≥ 2.11 — silent no-op when unsupported; also renders the
  browse button), `SavePathPickerModal` (filterable list of save paths already in
  use, derived from TorrentContext via `utils/save-paths.ts` — works on any
  qBittorrent version).
- **Torrent / search UI** — `TorrentCard` (`React.memo` with a **custom
  comparator — keep it in sync when you add a rendered field**, or the card
  silently stops updating; category/tag stickers use `categoryColors`/`tagColors`
  then defaults then the `avatarColor` fallback), `SearchResultRow` (+ internal
  ActionPill), `FilterChip`, `EmptyState`, `SkeletonLoader` (+ `SkeletonTorrentCard`),
  `PieceMap`.
- **Visuals** — `SpeedGraph`, `CircularProgress`, `AnimatedProgressBar`,
  `AnimatedButton`, `Confetti`.
- **Chrome / diagnostics** — `FocusAwareStatusBar`, `SettingRow`,
  `QuickConnectPanel`, `LogViewer`, `DebugRow`, `SuperDebugPanel`.

### API wrappers (`services/api/`)

Thin objects over `apiClient`.

- **`client.ts`** — the axios singleton. Holds server config, cookies, API
  version and the Basic Auth header, and normalizes HTTP failures into
  human-readable `Error`s. **Callers substring-match those messages — grep
  before rewording one.**
- `auth.ts` (login/logout) · `sync.ts` (`getMainData` rid-sync, `getTorrentPeers`) ·
  `transfer.ts` (global speed + seeding limits, alt-speed toggle, `banPeers`) ·
  `application.ts` (version/buildInfo/preferences/cookies, `getDirectoryContent`) ·
  `categories.ts` · `tags.ts` · `logs.ts` (main + peer logs) · `rss.ts` (feeds,
  folders, rules, `moveItem`) · `search.ts` (job start/stop/status/results/delete,
  plugin management, `downloadTorrent`).
- **`torrents.ts`** — everything per-torrent: list/properties/trackers/webseeds/
  contents/pieces; pause/resume/delete/recheck/reannounce; add (URL + file);
  tracker and peer edits; queue and file priorities; limits and share-limits;
  location/name/category/tags; AMM, sequential, first/last piece, force start,
  super seeding; `renameFile`/`renameFolder`.

### Services (`services/`)

- **`server-manager.ts`** — server CRUD, connect/reconnect/test
  (`ConnectionTestResult`, `isNetworkError`). `exportServers()`/`importServers()`
  back the server-list export/import; import preserves this device's stored
  secrets when an id already exists.
- **`storage.ts`** — AsyncStorage preferences (typed shape and defaults in
  `types/preferences.ts`).
- **`incoming-file.ts`** — copies an incoming `.torrent` into the app cache
  before the iOS security-scoped access can lapse.
- **`query-client.ts`** — the shared TanStack `QueryClient`.
- **`color-theme-manager.ts`** — save/load/apply user color themes.
- **`connectivity-log.ts`** — in-memory ring log (`clogDebug/Info/Warn/Error(tag, msg)`).
- **`log-storage.ts`** — persisted entries for the Logs screen.

### Hooks (`hooks/`)

- `useSearchJob.ts` — search job lifecycle: start/stop/delete, 2s status+results
  polling, unmount cleanup.
- `useTorrentActions.ts` — builds the per-torrent action menu used by both list
  and detail. Delete exposes `deleteConfirmVisible` for a caller-mounted
  `ConfirmModal`.
- `useReactiveReconnect.ts` — feeds query errors into ServerContext reconnect
  (`isReconnectableError`).
- `useGracefulError.ts` — suppresses a transient error until it has persisted
  ~2.5s, so a self-healing poll failure doesn't flash error UI.
- `useRssFeeds.ts` / `useRssRules.ts` — RSS tree and auto-download rule state.
- `useSpeedTracker.ts` / `useSpeedHistory.ts` — sampling for `SpeedGraph`.

### Utils (`utils/`)

Pure and well-tested. **Put logic here whenever it doesn't need React.**

`format.ts` (size/speed/time/ratio/percent/progress/availability/date — progress
and availability **FLOOR**, never round up) · `torrent-state.ts` (state → color/
label, completion and ETA rules) · `limit-input.ts` (share-limit sentinels:
`-2` = follow global, `-1` = unlimited; own-vs-effective limit resolution) ·
`error.ts` (`getErrorMessage`) · `apiVersion.ts` (parse + `ApiFeatures` gating) ·
`server.ts` (endpoint resolution incl. fallback URL, avatar colors) ·
`authMode.ts` (derives `password`/`apiKey`/`none`) · `basicAuth.ts` ·
`magnet.ts` / `torrent-file.ts` (incoming link and file parsing) · `rss.ts`
(RSS tree flattening; paths join with `\`) · `searchResult.ts` (indexer-label
heuristics) · `login-response.ts` (qBittorrent login body/cookie interpretation) ·
`haptics.ts` (global toggle + wrappers) · `tags.ts` (CSV tag parsing) ·
`add-torrent-dialogue.ts` (compact vs full variant) · `server-export.ts` (strips
`password`/`basicAuthPassword`/`apiKey` on export, forces them empty on import) ·
`save-paths.ts` (`getKnownSavePaths`, derived from live data — no API call) ·
`version.ts` (`APP_VERSION`).

### Types, constants, i18n

- `types/api.ts` — every qBittorrent API shape (`TorrentInfo`, `ServerConfig`,
  RSS types, preference fields).
- `types/preferences.ts` — typed preferences + defaults.
- `constants/` — `changelog.ts` (don't edit unless asked; see
  [docs/RELEASING.md](docs/RELEASING.md)),
  `spacing.ts`, `typography.ts`, `shadows.ts`, `buttons.ts`. **Use these tokens;
  don't invent ad-hoc spacing.**
- `i18n/index.ts` initializes react-i18next. Each locale is ONE file,
  `locales/{en,es,zh,fr,de,ru}/translation.json`, holding every namespace:
  `common`, `states`, `screens`, `placeholders`, `actions`, `alerts`, `server`,
  `torrentDetail`, `filters`, `sort`, `toast`, `errors`. Keys read like
  `t('actions.pause')`.

---

## 6. Task Recipes

Exact touch-lists for recurring work. Follow them; don't rediscover.

**Add or change a user-facing string**
Add the key to **all six** `locales/*/translation.json` and use it via `t('ns.key')`.
Actually translate — the parity test rejects English copied verbatim into another
locale (for strings ≥16 chars). `npm test` names any file you missed.

**Add a preference**
Typed shape + default in `types/preferences.ts` → read/write through
`storageService` (`services/storage.ts`) → UI in the relevant
`app/(tabs)/settings/*` screen using `SettingRow` + `OptionPicker`/switch → i18n
the label. **Never rename an existing key.**

**Add a qBittorrent API call**
Confirm the endpoint, its exact parameter names and its response shape against
the [5.0 wiki](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-5.0))
and, for anything that isn't 5.0-only, the
[4.1 wiki](https://github.com/qbittorrent/qBittorrent/wiki/WebUI-API-(qBittorrent-4.1))
→ method on the matching `services/api/*.ts` object (follow its neighbors' style)
→ request/response types in `types/api.ts` → if availability or spelling depends
on the server version, add a flag to `ApiFeatures` in `utils/apiVersion.ts` and
branch on it. Remember a misspelled param is dropped silently, not rejected —
see [§1](#1-working-agreement).

**Add a torrent action**
API method (above) → menu item in `hooks/useTorrentActions.ts` → strings in the
`actions` / `toast` namespaces. For a destructive confirm, expose visibility
state from the hook and mount `ConfirmModal` in the screen (see the torrents list
and detail screens).

**Add a settings sub-screen**
Create `app/(tabs)/settings/<name>.tsx` by copying a sibling's structure — the
route registers itself, `_layout.tsx` needs no edit — then link it from
`app/(tabs)/settings/index.tsx`.

**Keep the tab bar on a pushed screen**
Put the screen under `app/(tabs)/(torrents)/` or `app/(tabs)/settings/`. The root
stack means no tab bar, and is for modals and full-screen flows only.

**Add a rendered field to `TorrentCard`**
Update the `React.memo` comparator in the same edit, or the card won't re-render
when that field changes.

**Add a test**
Pick the project by what you're testing, and copy the nearest sibling — they
already carry the right imports and mocks:

- **Pure logic** → `tests/utils/<name>.test.ts` or `tests/services/<name>.test.ts`.
  Plain ts-jest, no React. API wrappers have a shared `tests/services/api-test-helpers.ts`.
- **Component, hook, or context** → `tests/rn/{components,hooks,context}/<Name>.test.tsx`.
  Runs under jest-expo with `@testing-library/react-native`; `tests/rn/setup.ts`
  loads automatically and `tests/rn/components/theme-mock.ts` stands in for
  ThemeContext.

Import app code as `@/…` — both projects map it to the repo root.

---

## 7. Testing

Tests live in `tests/` at the repo root (**not** `__tests__/`), split across two
Jest projects configured in `jest.config.js`:

- **`node`** (ts-jest, node env) — `tests/utils/`, `tests/services/`,
  `tests/locales/`. Pure logic and API wrappers.
- **`rn`** (jest-expo + `@testing-library/react-native`) — `tests/rn/`, with
  `components/`, `context/` and `hooks/` subtrees and a shared
  `tests/rn/setup.ts` / `theme-mock.ts`.

Both map `@/…` to the repo root. `npm test` runs both projects.

### How much to test

**Coverage sits around 90% and must not drop below it.** That's the whole bar —
don't chase a higher number, and don't write tests for their own sake.

In practice: **a substantial piece of new logic ships with a test; a small change
doesn't.** New `utils/` and `services/` modules are the clear yes — they're pure,
fast to test, and that's what the existing `tests/utils` / `tests/services` trees
already cover. A copy tweak, a style fix, or a small branch in existing code is a
clear no.

**Don't run coverage locally.** `jest --coverage` means the full suite plus
instrumentation — expensive, and it tells you what CI already reports. The
`coverage.yml` workflow computes it on every push to `main` and publishes the
README badge. Trust that.

**The locale parity test earns its keep.** `tests/locales/i18n-parity.test.ts`
fails if a locale adds or drops keys relative to `en`, or if a long string (≥16
chars) is byte-identical to the English source — exactly the drift that let the
`torrentDetail` namespace regress to ~170 untranslated keys per locale in v3.5.1.
Genuine coincidental matches (loanwords like "tracker"/"Status"/"OK", literal
URL and path placeholders) live in that test's `COINCIDENTAL_MATCH_ALLOWLIST`.
Extend the allowlist only after checking by hand that the match is intentional
rather than a translation gap.

---

## 8. Critical Rules

1. **Never hardcode a color.** Always `useTheme()` → `colors.*`.
2. **Never rename a key in the `colors` object.** Users' saved overrides are keyed
   by name in AsyncStorage; renaming silently breaks their customizations.
3. **Never rename a preference key.** There is no migration system — old keys
   just become orphaned.
4. **Color defaults mix formats** (rgb, rgba, hex) and the picker only handles
   6-digit hex. Changing an `rgba(...)` default to `#hex` drops the alpha channel
   and visibly changes the UI.
5. **All user-facing strings go through i18n** — `const { t } = useTranslation()`.
6. **Prefer themed dialogs**: `InputModal` over `Alert.prompt`, `ConfirmModal`
   over `Alert.alert`. Native alerts ignore the app theme. **Don't add a new
   one.** *Known deviations* — eight existing sites: `settings/advanced`,
   `settings/torrent-defaults` ×2, `search/plugins`, `server/[id]`, `TagsModal`,
   `CategoryModal`, `SuperDebugPanel`. Converting one while you're already in
   that file is welcome, but it's never required.
7. **Delete superseded files in the same change.** When a component is replaced
   by a route-level screen or vice versa, remove the old one rather than leaving
   dead code. Precedent: `components/TorrentDetails.tsx` was deleted once its
   markup moved into `app/(tabs)/(torrents)/torrent/[hash].tsx`.
8. **Don't trust a static bug list** — including this file's. Read the code and
   run the checks before concluding a defect exists.

### Naming conventions

- Components: PascalCase — `TorrentCard.tsx`
- Utilities and hooks: camelCase — `format.ts`, `useTorrentActions.ts`
- Services: kebab-case — `server-manager.ts`, `color-theme-manager.ts`
- `(group)`, `[param]` and `_layout.tsx` are Expo Router syntax, not style
  choices. They can't be renamed.

---

## 9. Environment & Headless Agents

- **iOS-only.** iOS-specific APIs (`ActionSheetIOS`, `Alert.prompt`, …) are fine
  without platform gating.
- **`expo-*` packages are pre-approved**, even ones needing `expo-dev-client`.
  Third-party native modules (e.g. `react-native-ios-context-menu`,
  `lottie-react-native`) need explicit approval first.
- **Don't run the app.** It needs a device or simulator via Xcode, which is the
  user's to drive. **Never start the web target** (`npm run web`) either — there
  is no qBittorrent server configured for an agent to talk to, so it proves
  nothing.
- **Verify with `npx tsc --noEmit` and `npm test`** instead, batched at commit
  time per [§1](#1-working-agreement). The bar is exit 0, tests passing, lint 0
  errors.
