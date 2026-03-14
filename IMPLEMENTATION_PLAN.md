# UI Fix Plan — Post-Refactor Issues

**Branch:** `cursor/torrent-display-and-controls-4bad`  
**Base:** `cursor/codebase-improvement-plan-8686`

-----

## ✅ Status — All 6 Issues Implemented

All issues below have been implemented and verified via `npx tsc --noEmit` (compiles clean) and `npx jest` (120/120 tests pass). Testing on-device against a live qBittorrent server is still needed — see [Testing Checklist](#testing-checklist) at the bottom.

| Issue | Status | Files Changed |
|-------|--------|---------------|
| Issue 1 — Alt Speed Limits | ✅ Done | `types/api.ts`, `context/TransferContext.tsx`, `app/(tabs)/transfer.tsx` |
| Issue 2 — Pause/Resume Button | ✅ Done | `components/TorrentCard.tsx`, `app/(tabs)/index.tsx` |
| Issue 3 — Progress Bar Fill | ✅ Done | `components/TorrentCard.tsx` |
| Issue 4 — Pause-on-Add Desync | ✅ Done | `app/settings/torrent-defaults.tsx`, `app/(tabs)/index.tsx` |
| Issue 5 — Expanded Card View | ✅ Done | `components/TorrentCard.tsx`, `app/(tabs)/index.tsx` |
| Issue 6 — Search Bar Layout | ✅ Done | `app/(tabs)/index.tsx` |

### Remaining work for next agent

- **On-device testing** — All items in the [Testing Checklist](#testing-checklist) below need manual verification on a device connected to a live qBittorrent server. The cloud environment cannot run Expo Go.
- **i18n gap** — The `ALT` badge text in `app/(tabs)/transfer.tsx` (lines ~583, ~608) is hardcoded English. Should use `t('common.alt')` or similar key. Minor — it's a technical abbreviation, but other labels are i18n'd.
- **`DetailRow` labels hardcoded** — In `components/TorrentCard.tsx`, the expanded card `DetailRow` labels (Seeds, Peers, Ratio, Uploaded, Category, Tags, Tracker, Added, Active, Path) are hardcoded English. They should use `t()` keys for consistency with the rest of the app.

-----

## Issue 1 — Alt Speed: Show Active Limits in Transfer Screen

### Root cause

`transfer.tsx` speed limit rows unconditionally read `transferInfo.dl_rate_limit` / `transferInfo.up_rate_limit` from `GlobalTransferInfo`. Alt speed limits (`alt_dl_limit`, `alt_up_limit`) are not in `GlobalTransferInfo` at all — they live in `app/preferences` and are never fetched. `TransferContext.fetchTransferInfo()` only calls `getGlobalTransferInfo()` + `getAlternativeSpeedLimitsState()`.

### Step 1 — Extend `GlobalTransferInfo` in `types/api.ts`

```ts
// Before
export interface GlobalTransferInfo {
  connection_status: string;
  dht_nodes: number;
  dl_info_data: number;
  dl_info_speed: number;
  dl_rate_limit: number;
  up_info_data: number;
  up_info_speed: number;
  up_rate_limit: number;
  use_alt_speed_limits?: boolean;
}

// After — add alt limit fields
export interface GlobalTransferInfo {
  connection_status: string;
  dht_nodes: number;
  dl_info_data: number;
  dl_info_speed: number;
  dl_rate_limit: number;
  up_info_data: number;
  up_info_speed: number;
  up_rate_limit: number;
  use_alt_speed_limits?: boolean;
  alt_dl_limit?: number;   // bytes/s — fetched from app/preferences, converted from kB/s
  alt_up_limit?: number;   // bytes/s
}
```

### Step 2 — Fetch alt limits in `context/TransferContext.tsx`

`fetchTransferInfo()` currently runs two parallel calls. Add a third:

```ts
// Before
async function fetchTransferInfo(): Promise<GlobalTransferInfo> {
  const [info, altSpeedLimitsState] = await Promise.all([
    transferApi.getGlobalTransferInfo(),
    transferApi.getAlternativeSpeedLimitsState().catch(() => false),
  ]);
  return {
    ...info,
    use_alt_speed_limits: altSpeedLimitsState,
  };
}

// After
async function fetchTransferInfo(): Promise<GlobalTransferInfo> {
  const [info, altSpeedLimitsState, prefs] = await Promise.all([
    transferApi.getGlobalTransferInfo(),
    transferApi.getAlternativeSpeedLimitsState().catch(() => false),
    applicationApi.getPreferences().catch(() => null),
  ]);
  const p = prefs as Record<string, unknown> | null;
  return {
    ...info,
    use_alt_speed_limits: altSpeedLimitsState,
    // Preferences returns kB/s; multiply by 1024 to normalize to bytes/s like dl_rate_limit
    alt_dl_limit: p?.alt_dl_limit != null ? (p.alt_dl_limit as number) * 1024 : undefined,
    alt_up_limit: p?.alt_up_limit != null ? (p.alt_up_limit as number) * 1024 : undefined,
  };
}
```

Add import at top of `TransferContext.tsx`:

```ts
import { applicationApi } from '@/services/api/application';
```

### Step 3 — Update speed limit rows in `app/(tabs)/transfer.tsx`

The download and upload limit rows (~lines 575–605) each have a `<Text>` that reads directly from `transferInfo`. Replace with conditional logic:

```tsx
// Before — download limit value Text
{transferInfo.dl_rate_limit > 0
  ? formatSpeed(transferInfo.dl_rate_limit)
  : t('common.unlimited')}

// After
{(() => {
  const limit = isAltSpeedEnabled
    ? (transferInfo.alt_dl_limit ?? 0)
    : transferInfo.dl_rate_limit;
  return limit > 0 ? formatSpeed(limit) : t('common.unlimited');
})()}
```

Same pattern for the upload row (`up_rate_limit` → `alt_up_limit`).

Disable both rows while alt speed is active:

```tsx
// Before
<TouchableOpacity style={styles.row} onPress={() => setDlPickerVisible(true)} disabled={settingLimit}>

// After
<TouchableOpacity style={styles.row} onPress={() => setDlPickerVisible(true)} disabled={settingLimit || isAltSpeedEnabled}>
```

Add an `ALT` badge in `rowTrailing` when alt is active:

```tsx
<View style={styles.rowTrailing}>
  {isAltSpeedEnabled && (
    <Text style={[styles.altBadge, { color: colors.primary }]}>ALT</Text>
  )}
  <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
    {/* effective limit value */}
  </Text>
  <Ionicons
    name="chevron-forward"
    size={16}
    color={isAltSpeedEnabled ? colors.surfaceOutline : colors.textSecondary}
  />
</View>
```

Add to `StyleSheet.create` in `transfer.tsx`:

```ts
altBadge: {
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 0.5,
  marginRight: 4,
},
```

**Files:** `types/api.ts`, `context/TransferContext.tsx`, `app/(tabs)/transfer.tsx`

-----

## Issue 2 — Pause/Resume Button on Torrent Card

### Root cause

`TorrentCard` exposes only `onPress` / `onLongPress`. There is no inline action. A working `handleSwipePauseResume` already exists in `index.tsx` that calls `torrentsApi.pauseTorrents` / `resumeTorrents` — it just takes a `swipeableRef` arg that is irrelevant here.

### Step 1 — Add `onPauseResume` prop to `components/TorrentCard.tsx`

```ts
// Before
interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
}

// After
interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
}
```

Destructure in `TorrentCardInner`:

```ts
function TorrentCardInner({ torrent, onPress, onLongPress, onPauseResume }: TorrentCardProps)
```

### Step 2 — Insert button in JSX

Place at the far right of `statusRow`, after `statusText`:

```tsx
// Before — statusRow
<View style={styles.statusRow}>
  <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
  <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
    {stateLabel}{speedText}
  </Text>
</View>

// After
<View style={styles.statusRow}>
  <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
  <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
    {stateLabel}{speedText}
  </Text>
  {onPauseResume && (
    <TouchableOpacity
      onPress={(e) => { e.stopPropagation?.(); onPauseResume(); }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.pauseButton}
      activeOpacity={0.6}
    >
      <Ionicons
        name={isPaused ? 'play-circle-outline' : 'pause-circle-outline'}
        size={22}
        color={isPaused ? colors.success : colors.textSecondary}
      />
    </TouchableOpacity>
  )}
</View>
```

Add style:

```ts
pauseButton: {
  marginLeft: spacing.sm,
  justifyContent: 'center',
  alignItems: 'center',
},
```

### Step 3 — Update `React.memo` comparator

```ts
export const TorrentCard = React.memo(TorrentCardInner, (prev, next) => {
  return (
    prev.torrent.hash === next.torrent.hash &&
    prev.torrent.state === next.torrent.state &&
    prev.torrent.progress === next.torrent.progress &&
    prev.torrent.dlspeed === next.torrent.dlspeed &&
    prev.torrent.upspeed === next.torrent.upspeed &&
    prev.torrent.name === next.torrent.name &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPauseResume === next.onPauseResume  // add this
  );
});
```

### Step 4 — Add handler and wire prop in `app/(tabs)/index.tsx`

Add alongside `handleSwipePauseResume` (~line 423):

```ts
const handleCardPauseResume = useCallback(async (torrent: TorrentInfo) => {
  haptics.medium();
  const isPaused =
    torrent.state === 'pausedDL' || torrent.state === 'pausedUP' ||
    torrent.state === 'stoppedDL' || torrent.state === 'stoppedUP';
  try {
    if (isPaused) {
      await torrentsApi.resumeTorrents([torrent.hash]);
    } else {
      await torrentsApi.pauseTorrents([torrent.hash]);
    }
    refresh();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    showToast(msg || (isPaused ? t('errors.failedToResume') : t('errors.failedToPause')), 'error');
  }
}, [refresh, showToast, t]);
```

At the `TorrentCard` render site (~line 1032):

```tsx
<TorrentCard
  torrent={item}
  onPress={...}
  onLongPress={...}
  onPauseResume={() => handleCardPauseResume(item)}
/>
```

**Files:** `components/TorrentCard.tsx`, `app/(tabs)/index.tsx`

-----

## Issue 3 — Progress Bar Visual Fill

### Root cause

`progressRow` is `flexDirection: 'row'` with two flex siblings: `progressBar` (`flex: 1`) and `progressText` (`minWidth: 70`). With `gap: spacing.sm`, the bar's rendered width is `cardWidth - paddingHorizontal*2 - gap - 70`. The `progressFill` `width: "${progress}%"` is a percentage of that narrowed parent — not the full card width. At 100% the fill ends ~80px short of the card right edge. This is a layout sibling problem, not a rounding error.

### Fix — remove `progressText` as a sibling; fold percent+ETA into `statusRow`

```tsx
// Before — bottom of TorrentCardInner JSX
<View style={styles.statusRow}>
  <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
  <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
    {stateLabel}{speedText}
  </Text>
</View>

<View style={styles.progressRow}>
  <View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: stateColor }]} />
  </View>
  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
    {progress.toFixed(0)}%{hasEta ? ` · ${formatTime(torrent.eta)}` : ''}
  </Text>
</View>

<Text style={[styles.sizeText, { color: colors.textSecondary }]}>
  {formatSize(downloaded)} / {formatSize(totalSize)}
</Text>
```

```tsx
// After
// Build statusLine to include percent+ETA inline
const statusLine = [
  stateLabel,
  speedText || null,
  `${progress.toFixed(0)}%`,
  hasEta ? formatTime(torrent.eta) : null,
].filter(Boolean).join('  ·  ');

<View style={styles.statusRow}>
  <View style={[styles.stateDot, { backgroundColor: stateColor }]} />
  <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={1}>
    {statusLine}
  </Text>
  {/* pause button from Issue 2 */}
</View>

{/* Full-width progress bar — no siblings */}
<View style={[styles.progressBar, { backgroundColor: colors.surfaceOutline }]}>
  <View style={[
    styles.progressFill,
    { width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: stateColor }
  ]} />
</View>

<Text style={[styles.sizeText, { color: colors.textSecondary }]}>
  {formatSize(downloaded)} / {formatSize(totalSize)}
</Text>
```

### Style changes in `StyleSheet.create`

```ts
// Remove: progressRow, progressText

// Update: progressBar
progressBar: {
  // was: flex: 1
  width: '100%',
  // was: height: 3
  height: 4,
  // was: borderRadius: 1.5
  borderRadius: 2,
  overflow: 'hidden',
  marginBottom: 4,  // moved from progressRow.marginBottom
},
```

**Files:** `components/TorrentCard.tsx`

-----

## Issue 4 — Pause-on-Add Setting Desync (Server vs. Local State)

### Root cause

There are two completely separate "pause on add" values that are never reconciled:

1. **Local preference** — `AppPreferences.pauseOnAdd` in AsyncStorage, shown in the app UI toggle
1. **Server preference** — `start_paused_enabled` in qBittorrent's `app/preferences`, which is what the server actually honors when a torrent is added via the API

The app never reads `start_paused_enabled` from the server on connect. It never writes to it either — `handleSubmitTorrent` passes `stopped: prefs.pauseOnAdd === true` as an add option, but qBittorrent's `torrents/add` endpoint ignores `stopped` if the server's own `start_paused_enabled` is `true`. The server-side setting wins.

So: server had `start_paused_enabled: true`. App UI showed the local toggle as off. Torrent was added paused because the server honored its own setting. Toggling the app UI multiple times eventually triggered a `savePreference` write — but that only updated AsyncStorage, not the server — so behavior appeared to change by coincidence (e.g. test timing, or a different add path).

### Fix — sync `start_paused_enabled` from server on connect, and write back on toggle

**Step 1 — Read server preference on Settings screen mount in `app/settings/torrent-defaults.tsx`**

In `loadPreferences()` (~line 86), add a parallel fetch of `app/preferences` from the server:

```ts
// Before
const loadPreferences = async () => {
  try {
    const prefs = await storageService.getPreferences();
    // ...
    setPauseOnAdd(prefs.pauseOnAdd || false);
```

```ts
// After
const loadPreferences = async () => {
  try {
    const [prefs, serverPrefs] = await Promise.all([
      storageService.getPreferences(),
      applicationApi.getPreferences().catch(() => null),
    ]);
    // Server is source of truth for pauseOnAdd — local pref is just a cache
    const serverPauseOnAdd = serverPrefs
      ? !!(serverPrefs as Record<string, unknown>).start_paused_enabled
      : (prefs.pauseOnAdd === true);
    setPauseOnAdd(serverPauseOnAdd);
    // Keep local cache in sync with what we just read
    await storageService.savePreferences({ ...prefs, pauseOnAdd: serverPauseOnAdd });
```

Add import in `torrent-defaults.tsx`:

```ts
import { applicationApi } from '@/services/api/application';
```

**Step 2 — Write to server on toggle in `torrent-defaults.tsx` line 238**

```ts
// Before
onValueChange={(value) => { setPauseOnAdd(value); savePreference('pauseOnAdd', value); }}

// After
onValueChange={async (value) => {
  setPauseOnAdd(value); // optimistic UI update
  try {
    // Write to server — this is the source of truth
    await applicationApi.setPreferences(
      { start_paused_enabled: value } as ApplicationPreferences
    );
    // Also update local cache
    await savePreference('pauseOnAdd', value);
  } catch {
    // Roll back UI if server write fails
    setPauseOnAdd(!value);
  }
}}
```

Add `ApplicationPreferences` to the import from `@/types/api` in `torrent-defaults.tsx`.

**Step 3 — Remove `stopped` override from `handleSubmitTorrent` in `app/(tabs)/index.tsx`**

The `stopped` field in `torrents/add` is redundant once the server preference is correctly set and synced. However, keep it as an explicit per-add override so the user can still add a single torrent outside the default behavior in future (e.g. a per-add override toggle in the Add modal). No change needed here for now — it will work correctly once the server setting matches the UI state.

**Step 4 — Sync on app connect (optional but thorough)**

In the `loadPreferences` useEffect in `app/(tabs)/index.tsx` (~line 99), add a server preferences read after connection is established and update local `pauseOnAdd` if the value has drifted:

```ts
// After isConnected is true and prefs are loaded
if (isConnected) {
  applicationApi.getPreferences().then((serverPrefs) => {
    const serverVal = !!(serverPrefs as Record<string, unknown>).start_paused_enabled;
    storageService.getPreferences().then((localPrefs) => {
      if (localPrefs.pauseOnAdd !== serverVal) {
        storageService.savePreferences({ ...localPrefs, pauseOnAdd: serverVal });
      }
    });
  }).catch(() => {});
}
```

This is a best-effort background sync — no state update needed here since it only affects the next torrent add, not the current UI.

**Files:** `app/settings/torrent-defaults.tsx`, `app/(tabs)/index.tsx`, `types/api.ts` (add `start_paused_enabled?: boolean` to `ApplicationPreferences` if not already present — currently it's `[key: string]: unknown` so it will pass through without type changes)

-----

## Issue 5 — Non-Compact Card: Restore Detailed View

### Root cause

`AppPreferences.cardViewMode: 'compact' | 'expanded'` exists and is written by `appearance.tsx`. `index.tsx` never reads it. `TorrentCard` has no `compact` prop and no conditional rendering path. The preference is stored but has zero effect on the UI.

### Step 1 — Add `compact` prop to `components/TorrentCard.tsx`

```ts
// Before
interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
}

// After
interface TorrentCardProps {
  torrent: TorrentInfo;
  onPress: () => void;
  onLongPress?: () => void;
  onPauseResume?: () => void;
  compact?: boolean;  // default true
}

// Destructure
function TorrentCardInner({ torrent, onPress, onLongPress, onPauseResume, compact = true }: TorrentCardProps)
```

### Step 2 — Add `DetailRow` helper component (top of file, not exported)

```tsx
function DetailRow({
  label,
  value,
  truncate = false,
}: {
  label: string;
  value: string;
  truncate?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={detailRowStyles.row}>
      <Text style={[detailRowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text
        style={[detailRowStyles.value, { color: colors.text }]}
        numberOfLines={truncate ? 1 : undefined}
        ellipsizeMode="middle"
      >
        {value}
      </Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 64,
    marginRight: 8,
  },
  value: {
    fontSize: 12,
    fontWeight: '400',
    flex: 1,
    textAlign: 'right',
  },
});
```

### Step 3 — Add detail section to `TorrentCardInner` JSX

After the existing `sizeText`:

```tsx
{!compact && (
  <View style={[styles.detailGrid, { borderTopColor: colors.surfaceOutline }]}>
    <DetailRow label="Seeds"    value={`${torrent.num_seeds} / ${torrent.num_complete}`} />
    <DetailRow label="Peers"    value={`${torrent.num_leechs} / ${torrent.num_incomplete}`} />
    <DetailRow label="Ratio"    value={torrent.ratio != null ? torrent.ratio.toFixed(2) : '—'} />
    <DetailRow label="Uploaded" value={formatSize(torrent.uploaded)} />
    {!!torrent.category && (
      <DetailRow label="Category" value={torrent.category} />
    )}
    {!!torrent.tags && (
      <DetailRow label="Tags" value={torrent.tags} />
    )}
    {!!torrent.tracker && (
      <DetailRow label="Tracker" value={torrent.tracker} truncate />
    )}
    <DetailRow
      label="Added"
      value={new Date(torrent.added_on * 1000).toLocaleDateString()}
    />
    <DetailRow label="Active" value={formatTime(torrent.time_active)} />
    {!!torrent.save_path && (
      <DetailRow label="Path" value={torrent.save_path} truncate />
    )}
  </View>
)}
```

Add to main `StyleSheet.create`:

```ts
detailGrid: {
  marginTop: spacing.sm,
  paddingTop: spacing.sm,
  borderTopWidth: StyleSheet.hairlineWidth,
  // borderTopColor applied inline — colors not available in StyleSheet.create
},
```

### Step 4 — Update `React.memo` comparator

```ts
export const TorrentCard = React.memo(TorrentCardInner, (prev, next) => {
  return (
    prev.torrent.hash === next.torrent.hash &&
    prev.torrent.state === next.torrent.state &&
    prev.torrent.progress === next.torrent.progress &&
    prev.torrent.dlspeed === next.torrent.dlspeed &&
    prev.torrent.upspeed === next.torrent.upspeed &&
    prev.torrent.name === next.torrent.name &&
    prev.torrent.num_seeds === next.torrent.num_seeds &&
    prev.torrent.num_leechs === next.torrent.num_leechs &&
    prev.torrent.ratio === next.torrent.ratio &&
    prev.onPress === next.onPress &&
    prev.onLongPress === next.onLongPress &&
    prev.onPauseResume === next.onPauseResume &&
    prev.compact === next.compact
  );
});
```

### Step 5 — Read `cardViewMode` in `app/(tabs)/index.tsx` and pass to card

```ts
// Add to component state (~line 59 alongside other useState)
const [cardViewMode, setCardViewMode] = useState<'compact' | 'expanded'>('compact');

// Add to the loadPreferences useEffect (~line 99)
setCardViewMode(prefs.cardViewMode ?? 'compact');
```

Pass to `TorrentCard` at render site (~line 1032):

```tsx
<TorrentCard
  torrent={item}
  onPress={...}
  onLongPress={...}
  onPauseResume={() => handleCardPauseResume(item)}
  compact={cardViewMode === 'compact'}
/>
```

**Files:** `components/TorrentCard.tsx`, `app/(tabs)/index.tsx`

-----

## Issue 6 — Search Bar Layout: Sort Left, Search Center, Add Right

### Root cause

Current `searchRow` child order: `[SearchInput flex:1]` → `[LoadingIndicator?]` → `[Sort]` → `[Add]`. The search input is `flex: 1` but it starts at the left edge and grows rightward, stopping where the trailing siblings begin. It is not centered — it is left-aligned and variable-width. The Sort button needs to move to index 0 in the row.

### Fix — reorder `searchRow` children in `app/(tabs)/index.tsx`

Replace the entire contents of `<View style={styles.searchRow}>` (~lines 636–705):

```tsx
<View style={styles.searchRow}>

  {/* LEFT: Sort button — fixed 42×42 */}
  {!selectMode && (
    <TouchableOpacity
      style={[
        styles.searchSortButton,
        {
          backgroundColor: showSortMenu ? colors.primaryOpac : colors.background,
          borderColor: colors.surfaceOutline,
        },
      ]}
      onPress={() => setShowSortMenu(!showSortMenu)}
      activeOpacity={0.7}
    >
      <Ionicons
        name="swap-vertical"
        size={18}
        color={showSortMenu ? colors.primary : colors.text}
      />
    </TouchableOpacity>
  )}

  {/* CENTER: Search input — flex:1, loading indicator inside */}
  <View
    style={[
      styles.searchInputContainer,
      {
        backgroundColor: colors.surface,
        borderWidth: 0.1,
        borderColor: colors.surfaceOutline,
      },
    ]}
  >
    <Ionicons
      name="search"
      size={18}
      color={colors.textSecondary}
      style={styles.searchIcon}
    />
    <TextInput
      style={[styles.searchInputCompact, { color: colors.text }]}
      placeholder={t('placeholders.searchTorrents')}
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholderTextColor={colors.textSecondary}
    />
    {isLoading && (
      <ActivityIndicator
        size="small"
        color={colors.primary}
        style={{ marginLeft: spacing.xs }}
      />
    )}
  </View>

  {/* RIGHT: Add torrent button — fixed 42×42 */}
  {!selectMode && (
    <TouchableOpacity
      style={[styles.headerAddButton, { backgroundColor: colors.primary }]}
      onPress={() => setShowAddModal(true)}
      activeOpacity={0.7}
    >
      <Ionicons name="add" size={20} color="#FFFFFF" />
    </TouchableOpacity>
  )}

</View>
```

### Style changes

```ts
// searchSortButton — match headerAddButton dimensions exactly
searchSortButton: {
  width: 42,
  height: 42,
  borderRadius: borderRadius.medium,
  borderWidth: 0.5,
  justifyContent: 'center',
  alignItems: 'center',
  ...shadows.small,
},

// Remove syncIndicator from StyleSheet.create entirely
```

The loading `ActivityIndicator` is now inside `searchInputContainer` as an inline sibling of the `TextInput` — both are `flex: 1` children of the input container, so the spinner appears at the right edge of the search box without affecting the 3-column row layout.

In `selectMode` (Sort and Add hidden), `searchInputContainer` with `flex: 1` expands to fill the full row — no additional handling needed.

**Files:** `app/(tabs)/index.tsx`

-----

## Implementation Order

1. **Issue 4** — `torrent-defaults.tsx` line 238, single `async`/`await` change
1. **Issue 6** — JSX reorder + style update, no logic change
1. **Issue 3** — Restructure `progressRow`, remove `progressText` style, fold into `statusLine`
1. **Issue 2** — New prop, new callback, comparator update
1. **Issue 5** — Largest diff: new `DetailRow` component, conditional render block, preference wire-up
1. **Issue 1** — Type extension, third parallel fetch in `TransferContext`, conditional display in `transfer.tsx`

-----

## Testing Checklist

> **Status:** Code implemented and compiles. All items below require **on-device testing** against a live qBittorrent server (cannot be verified in CI/cloud).

**Issue 4 — Pause-on-Add Sync:**
- [ ] On Settings screen open while connected: `pauseOnAdd` toggle reflects the server's actual `start_paused_enabled` value, not stale local cache
- [ ] Toggling "Pause on Add" writes to `app/setPreferences` on the server (`start_paused_enabled`); verify via qBittorrent Web UI
- [ ] Toggle off (server confirmed) → add torrent → starts active
- [ ] Toggle on (server confirmed) → add torrent → starts paused
- [ ] Server write failure rolls back the UI toggle

**Issue 1 — Alt Speed Limits:**
- [ ] Alt speed **on**: Download and Upload rows show alt values; `ALT` badge visible; rows non-tappable
- [ ] Alt speed **off**: rows show global limits; `ALT` badge absent; rows tappable

**Issue 3 — Progress Bar:**
- [ ] Progress bar spans full card width at all progress values including 100%
- [ ] Percent and ETA appear correctly in status line; no orphaned `progressText` rendered

**Issue 2 — Pause/Resume Button:**
- [ ] Pause button visible on far right of status row; correct icon per torrent state
- [ ] Tapping pause button does not trigger card `onPress` navigation

**Issue 6 — Search Bar Layout:**
- [ ] Search bar: Sort is leftmost, search is centered/flex, Add is rightmost
- [ ] Loading spinner appears inside search box right edge; no standalone sync indicator block visible
- [ ] `selectMode`: Sort and Add hidden; search bar expands to fill full row

**Issue 5 — Expanded Card View:**
- [ ] Compact card (`cardViewMode: 'compact'`): layout unchanged from pre-fix
- [ ] Detailed card (`cardViewMode: 'expanded'`): all 10 rows render; `category`/`tags`/`tracker`/`save_path` absent when empty string; `tracker` and `save_path` truncate with `ellipsizeMode="middle"`
