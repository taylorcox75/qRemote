# AI Agent Maintainability Guide

> What makes this codebase slow and error-prone for AI coding agents,
> and specific fixes to make every future agent session faster and safer.

---

## The Core Problem

AI agents (Cursor, Copilot, Codex, etc.) work by reading files into a context window, reasoning about them, and writing changes. Three things kill agent efficiency:

1. **Large files** — Agents must read more tokens to understand context, burning through context window and increasing latency.
2. **Implicit knowledge** — When a contract exists only as convention (not code), agents guess wrong.
3. **No verification loop** — When agents can't test their changes, they ship bugs.

This codebase has all three problems.

---

## Problem 1: Giant Files Destroy Context Windows

### Current state

| File | Lines | What it does |
|------|------:|-------------|
| `components/TorrentDetails.tsx` | 2,085 | Torrent detail (overview, trackers, files) |
| `app/(tabs)/settings.tsx` | 1,957 | All settings in one screen |
| `app/(tabs)/index.tsx` | 1,729 | Torrent list + search + filters + add modal + quick-connect |
| `app/(tabs)/transfer.tsx` | 1,557 | Transfer dashboard + quick-connect |
| `app/torrent/[hash].tsx` | 1,511 | Torrent detail screen |
| `components/TorrentCard.tsx` | 1,078 | Card + full context menu + 9 action handlers |
| `components/SuperDebugPanel.tsx` | 1,015 | Debug diagnostics panel |
| `app/server/[id].tsx` | 999 | Edit server form |
| `app/server/add.tsx` | 920 | Add server form |
| `app/torrent/files.tsx` | 899 | File browser |

**10 files over 900 lines.** When an agent needs to modify `settings.tsx`, it reads 1,957 lines just to understand the file, then figures out which of the 15 interwoven features it needs to touch. Most of those tokens are irrelevant to the task.

### Fix: Split files at natural boundaries

A good target is **max 300 lines per file**. Split along feature boundaries:

- `settings.tsx` → `SettingsScreen.tsx` (shell + navigation), `ConnectionSection.tsx`, `AppearanceSection.tsx`, `TorrentDefaultsSection.tsx`, `AdvancedSection.tsx`, `DangerZoneSection.tsx`, `WhatsNewModal.tsx`, `SwipeableServerItem.tsx`
- `TorrentCard.tsx` → `TorrentCard.tsx` (pure render, ~200 lines), `TorrentCardMenu.tsx` (context menu), `useTorrentActions.ts` (action handlers)
- `index.tsx` → `TorrentsScreen.tsx` (list), `AddTorrentSheet.tsx` (modal), `QuickConnectPanel.tsx` (shared with transfer), `FilterBar.tsx`, `SortMenu.tsx`

**Agent benefit:** An agent asked to "change the sort menu" only needs to read `SortMenu.tsx` (100 lines) instead of `index.tsx` (1,729 lines). 17x less context consumed.

---

## Problem 2: No AGENTS.md

There is no `AGENTS.md`, no `.cursorrules`, and no `.cursor/` directory. Every agent session starts from zero — reading the README (user-facing), guessing the architecture, guessing the dev workflow, guessing the conventions.

### Fix: Create AGENTS.md

This file should contain everything an AI agent needs to be productive immediately:

```markdown
# AGENTS.md

## Project Overview
qRemote is a React Native (Expo SDK 54) mobile app for remotely controlling
qBittorrent servers. It runs on iOS and Android via Expo Go.

## Architecture
- Expo Router file-based routing in `app/`
- React Context for state (ThemeContext, ServerContext, TorrentContext, TransferContext, ToastContext)
- Polling-based sync with qBittorrent WebUI API v2
- AsyncStorage for preferences, SecureStore for passwords
- All colors go through ThemeContext — never hardcode colors

## Dev Commands
- `npm start` — Start Expo dev server (Expo Go)
- `npm run ios` — Start on iOS simulator
- `npm run android` — Start on Android emulator
- No test runner configured yet

## File Conventions
- Screens: `app/` (Expo Router file-based routing)
- Components: `components/` (shared UI)
- State: `context/` (React Context providers)
- API: `services/api/` (thin wrappers over apiClient)
- Types: `types/api.ts` (all API types)

## Critical Rules
1. NEVER hardcode colors — use `useTheme()` and `colors.*`
2. NEVER use `Alert.prompt` — it's iOS-only. Use `InputModal` component instead.
3. NEVER rename color keys in ThemeContext — users have overrides stored by key name.
4. NEVER rename preference keys in storage — no migration system exists.
5. All new strings must use i18n (`useTranslation` + locale JSON files).
6. The `app/onboarding.tsx` route exists but is NOT wired up — no code navigates to it.
7. `SwipeableTorrentCard` and `DraggableTorrentList` import `react-native-gesture-handler`
   which is NOT in package.json — these components may be broken.
8. The `App.tsx` at root is dead code — entry point is `index.ts` → `expo-router/entry`.

## Known Bugs
- `app/_layout.tsx:32` — `backgroundColor: 'colors.r'` is a string literal, not a variable
- `components/Confetti.tsx` — `useRef` called inside Array.from loop (Rules of Hooks violation)
- `components/ExpandableTorrentCard.tsx:173-178` — Pause button has no onPress handler
- `app.config.js` — `usesCleartextTraffic: 'true'` should be boolean `true`
- `app.config.js` — App name has trailing space: `'qRemote '`

## Preferences Schema
See `types/preferences.ts` for the typed preferences interface.
(This file doesn't exist yet — creating it is recommended.)

## Color System
Colors flow: ThemeContext defaults → merged with user overrides from colorThemeManager → consumed via useTheme().
There are 11 torrent state color keys. Do not remove any. Change defaults, not the schema.
The color picker in settings/theme.tsx exposes all keys. The ColorTheme interface is in services/color-theme-manager.ts.
```

**Agent benefit:** Every agent session immediately knows the rules, the bugs, the conventions. No 20-minute exploration phase.

---

## Problem 3: Untyped Preferences Are a Guessing Game

### Current state

`storageService.getPreferences()` returns `Record<string, any>`. Preferences are written from 8+ different files, each adding their own keys:

```typescript
// From settings.tsx
await storageService.savePreferences({ ...prefs, defaultSortBy: 'name' });
await storageService.savePreferences({ ...prefs, hapticFeedback: true });
await storageService.savePreferences({ ...prefs, cardViewMode: 'compact' });
await storageService.savePreferences({ ...prefs, debugMode: true });
await storageService.savePreferences({ ...prefs, connectionTimeout: 10000 });

// From onboarding.tsx
await storageService.savePreferences({ ...prefs, hasCompletedOnboarding: true });

// From theme.tsx (via colorThemeManager)
await storageService.savePreferences({ ...prefs, customColors: { dark: {...}, light: {...} } });
await storageService.savePreferences({ ...prefs, theme: 'dark' });
```

An agent asked to "add a new preference for auto-refresh interval" has no way to know what keys already exist, what their types are, or what their defaults should be — without grepping every file.

### Fix: Create a typed preferences interface

```typescript
// types/preferences.ts

export interface AppPreferences {
  // Theme
  theme: 'dark' | 'light';
  customColors: Record<'dark' | 'light', Partial<ColorTheme>>;

  // Torrent list
  defaultSortBy: 'name' | 'size' | 'progress' | 'dlspeed' | 'upspeed' | 'ratio' | 'added_on';
  defaultSortDirection: 'asc' | 'desc';
  defaultFilter: string;
  cardViewMode: 'compact' | 'expanded';

  // Torrent behavior
  pauseOnAdd: boolean;
  defaultSavePath: string;
  defaultPriority: number;

  // Notifications
  toastDuration: number;
  hapticFeedback: boolean;

  // Server
  autoConnect: boolean;
  connectionTimeout: number;
  apiTimeout: number;
  retryAttempts: number;

  // Advanced
  debugMode: boolean;
  refreshInterval: number;

  // Onboarding
  hasCompletedOnboarding: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'dark',
  customColors: {},
  defaultSortBy: 'added_on',
  defaultSortDirection: 'desc',
  defaultFilter: 'all',
  cardViewMode: 'compact',
  pauseOnAdd: false,
  defaultSavePath: '/data/downloads',
  defaultPriority: 0,
  toastDuration: 3000,
  hapticFeedback: true,
  autoConnect: true,
  connectionTimeout: 10000,
  apiTimeout: 30000,
  retryAttempts: 3,
  debugMode: false,
  refreshInterval: 2000,
  hasCompletedOnboarding: false,
};
```

Then update `storageService`:
```typescript
async getPreferences(): Promise<Partial<AppPreferences>> { ... }
async savePreferences(preferences: Partial<AppPreferences>): Promise<void> { ... }
```

**Agent benefit:** Autocomplete works. Type errors catch wrong keys. An agent can see every preference that exists in one file.

---

## Problem 4: No Tests = No Verification

There are zero test files in the project. An AI agent that modifies `getStateColor()` in TorrentCard has no way to verify it didn't break 3 other states. It ships the change and hopes.

### Fix: Add tests for the riskiest code first

Priority targets (highest impact, easiest to test):

1. **`utils/format.ts`** — Pure functions, zero dependencies. `formatSize`, `formatSpeed`, `formatTime`, `formatDate`, `formatRatio`. Write 20 test cases, cover edge cases (0, null, undefined, NaN, negative, very large).

2. **`services/api/client.ts`** — The `withRetry` function, URL building, cookie parsing. Mock axios, test interceptor behavior.

3. **`getStateColor` / `getStateLabel`** in TorrentCard — Pure functions that take state + progress + speeds and return a color/label. Extract to a utility, write a truth table test.

4. **`colorThemeManager.mergeColors`** — Pure function. Test that custom overrides correctly merge with defaults.

5. **`services/storage.ts`** — Mock AsyncStorage and SecureStore. Test the read/write/delete cycle.

**Agent benefit:** After making a change, the agent runs `npm test` and gets a pass/fail signal. No guessing.

---

## Problem 5: Duplicated Code Creates Divergent Copies

When code exists in two places, an agent fixes one and doesn't know about the other. Current duplications:

| Code | Location 1 | Location 2 |
|------|-----------|-----------|
| `avatarColor()` + `serverAddress()` | `app/(tabs)/index.tsx:45-54` | `app/(tabs)/transfer.tsx:48-62` |
| `stripProtocol()` | `app/server/add.tsx` | `app/server/[id].tsx` and `services/storage.ts` |
| `getStateColor()` / `getStateLabel()` | `components/TorrentCard.tsx` | `app/torrent/[hash].tsx` and `components/ExpandableTorrentCard.tsx` |
| `formatSize` / `formatSpeed` / `formatTime` | `utils/format.ts` | Re-implemented inline in `components/TorrentDetails.tsx` |
| Quick-connect UI | `app/(tabs)/index.tsx:636-731` | `app/(tabs)/transfer.tsx` (same layout) |
| Server form fields + validation | `app/server/add.tsx` | `app/server/[id].tsx` |
| `isNetworkError` detection | `services/server-manager.ts` (4 times) | — |

### Fix: Deduplicate into single-source utilities

Create `utils/server.ts` for `avatarColor`, `serverAddress`, `stripProtocol`. Create `utils/torrent-state.ts` for `getStateColor`, `getStateLabel`. Create a `QuickConnectPanel` component. Create a `ServerForm` component.

**Agent benefit:** When an agent sees a function imported from `utils/torrent-state.ts`, it knows that's the only copy. When it sees inline state-color logic, it knows something is wrong.

---

## Problem 6: Implicit Contracts

### Color keys are strings, not an enum

The `ColorTheme` interface keys are just optional string properties. Nothing enforces that `TorrentCard` uses the same key names as `ThemeContext`. A typo like `colors.stateDownloding` silently returns `undefined` (which React Native renders as transparent).

**Fix:** Export a `ColorKey` type union from the theme, and type the `colors` object strictly. TypeScript will catch typos at compile time.

### Preference keys are strings, not typed

Covered above in Problem 3.

### Storage keys are scattered

`STORAGE_KEYS` in `storage.ts` only covers 3 keys. But `logStorage.ts` uses `'app_logs'` and `'auto_delete_timestamp'` directly. `colorThemeManager` reads from the preferences bag. The i18n module reads `'appLanguage'` from AsyncStorage directly.

**Fix:** Centralize ALL storage keys (AsyncStorage + SecureStore) into one file. Makes it impossible for two features to accidentally use the same key.

### API version is repeated in every module

Every API file has `const API_VERSION = 'v2'`. If qBittorrent changes the API version, you'd need to update 8 files.

**Fix:** Export `API_VERSION` from `client.ts` and import it everywhere. Or build it into the client's base URL.

---

## Problem 7: No File-Level Documentation

When an agent opens a file, it needs to quickly understand: what does this file do, what are its inputs/outputs, and what are the gotchas?

Currently, most files have zero file-level documentation. The agent must read the entire file to understand its purpose.

### Fix: Add a JSDoc block at the top of each file

```typescript
/**
 * TorrentCard — Displays a single torrent in the list.
 *
 * Props: torrent (TorrentInfo), viewMode ('compact' | 'expanded'), onPress
 * Contains: inline context menu (long-press), play/pause button, stat display
 * State colors: uses getStateColor() which maps TorrentState → theme color
 *
 * Known issues:
 * - handleSetDownloadLimit uses Alert.prompt (iOS-only)
 * - Not wrapped in React.memo — re-renders on every poll tick
 * - Menu positioning logic is ~100 lines of manual measureInWindow
 */
```

This costs almost nothing and saves every future agent session 30+ seconds per file.

---

## Problem 8: No Path Aliases

Every import is relative: `../../context/ThemeContext`, `../services/api/torrents`, `../../components/TorrentCard`. When an agent needs to add an import, it must figure out the relative path from the current file to the target. It frequently gets the depth wrong (e.g. `../` vs `../../`).

### Fix: Add TypeScript path aliases

In `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

In `babel.config.js` (add `babel-plugin-module-resolver`):
```javascript
plugins: [
  ['module-resolver', { alias: { '@': '.' } }],
  'react-native-reanimated/plugin',
]
```

Then imports become:
```typescript
import { useTheme } from '@/context/ThemeContext';
import { TorrentCard } from '@/components/TorrentCard';
import { formatSpeed } from '@/utils/format';
```

**Agent benefit:** Imports are always the same regardless of which file you're in. No counting `../` levels. No breaking imports when moving files.

---

## Problem 9: Dead Code Wastes Agent Time

Dead code that an agent discovers, reads, and tries to understand or fix:

| Dead code | Why it's dead | Agent risk |
|-----------|--------------|------------|
| `App.tsx` | Entry is `expo-router/entry`, not `App.tsx` | Agent might try to modify it thinking it's the root |
| `app/onboarding.tsx` | Route exists but nothing navigates to it | Agent might try to fix/improve it |
| `app/torrent/add.tsx` | Standalone screen, but main flow uses the modal in `index.tsx` | Agent might add features here instead of the modal |
| `hooks/useDynamicColors.ts` | Always returns null, references non-existent utils | Agent might try to implement it |
| `csrfToken` in `ApiClient` | Captured but never sent | Agent might wire it up unnecessarily |
| `apiTimeout` in `ApiClient` | Stored but never used | Agent might assume it works |
| `DraggableTorrentList` | Not used in any screen | Agent might try to integrate it |
| `SwipeableTorrentCard` | Not used in any screen | Agent might try to integrate it |
| `ExpandableTorrentCard` | Not used in any screen | Agent might try to fix the broken onPress |
| `SharedTransitionCard` | Not used in any screen | Agent might try to wire it up |
| `AnimatedTorrentCard` | Not used in any screen | Agent might try to use it |
| `ContextualFAB` | Not used in any screen | Agent might try to replace the current FAB with it |
| `GradientCard` | Not used in any screen | Agent reads 64 lines for nothing |
| `HealthRing` | Not used in any screen | Agent reads 93 lines for nothing |
| `AnimatedStateIcon` | Not used in any screen | 132 wasted lines of context |

That's **15 dead files**. An agent doing a "full codebase review" reads all of them, wastes context window, and might try to fix bugs in code that never runs.

### Fix: Two options

**Option A (recommended):** Move dead-but-potentially-useful code to a `_unused/` or `_experimental/` directory. Agents are trained to skip directories prefixed with `_`. Add to `.gitignore` if you don't want them tracked, or keep them tracked but out of the main tree.

**Option B:** Delete them. They're in git history if you ever need them back.

At minimum, add a comment at the top of each dead file:
```typescript
/**
 * NOT IN USE — This component is not imported by any screen.
 * It was built as an experiment / prototype.
 * Do not modify unless you're wiring it into a live screen.
 */
```

---

## Summary: The Top 5 Actions

Ordered by impact-per-effort for AI agent efficiency:

| # | Action | Effort | Agent Impact |
|---|--------|--------|-------------|
| 1 | **Create `AGENTS.md`** with architecture, conventions, known bugs, rules | 30 min | Eliminates the exploration phase from every session |
| 2 | **Type the preferences object** (`types/preferences.ts`) | 1 hour | Eliminates guessing about what preferences exist |
| 3 | **Add path aliases** (`@/` prefix) | 30 min | Eliminates relative import errors |
| 4 | **Mark or move dead code** (15 unused files) | 30 min | Saves ~2,000 lines of wasted context per session |
| 5 | **Split the 5 biggest files** (settings, index, transfer, torrent detail, TorrentCard) | 2-3 days | 10x faster file reads, smaller blast radius per change |

These five changes would make every future AI agent session roughly **2-3x faster** and significantly less error-prone.

---

*Generated from AI-agent efficiency audit on 2026-03-14.*
