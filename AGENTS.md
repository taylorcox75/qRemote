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
- **State:** React Context + TanStack Query (ThemeContext, ServerContext, TorrentContext, TransferContext, ToastContext)
- **Data sync:** TanStack Query with `refetchInterval` (2-3s), rid-based incremental sync for torrents via custom queryFn
- **Storage:** AsyncStorage for preferences, SecureStore for passwords
- **API:** Thin wrappers in `services/api/` over a singleton axios-based `apiClient`
- **Styling:** All colors via `useTheme()` → ThemeContext. Users can override any color via the color picker.
- **i18n:** react-i18next with 5 locales (en, es, zh, fr, de). Many screens still have hardcoded English strings.

## Critical Rules
1. NEVER hardcode colors — always use `useTheme()` and `colors.*`
2. Prefer `InputModal` over `Alert.prompt` for user text input. `Alert.prompt` is iOS-only, which is acceptable for the current iOS-first focus, but `InputModal` is already available and provides a consistent UX.
3. NEVER rename keys in the `colors` object (ThemeContext) — users store color overrides keyed by these names in AsyncStorage. Renaming silently breaks their customizations.
4. NEVER rename preference keys — there is no migration system. Old keys become orphaned.
5. All user-facing strings must use i18n: `const { t } = useTranslation()` then `t('key')`.
6. The preferences object is `Record<string, any>` — see `types/preferences.ts` for the typed version (create if missing).
7. Color defaults use mixed formats (rgb, rgba, hex). The color picker only handles 6-digit hex. Changing a default from `rgba(...)` to `#hex` removes the alpha channel and changes visual appearance.

## Dead Code
All dead code files and unused client fields have been removed (Task 3.5 complete).

## Known Bugs
- `app/_layout.tsx:32` — `backgroundColor: 'colors.r'` is a string literal, should be `colors.background`
- `components/Confetti.tsx` — `useRef` called inside `Array.from` loop (Rules of Hooks violation)
- `components/ExpandableTorrentCard.tsx:173-178` — Pause button has no `onPress` handler
- `app.config.js` — `usesCleartextTraffic: 'true'` should be boolean `true`
- `app.config.js` — App name has trailing space: `'qRemote '`
- `Alert.prompt` used in 14 places (iOS-only — acceptable for iOS-first, but Task 1.5 replaces with InputModal for consistency): `TorrentCard.tsx` (1), `torrent/[hash].tsx` (7), `TorrentDetails.tsx` (6)

- `isRecoveringFromBackground` in `TorrentContext.tsx` — exposed as ref value, doesn't trigger re-renders (should be state like TransferContext)
- `react-native-gesture-handler` installed explicitly in package.json (Task 1.4g)

## Naming Conventions
- Components: PascalCase (`TorrentCard.tsx`)
- Utilities/hooks: camelCase (`formatSpeed.ts`, `useTorrentActions.ts`)
- Services: kebab-case (`server-manager.ts`, `color-theme-manager.ts`)
- Tests: `tests/` at repo root, organized by module (`tests/utils/`, `tests/services/`). NOT `__tests__/`.
- Route groups: `(groupname)` with parentheses is Expo Router syntax, not a naming choice.
- Dynamic routes: `[param].tsx` with square brackets is Expo Router syntax for URL parameters (like `/torrent/:hash`). The brackets cannot be removed. The name inside becomes the param key in `useLocalSearchParams()`.
- Layout files: `_layout.tsx` with the underscore prefix is Expo Router syntax for layout routes. Cannot be renamed.

## Cursor Cloud Specific Instructions
- This is an iOS-first app. iOS-only APIs (`ActionSheetIOS`, `Alert.prompt`, etc.) are acceptable. Android parity is a future concern.
- `expo-*` packages are approved for use even if they require `expo-dev-client` (e.g. `expo-symbols`). Third-party native modules (`react-native-ios-context-menu`, `lottie-react-native`) still require explicit approval before adding.
- The app cannot be run in this cloud environment (requires Expo Go / dev client on a device/simulator). Verify changes compile with `npx tsc --noEmit`.
