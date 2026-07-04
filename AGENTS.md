# AGENTS.md

## Project Overview
qRemote is a React Native (Expo SDK 54) mobile app for remotely controlling
qBittorrent servers via the WebUI API v2. Runs on iOS and Android via Expo Go.

## Dev Commands
- `npm start` — Start Expo dev server (Expo Go)
- `npm run ios` — iOS simulator
- `npm run android` — Android emulator

### Verification (run before considering a change done)
- `npx tsc --noEmit` — typecheck (currently clean)
- `npm test` — Jest (ts-jest). Tests live in `tests/`, currently 209 passing across 12 suites
- `npm run lint` — ESLint
- `npm run format` — Prettier

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
9. **NEVER enable the `search` feature flag for App Store builds.** In-app search (Search tab + Search plugins screen) is gated by `FEATURES.search` in `constants/features.ts`, default `false`. App Store builds must not expose arbitrary-indexer search/download — only flip it to `true` for sideloaded / non-App-Store builds, and never commit it as `true` on the default branch.

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
