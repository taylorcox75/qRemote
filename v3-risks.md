# v3 Redesign — Risk Register & Landmine Map

> Every place the redesign plan could break the app if implemented carelessly.
> Read this before writing a single line of v3 code.

---

## Table of Contents

1. [Things I Got Wrong in the Redesign Doc](#1-things-i-got-wrong)
2. [Color System Risks](#2-color-system-risks)
3. [File Restructuring Risks](#3-file-restructuring-risks)
4. [New Dependency Risks](#4-new-dependency-risks)
5. [Screen-Specific Landmines](#5-screen-specific-landmines)
6. [Data Migration Risks](#6-data-migration-risks)
7. [Platform-Specific Risks](#7-platform-specific-risks)
8. [Safe Implementation Order](#8-safe-implementation-order)

---

## 1. Things I Got Wrong

### 1.1 Onboarding Is Not Live

The redesign doc proposes onboarding changes as if it's a visible feature. **It isn't.** The `app/onboarding.tsx` file exists, and it writes `hasCompletedOnboarding: true` to storage on completion, but:

- **No code anywhere in the app checks `hasCompletedOnboarding` or routes to `/onboarding`.** The `_layout.tsx` root layout goes straight to `(tabs)` with no conditional.
- The onboarding route exists in the filesystem (so Expo Router *could* resolve it), but nothing navigates to it.
- This means onboarding is **dead code** — it was built but never wired up. Any onboarding changes are cosmetic until someone adds the gate.

**Risk:** Spending time redesigning a screen nobody sees. If we want onboarding in v3, the *real* work is adding the conditional gate in `_layout.tsx`, not prettying up the slides.

### 1.2 "Reduce to 4 State Colors" Would Break the Color Picker

The redesign doc proposes reducing from 11 state colors to 4. The theme settings screen (`app/settings/theme.tsx`) exposes **all 11 state colors** individually in the color picker. Users can customize each one. The `colorThemeManager` persists these per-key per-theme (dark/light) in AsyncStorage. The `ColorTheme` interface has all 11 keys typed.

If we remove keys from the interface and default palette:
- Users who customized `stateMetadata` or `stateQueued` would have orphaned preferences
- The theme settings screen would need to remove those rows
- `TorrentCard.getStateColor()`, `torrent/[hash].tsx`, and `ExpandableTorrentCard` all switch on specific states and reference specific color keys — every switch case needs updating
- The color picker would need new grouping logic (mapping multiple API states to fewer visual colors)

**The right approach:** Don't delete color keys. Instead, change the *defaults* so the 11 keys map to 4 visual colors (e.g. `stateMetadata`, `stateChecking`, `stateQueued` all default to the same value). Keep the color picker exposing all 11 for power users who want granularity. The simplification happens in the defaults, not the schema.

### 1.3 "Replace Ionicons with SF Symbols" Is Not Straightforward

The redesign doc casually says "replace Ionicons with SF Symbols." This is a much bigger change than it sounds:

- `expo-symbols` exists but is iOS-only — Android gets nothing. You'd need a fallback icon set for Android.
- The app uses ~40 unique Ionicons across all screens. Each needs a 1:1 SF Symbol mapping that exists and looks right at the same optical size.
- SF Symbols have licensing restrictions — they can only be used on Apple platforms.
- Ionicons are imported as `<Ionicons name="..." />` everywhere. Switching to a different component API is a project-wide find-and-replace with per-icon name changes.

**The right approach:** Create an `<Icon>` wrapper component that maps semantic names to Ionicons today, and can be swapped to SF Symbols later without touching every screen. Do the abstraction first, the icon swap later.

### 1.4 "Replace FlatList with FlashList" Has Gotchas

FlashList from `@shopify/flash-list` requires:
- `estimatedItemSize` prop (mandatory) — requires measuring actual card height
- Different recycling behavior — components must be pure and not hold local state that depends on position
- `TorrentCard` currently holds local state (`optimisticPaused`, `menuVisible`, `menuPosition`, `loading`) — this state could bleed between recycled cards if the component isn't keyed correctly
- FlashList handles `key` differently from FlatList — using `hash` as `keyExtractor` should be fine, but the `menuVisible` state in each card is a risk

**The right approach:** Before switching to FlashList, first lift the menu state out of `TorrentCard` (the context menu becomes a single shared instance at the list level, not per-card).

---

## 2. Color System Risks

### 2.1 The Color Picker Contract

The color customization system works like this:

```
ThemeContext (lightColors/darkColors)  ← base defaults
       ↓ merged with
colorThemeManager.getCustomColors()    ← user overrides from AsyncStorage
       ↓ produces
colors object                          ← used everywhere via useTheme()
```

**Every color key in `ThemeContext.colors` is a contract.** If you rename a key (e.g. `stateDownloading` → `activeDownload`), three things break:
1. The `ColorTheme` interface in `color-theme-manager.ts` (typed keys)
2. All saved user preferences (keyed by old name in AsyncStorage)
3. Every component that reads `colors.stateDownloading`

**Safe approach:** Keep all existing keys. Add new keys if needed. Deprecate old ones over time. Never rename.

### 2.2 Colors with Opacity Are Stored as RGB/RGBA Strings

The current default colors use inconsistent formats:
- `'rgb(0, 123, 255,0.8)'` — technically invalid (rgb doesn't take alpha), but React Native accepts it
- `'rgba(255, 153, 0, 0.8)'` — correct rgba
- `'#6B7B8C'` — hex
- `'rgb(15, 15, 15)'` — rgb

The color picker uses `colorThemeManager.rgbaToHex()` and `hexToRgba()` to convert between display and storage. If you change a default from `'rgb(0, 123, 255,0.8)'` to `'#0A84FF'`, the opacity is lost. The color picker only handles 6-digit hex — no alpha channel support.

**Risk:** Changing defaults to clean hex values will make colors appear more saturated than before (no alpha blending). The visual appearance of every state badge, progress bar, and left-border stripe will change.

**Safe approach:** When changing default colors, test each one visually in both light and dark mode. If you want the new colors to look good without alpha, pick colors that are inherently less saturated rather than relying on opacity. Or add alpha support to the hex color picker.

### 2.3 The True Black Theme Exists But Isn't Wired Up

`ThemeContext.tsx` defines `trueBlackColors` (OLED black, pure `#000000` background) but `toggleTheme` only switches between `darkColors` and `lightColors`. The true black palette is exported but never used. The redesign doc proposes `#000000` as the dark background — implementing that would need to either:
- Make true black the new dark mode default (breaking change for existing users who expect `rgb(15,15,15)`)
- Add a three-way toggle (light / dark / true black)

---

## 3. File Restructuring Risks

### 3.1 Expo Router Requires `app/` at Root

The redesign doc's `plan.md` proposes moving to `src/app/`. Expo Router's file-based routing requires the `app/` directory at a specific location. The current `app.config.js` doesn't specify a custom root, so Expo Router looks for `./app/`.

If you move to `src/app/`, you must also update the Expo config — and *every* `../` relative import from inside `app/` would break because the depth changes.

**The safe restructuring approach:**
- Leave `app/` exactly where it is. Do not move screens.
- Create `features/` or `src/` for non-route code (components, services, hooks, context, etc.)
- Update imports in `app/` files to point to the new locations
- Do this with a codemod or TypeScript path aliases, not by hand

### 3.2 The Import Graph Is Dense

The codebase has **~180 relative imports** across 40 source files. Moving even one file means updating every file that imports it. The dependency map for the most-imported modules:

| Module | Imported By (count) |
|--------|-------------------|
| `context/ThemeContext` | ~20 files |
| `context/ServerContext` | ~10 files |
| `context/TorrentContext` | ~8 files |
| `context/ToastContext` | ~10 files |
| `services/api/torrents` | ~6 files |
| `utils/format` | ~5 files |
| `constants/spacing` | ~15 files |
| `constants/shadows` | ~10 files |
| `components/TorrentCard` | ~5 files |
| `components/FocusAwareStatusBar` | ~8 files |

Moving `ThemeContext` alone would require editing 20 files. Moving the constants would require editing 25 files.

**Safe approach:** Use TypeScript path aliases (`tsconfig.json` paths + `babel-plugin-module-resolver`) to define `@/features/...`, `@/shared/...`, etc. Migrate imports incrementally — old paths continue to work alongside new ones during the transition.

### 3.3 Barrel Exports Can Cause Circular Dependencies

If you create `features/torrent/index.ts` that re-exports from multiple submodules, and those submodules import from each other, you'll hit circular dependency issues that manifest as `undefined` imports at runtime. This is a common React Native pitfall with barrel files.

**Safe approach:** Don't create barrel files. Use direct deep imports (`features/torrent/components/TorrentCard` not `features/torrent`).

---

## 4. New Dependency Risks

### 4.1 Native Context Menus

`react-native-ios-context-menu` and similar libraries:
- Require native code (won't work in Expo Go — must use dev client or prebuild)
- iOS-only — you'd need a separate Android implementation (e.g. `@react-native-menu/menu` for cross-platform)
- The current app runs via Expo Go (`npm start` → scan QR). Adding a native module kills this workflow. You'd need to switch to `expo-dev-client`.
- The `eas.json` already has build profiles — so prebuild is possible, but the dev loop changes.

**Risk level:** High. This changes the developer experience fundamentally.

**Alternative:** Use Expo's built-in `ContextMenu` from expo-router/ui (if available in SDK 54), or defer this change until the app is already on a dev-client workflow.

### 4.2 Bottom Sheet Libraries

`@gorhom/bottom-sheet` requires:
- `react-native-reanimated` (already installed ✅)
- `react-native-gesture-handler` (already imported in `SwipeableTorrentCard` and `DraggableTorrentList` — but check if it's in `package.json`)

Checking... `react-native-gesture-handler` is NOT in `package.json` but IS imported in two components. This means it's either:
- A transitive dependency that happens to be hoisted in `node_modules`
- Or those two components are broken and nobody noticed because they're not used in the main flow

**Risk:** `SwipeableTorrentCard` and `DraggableTorrentList` may already be broken. Test them before adding more gesture-handler dependencies.

### 4.3 FlashList

`@shopify/flash-list` is a pure JS package and works with Expo Go. Low risk to add. But the `estimatedItemSize` prop is mandatory and must be accurate for recycling to work correctly. Wrong value = visual glitches (cards overlapping, content jumping).

### 4.4 Lottie Animations (Onboarding)

`lottie-react-native` requires native code. Same Expo Go vs. dev-client issue as context menus.

**Alternative:** Use Reanimated-based animations (already installed) instead of Lottie. More work, but no new native dependency.

---

## 5. Screen-Specific Landmines

### 5.1 Torrent Card — The Play/Pause Button Is Load-Bearing

The redesign proposes removing the inline play/pause button from the card and replacing it with swipe actions. The play/pause button currently:
- Shows optimistic state (immediately toggles icon before API responds)
- Shows a loading spinner during API call
- Has error recovery (reverts on failure)
- Triggers `sync()` after action

If you move this to a swipe action, all of this logic must move with it. The swipe gesture handler needs to replicate the optimistic update + error revert pattern. This is non-trivial.

### 5.2 Torrent Card — The Context Menu State Lives in Each Card

`TorrentCard` holds `menuVisible`, `menuPosition`, and does `measureInWindow` to position the custom popup. If you replace this with a native context menu, you remove ~100 lines of code per card, which is great. But the menu also calls:
- `handlePauseResume()` (with optimistic updates)
- `handleForceStart()`
- `handleVerifyData()`
- `handleReannounce()`
- `handleCopyMagnet()`
- `handleDelete()` (with Alert confirmation)
- `handleMaxPriority()`
- `handleSetDownloadLimit()` (uses `Alert.prompt` — iOS only!)
- `handleToggleGlobalSpeedLimit()`

These handlers use local card state and server context. With a native context menu, the action callbacks must still work. And `handleSetDownloadLimit` uses `Alert.prompt` which is iOS-only — you can't put that behind a native context menu and have it work on Android.

**Safe approach:** Replace the custom menu with native context menu, but keep `Alert.prompt` actions out of the menu (or replace them with `InputModal` first).

### 5.3 Settings — 1590 Lines Can't Be Split Naively

The redesign proposes breaking settings into sub-screens. The current `settings.tsx` has:
- Local state for 15+ features (connected server display, categories, tags, backup, server info, etc.)
- `useFocusEffect` hooks that reload data when the screen comes into focus
- `SwipeableServerItem` component defined inline
- A "What's New" modal defined inline
- Direct API calls to `categoriesApi`, `tagsApi`, `applicationApi`

If you split this into sub-screens, each sub-screen needs its own data loading, its own connection checks, and its own error handling. You can't just cut-and-paste sections — you'd need to re-architect the data flow for each sub-screen.

**Safe approach:** Extract one section at a time. Start with the simplest (Appearance → already partly exists as `settings/theme.tsx`). Then Servers. Then Torrent Defaults. Test after each extraction.

### 5.4 Transfer Screen — Quick Action Handlers Have Side Effects

The redesign proposes simplifying Quick Actions from 6 buttons to 3 list rows. The removed actions ("Force Start All", "Pause All DL", "Pause All UL") call specific API endpoints. If you remove them from the UI, users who relied on them lose functionality.

**Safe approach:** Move "Force Start All" into the 3-row list (it's commonly used). Put "Pause All DL" and "Pause All UL" behind a long-press on "Pause All" or in a "More Actions" disclosure row. Don't delete the handlers.

### 5.5 The `backgroundColor: 'colors.r'` Bug

`_layout.tsx:32` has `backgroundColor: 'colors.r'` — a string literal instead of a variable reference. This is a real bug that means the Stack's content background is invalid. React Native treats invalid color strings as transparent. The `<View style={{ flex: 1, backgroundColor: colors.background }}>` wrapper on line 23 masks it.

**Risk if fixing:** Changing this to `colors.background` is safe, but if someone also removes the wrapper View (thinking it's redundant), the Stack's content background would depend on theme context — and the Stack is rendered inside `StackNavigator` which already has `useTheme()`, so it's fine. Just don't remove both at once without testing.

---

## 6. Data Migration Risks

### 6.1 User Preferences in AsyncStorage

All user preferences (theme, colors, sort, filter, card view, refresh interval, haptics, debug mode, API settings, server list, passwords) are stored in AsyncStorage as a flat JSON object. There's no schema version or migration system.

If v3 changes any preference key names, adds required new keys, or changes value formats, existing users' preferences will silently break or be ignored.

**Safe approach:** Never rename keys. Add new keys with defaults that match current behavior. If you must change the format, add a migration function in `_layout.tsx`'s `useEffect` that reads the old format and writes the new one.

### 6.2 Server Passwords in SecureStore

Server passwords are stored in `expo-secure-store` keyed by `server_password_${server.id}`. If you change how server IDs are generated or change the prefix, existing passwords become inaccessible. Users would need to re-enter credentials for every server.

**This is a silent, invisible break** — the app would just fail to authenticate and show a confusing error.

### 6.3 Custom Color Overrides

Users who customized colors via the theme screen have their overrides stored under the `customColors` key in preferences, keyed by theme (`dark`/`light`) and then by color key name. The `mergeColors` function spreads custom values over defaults.

If you rename any color key (e.g. `stateDownloading` → `download`), the user's custom value for the old key is silently ignored. They'd see the new default instead of their chosen color, with no explanation and no way to recover.

---

## 7. Platform-Specific Risks

### 7.1 Alert.prompt Is Used in 13 Places

`Alert.prompt` is iOS-only. It's currently used for:
- Set download limit (TorrentCard, torrent/[hash])
- Set upload limit (torrent/[hash])
- Set category (torrent/[hash])
- Add tags (torrent/[hash])
- Remove tags (torrent/[hash])
- Set location (torrent/[hash])
- Rename torrent (torrent/[hash])
- Add category (TorrentDetails)
- Set share limits (TorrentDetails)
- Set location (TorrentDetails)
- Rename torrent (TorrentDetails)
- Add peers (TorrentDetails)
- Rename file (TorrentDetails)

On Android, all 13 of these silently do nothing or crash. **This is an existing bug, not a redesign risk** — but the redesign needs to fix it, not make it worse. The `InputModal` component already exists and could replace all 13.

### 7.2 ActionSheetIOS in Tracker Management

`manage-trackers.tsx` uses `ActionSheetIOS` for the tracker options menu. On Android, the fallback is just `handleEditTracker` — meaning delete, copy, and reannounce aren't available on Android.

### 7.3 Haptics Are Disabled on Android

`utils/haptics.ts` checks `Platform.OS === 'ios'` and does nothing on Android. `expo-haptics` actually supports Android — the platform check is unnecessarily restrictive.

---

## 8. Safe Implementation Order

The order that minimizes risk of breaking the running app:

### Wave 1: Zero-risk fixes (no behavioral change)

These can't break anything:

1. Fix `backgroundColor: 'colors.r'` → `colors.background` in `_layout.tsx`
2. Fix `usesCleartextTraffic: 'true'` → `usesCleartextTraffic: true` in `app.config.js`
3. Fix trailing space in app name `'qRemote '` → `'qRemote'`
4. Remove dead `App.tsx` file
5. Enable Android haptics (remove platform guard in `utils/haptics.ts`)
6. Remove commented-out `console.log` statements across API modules

### Wave 2: Isolated component changes (test each in isolation)

Each change is self-contained within one file:

7. Create `<Icon>` wrapper component (abstracts Ionicons, enables future SF Symbol swap)
8. Replace `Alert.prompt` with `InputModal` across all 13 callsites — **critical Android fix**
9. Replace `ActionSheetIOS` with cross-platform menu in `manage-trackers.tsx`
10. Fix Confetti hooks-in-loop bug
11. Fix `ExpandableTorrentCard` missing `onPress`
12. Fix `isRecoveringFromBackground` ref→state in `TorrentContext`
13. Wrap `TorrentCard` in `React.memo` with custom comparator
14. Add `useCallback` to card action handlers passed from list

### Wave 3: Design system changes (visual, potentially user-facing)

These change appearance but not behavior:

15. Update default color values to new palette — **test both themes, verify color picker still works, verify saved user overrides still apply correctly**
16. Update typography scale
17. Remove dark-mode shadows
18. Simplify light-mode shadows
19. Route all hardcoded colors through `useTheme()`

### Wave 4: Component redesigns (high-risk, test heavily)

Each of these touches multiple files:

20. Redesign `TorrentCard` layout (keep all functionality, change visual structure)
21. Replace custom popup menu with native context menu OR clean shared-menu component
22. Add bottom sheet for add-torrent (replaces Modal)
23. Add swipe actions to torrent list (requires gesture handler validation)
24. Break settings into sub-screens (one section at a time)
25. Redesign transfer screen layout

### Wave 5: Architecture changes (highest risk)

These touch the most files and have the widest blast radius:

26. Add TypeScript path aliases
27. Move non-route files to new structure (incrementally, using aliases)
28. Replace Context polling with TanStack Query
29. Add FlashList (after lifting menu state out of TorrentCard)
30. Migrate remaining Animated → Reanimated

### Things to defer (not worth the risk for v3.0)

- Full SF Symbols migration (do Icon wrapper now, swap icons later)
- Feature-based folder restructure (do path aliases now, move files in v3.1)
- Shared element transitions (complex, easy to get wrong, do in v3.1)
- Custom pull-to-refresh (cosmetic, easy to add post-launch)
- Lottie in onboarding (onboarding isn't even wired up)

---

## The Golden Rule

**Every change should be independently testable and independently revertible.** Never combine a visual change with a structural change in the same commit. If the new `TorrentCard` layout has a bug, you should be able to revert just that commit without also undoing the color system update.

This means: small commits, one concern per commit, test after each merge. The app should build and run correctly at every commit in the history.

---

*Generated from implementation risk audit on 2026-03-14.*
