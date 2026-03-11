# AGENTS.md

## Cursor Cloud specific instructions

This is **qRemote**, a React Native (Expo SDK 54) mobile app that acts as a remote control client for qBittorrent's WebUI API. It is a single-project Expo app (not a monorepo).

### Running the app

- **Web mode** (recommended for cloud agents): `npm run web` starts the Expo dev server with web bundling on port 8081. This is the best option in environments without iOS/Android simulators.
- **Standard Expo start**: `npm start` launches the Metro bundler (defaults to Expo Go mode). See `package.json` scripts for `ios`, `android`, and `web` variants.
- The app requires an external **qBittorrent instance** with WebUI enabled for full end-to-end testing. Without one, the app loads in a "Not Connected" state but all UI screens are still navigable.

### Lint / Type checking

- No ESLint config is present. Use `npx tsc --noEmit` for TypeScript type checking.
- There are pre-existing TS errors in the codebase (e.g., missing module declarations for `react-native-gesture-handler`, `expo-haptics`, `react-native-draggable-flatlist`). These do not block the app from running.

### Tests

- No test framework or test scripts are configured in this repo.

### Known web-mode caveats

- The Settings page accesses `Platform.constants.reactNativeVersion` which may be `undefined` in the web environment, causing a crash. If this occurs, a page refresh typically recovers, or the route can be accessed directly at `/settings`.
- Native-only modules (`expo-haptics`, `react-native-gesture-handler`, `react-native-draggable-flatlist`) are unavailable in web mode but the app degrades gracefully.
