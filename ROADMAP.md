# qRemote — Gap Analysis & Implementation Roadmap

> Generated from a comparison of:
> - **Official qBittorrent WebUI API v5.0** (canonical spec)
> - **VueTorrent's full implementation** (reference 3rd-party client)
> - **qRemote's current codebase** (React Native / Expo)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [API Layer Gap Analysis](#2-api-layer-gap-analysis)
3. [UI / Feature Gap Analysis](#3-ui--feature-gap-analysis)
4. [Roadmap Phases](#4-roadmap-phases)
   - [Phase 1: Core Torrent UX Polish](#phase-1-core-torrent-ux-polish)
   - [Phase 2: Full Settings & Preferences](#phase-2-full-settings--preferences)
   - [Phase 3: RSS Manager](#phase-3-rss-manager)
   - [Phase 4: Search Engine](#phase-4-search-engine)
   - [Phase 5: Torrent Creator](#phase-5-torrent-creator)
   - [Phase 6: Advanced / Niche Features](#phase-6-advanced--niche-features)
5. [Data Models & Types to Add](#5-data-models--types-to-add)
6. [Enumeration Constants to Add](#6-enumeration-constants-to-add)

---

## 1. Executive Summary

### What qRemote already covers (API layer)

| API Group | Endpoints Implemented | Coverage |
|---|---|---|
| Auth | `login`, `logout` | **Complete** |
| Application | `version`, `webapiVersion`, `buildInfo`, `shutdown`, `preferences`, `setPreferences`, `defaultSavePath`, `cookies`, `setCookies` | ~75% |
| Log | `main`, `peers` | **Complete** |
| Sync | `maindata`, `torrentPeers` | **Complete** |
| Transfer | `info`, `speedLimitsMode`, `toggleSpeedLimitsMode`, `downloadLimit`, `setDownloadLimit`, `uploadLimit`, `setUploadLimit`, `banPeers` | **Complete** |
| Torrents | `info`, `properties`, `trackers`, `webseeds`, `files`, `pieceStates`, `pieceHashes`, `stop`, `start`, `delete`, `recheck`, `reannounce`, `add`, `addTrackers`, `editTracker`, `removeTrackers`, `addPeers`, `increasePrio`, `decreasePrio`, `topPrio`, `bottomPrio`, `filePrio`, `downloadLimit`, `setDownloadLimit`, `uploadLimit`, `setUploadLimit`, `setShareLimits`, `setLocation`, `rename`, `setCategory`, `createCategory`, `editCategory`, `removeCategories`, `addTags`, `removeTags`, `tags`, `createTags`, `deleteTags`, `setAutoManagement`, `toggleSequentialDownload`, `toggleFirstLastPiecePrio`, `setForceStart`, `setSuperSeeding`, `renameFile`, `renameFolder` | ~85% |
| RSS | *(none)* | **0%** |
| Search | *(none)* | **0%** |
| Torrent Creator | *(none)* | **0%** |

### What is completely missing

| Feature Area | Endpoints Missing | UI Missing |
|---|---|---|
| **RSS Manager** | 12 endpoints | Entire feature (feeds, rules, articles) |
| **Search Engine** | 10 endpoints | Entire feature (search, plugins) |
| **Torrent Creator** | 4 endpoints (qBittorrent 5.0+) | Entire feature |
| **Torrent Export** | `GET /torrents/export` | Download .torrent button |
| **Server File Browser** | `POST /app/getDirectoryContent` | Path picker dialog |
| **Network Interface Config** | `GET /app/networkInterfaceList`, `GET /app/networkInterfaceAddressList` | Settings UI |
| **Test Email** | `POST /app/sendTestEmail` | Settings button |
| **SSL Parameters** | `GET /torrents/SSLParameters`, `POST /torrents/setSSLParameters` | Torrent detail panel |
| **Torrent Count** | `GET /torrents/count` | Status bar / info |
| **Set Save/Download Path** | `POST /torrents/setSavePath`, `POST /torrents/setDownloadPath` | Torrent detail panel |
| **RSS Folder Management** | `POST /rss/addFolder` | RSS UI |
| **Set Feed URL** | `POST /rss/setFeedURL` | RSS UI |
| **Full Preferences UI** | Preferences API exists, UI is limited | Many settings panels |

---

## 2. API Layer Gap Analysis

Below is every endpoint from the official spec and VueTorrent reference, grouped by module. Endpoints marked **HAVE** are already in the codebase. Endpoints marked **MISSING** need to be added.

### 2.1 Authentication — `/api/v2/auth/`

| Endpoint | Method | Status |
|---|---|---|
| `auth/login` | POST | **HAVE** |
| `auth/logout` | POST | **HAVE** |

### 2.2 Application — `/api/v2/app/`

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `app/version` | GET | **HAVE** | |
| `app/webapiVersion` | GET | **HAVE** | |
| `app/buildInfo` | GET | **HAVE** | |
| `app/shutdown` | POST | **HAVE** | |
| `app/preferences` | GET | **HAVE** | |
| `app/setPreferences` | POST | **HAVE** | |
| `app/defaultSavePath` | GET | **HAVE** | |
| `app/cookies` | GET | **HAVE** | |
| `app/setCookies` | POST | **HAVE** | |
| `app/networkInterfaceList` | GET | **MISSING** | Used by VueTorrent in Settings > Advanced for NIC selection |
| `app/networkInterfaceAddressList` | GET | **MISSING** | Param: `iface`. Returns IP addresses bound to interface |
| `app/sendTestEmail` | POST | **MISSING** | Used by VueTorrent in Settings > Email Notifications |
| `app/getDirectoryContent` | POST | **MISSING** | Used by VueTorrent for server-side file/path browser. Params: `dirPath`, `mode` (all/files/dirs) |

### 2.3 Log — `/api/v2/log/`

| Endpoint | Method | Status |
|---|---|---|
| `log/main` | GET | **HAVE** |
| `log/peers` | GET | **HAVE** |

### 2.4 Sync — `/api/v2/sync/`

| Endpoint | Method | Status |
|---|---|---|
| `sync/maindata` | GET | **HAVE** |
| `sync/torrentPeers` | GET | **HAVE** |

### 2.5 Transfer — `/api/v2/transfer/`

| Endpoint | Method | Status |
|---|---|---|
| `transfer/info` | GET | **HAVE** |
| `transfer/speedLimitsMode` | GET | **HAVE** |
| `transfer/toggleSpeedLimitsMode` | POST | **HAVE** |
| `transfer/downloadLimit` | GET | **HAVE** |
| `transfer/setDownloadLimit` | POST | **HAVE** |
| `transfer/uploadLimit` | GET | **HAVE** |
| `transfer/setUploadLimit` | POST | **HAVE** |
| `transfer/banPeers` | POST | **HAVE** |

### 2.6 Torrents — `/api/v2/torrents/`

| Endpoint | Method | Status | Notes |
|---|---|---|---|
| `torrents/info` | GET | **HAVE** | |
| `torrents/properties` | GET | **HAVE** | |
| `torrents/trackers` | GET | **HAVE** | |
| `torrents/webseeds` | GET | **HAVE** | |
| `torrents/files` | GET | **HAVE** | |
| `torrents/pieceStates` | GET | **HAVE** | |
| `torrents/pieceHashes` | GET | **HAVE** | |
| `torrents/stop` | POST | **HAVE** | |
| `torrents/start` | POST | **HAVE** | |
| `torrents/delete` | POST | **HAVE** | |
| `torrents/recheck` | POST | **HAVE** | |
| `torrents/reannounce` | POST | **HAVE** | |
| `torrents/add` | POST | **HAVE** | |
| `torrents/addTrackers` | POST | **HAVE** | |
| `torrents/editTracker` | POST | **HAVE** | |
| `torrents/removeTrackers` | POST | **HAVE** | |
| `torrents/addPeers` | POST | **HAVE** | |
| `torrents/increasePrio` | POST | **HAVE** | |
| `torrents/decreasePrio` | POST | **HAVE** | |
| `torrents/topPrio` | POST | **HAVE** | |
| `torrents/bottomPrio` | POST | **HAVE** | |
| `torrents/filePrio` | POST | **HAVE** | |
| `torrents/downloadLimit` | POST | **HAVE** | |
| `torrents/setDownloadLimit` | POST | **HAVE** | |
| `torrents/uploadLimit` | POST | **HAVE** | |
| `torrents/setUploadLimit` | POST | **HAVE** | |
| `torrents/setShareLimits` | POST | **HAVE** | |
| `torrents/setLocation` | POST | **HAVE** | |
| `torrents/rename` | POST | **HAVE** | |
| `torrents/setCategory` | POST | **HAVE** | |
| `torrents/categories` | GET | **HAVE** | |
| `torrents/createCategory` | POST | **HAVE** | |
| `torrents/editCategory` | POST | **HAVE** | |
| `torrents/removeCategories` | POST | **HAVE** | |
| `torrents/addTags` | POST | **HAVE** | |
| `torrents/removeTags` | POST | **HAVE** | |
| `torrents/tags` | GET | **HAVE** | |
| `torrents/createTags` | POST | **HAVE** | |
| `torrents/deleteTags` | POST | **HAVE** | |
| `torrents/setAutoManagement` | POST | **HAVE** | |
| `torrents/toggleSequentialDownload` | POST | **HAVE** | |
| `torrents/toggleFirstLastPiecePrio` | POST | **HAVE** | |
| `torrents/setForceStart` | POST | **HAVE** | |
| `torrents/setSuperSeeding` | POST | **HAVE** | |
| `torrents/renameFile` | POST | **HAVE** | |
| `torrents/renameFolder` | POST | **HAVE** | |
| `torrents/export` | GET | **MISSING** | Download .torrent file as blob. Param: `hash` |
| `torrents/count` | GET | **MISSING** | Returns total torrent count (simple integer). qBittorrent 5.0+ |
| `torrents/SSLParameters` | GET | **MISSING** | Param: `hash`. Returns `{ ssl_certificate, ssl_private_key, ssl_dh_params }` |
| `torrents/setSSLParameters` | POST | **MISSING** | Params: `hash`, `ssl_certificate`, `ssl_private_key`, `ssl_dh_params` |
| `torrents/setSavePath` | POST | **MISSING** | Params: `id` (pipe-delimited hashes), `path`. qBittorrent 5.0+ |
| `torrents/setDownloadPath` | POST | **MISSING** | Params: `id` (pipe-delimited hashes), `path`. qBittorrent 5.0+ |

> Note: `setLocation` (which qRemote has) is the older equivalent of `setSavePath`. Both are valid; `setSavePath`/`setDownloadPath` are the newer split versions.

### 2.7 RSS — `/api/v2/rss/` (ENTIRELY MISSING)

| Endpoint | Method | Notes |
|---|---|---|
| `rss/addFolder` | POST | Param: `path`. Creates a folder in the RSS tree |
| `rss/addFeed` | POST | Params: `url`, `path` (optional). Subscribe to an RSS feed |
| `rss/removeItem` | POST | Param: `path`. Removes a feed or folder |
| `rss/moveItem` | POST | Params: `itemPath`, `destPath`. Rename/move feed or folder |
| `rss/items` | GET | Param: `withData` (bool). Returns all feeds (optionally with articles) |
| `rss/markAsRead` | POST | Params: `itemPath`, `articleId` (optional). Mark feed/article as read |
| `rss/refreshItem` | POST | Param: `itemPath`. Force-refresh a feed |
| `rss/setRule` | POST | Params: `ruleName`, `ruleDef` (JSON string). Create/update auto-download rule |
| `rss/renameRule` | POST | Params: `ruleName`, `newRuleName` |
| `rss/removeRule` | POST | Param: `ruleName` |
| `rss/rules` | GET | Returns all auto-download rules as JSON object |
| `rss/matchingArticles` | GET | Param: `ruleName`. Returns matching article titles grouped by feed |
| `rss/setFeedURL` | POST | Params: `path`, `url`. Change a feed's URL (qBittorrent 4.6+) |

### 2.8 Search — `/api/v2/search/` (ENTIRELY MISSING)

| Endpoint | Method | Notes |
|---|---|---|
| `search/start` | POST | Params: `pattern`, `plugins` (pipe-delimited), `category`. Returns `{ id }` |
| `search/stop` | POST | Param: `id` |
| `search/status` | POST | Param: `id` (optional; 0 = all jobs). Returns array of `{ id, status, total }` |
| `search/results` | POST | Params: `id`, `limit`, `offset`. Returns `{ results[], status, total }` |
| `search/delete` | POST | Param: `id` |
| `search/plugins` | GET | Returns array of installed search plugins |
| `search/installPlugin` | POST | Param: `sources` (pipe-delimited URLs/paths) |
| `search/uninstallPlugin` | POST | Param: `names` (pipe-delimited) |
| `search/enablePlugin` | POST | Params: `names` (pipe-delimited), `enable` (bool) |
| `search/updatePlugins` | POST | No params. Updates all plugins |

### 2.9 Torrent Creator — `/api/v2/torrentcreator/` (ENTIRELY MISSING, qBittorrent 5.0+)

VueTorrent supports this but it's not in the core official API wiki (it's a newer addition). Included here because it's part of the 5.0 API surface.

| Endpoint | Method | Notes |
|---|---|---|
| `torrentcreator/addTask` | POST | Params: `sourcePath`, `torrentFilePath`, `format`, `comment`, `private`, `pieceSize`, `trackers`, `urlSeeds`, etc. Returns `{ taskID }` |
| `torrentcreator/status` | GET | Param: `taskID` (optional). Returns task status array |
| `torrentcreator/torrentFile` | GET | Param: `taskID`. Downloads created .torrent file |
| `torrentcreator/deleteTask` | POST | Param: `taskID` |

---

## 3. UI / Feature Gap Analysis

What VueTorrent has in its UI that qRemote is missing or only partially implements:

### 3.1 Add Torrent Dialog — Partial

qRemote can add by URL/magnet and file upload. However, the following add-torrent options are either missing or not exposed in the UI:

| Option | Field Name | Status |
|---|---|---|
| Save path override | `savepath` | Needs file browser (`getDirectoryContent`) |
| Download path override | `downloadPath` | Needs file browser |
| Use download path toggle | `useDownloadPath` | Missing |
| Category picker | `category` | May be partial |
| Tags input | `tags` | May be partial |
| Rename torrent | `rename` | Missing from add dialog |
| Automatic Torrent Management | `autoTMM` | Missing from add dialog |
| Content layout | `contentLayout` | Missing (`Original`/`Subfolder`/`NoSubfolder`) |
| Add stopped | `stopped` | Missing |
| Stop condition | `stopCondition` | Missing (`None`/`MetadataReceived`/`FilesChecked`) |
| Skip hash check | `skip_checking` | Missing |
| Sequential download | `sequentialDownload` | Missing |
| First/last piece priority | `firstLastPiecePrio` | Missing |
| Add to top of queue | `addToTopOfQueue` | Missing |
| Ratio limit | `ratioLimit` | Missing |
| Seeding time limit | `seedingTimeLimit` | Missing |
| Inactive seeding time limit | `inactiveSeedingTimeLimit` | Missing |
| Share limit action | `shareLimitAction` | Missing |
| Download speed limit | `dlLimit` | Missing |
| Upload speed limit | `upLimit` | Missing |
| SSL certificate | `ssl_certificate` | Missing |
| SSL private key | `ssl_private_key` | Missing |
| SSL DH params | `ssl_dh_params` | Missing |

### 3.2 Torrent Detail View — Partial

qRemote shows torrent properties, files, trackers, and peers. Missing features:

| Feature | Status |
|---|---|
| Export .torrent file | Missing (needs `GET /torrents/export`) |
| Piece map visualization | API call exists (`pieceStates`), verify UI renders it |
| SSL parameters view/edit | Missing |
| Set save path (new 5.0 endpoint) | Missing |
| Set download path (new 5.0 endpoint) | Missing |

### 3.3 Settings / Preferences — Significant Gaps

qRemote has a Settings screen but it primarily manages app-local settings (servers, theme, language). The full qBittorrent preferences panel is not exposed. VueTorrent breaks this into 8+ panels:

| Settings Panel | Coverage in qRemote |
|---|---|
| **Downloads** (save paths, ATM, content layout, file exclusions, watched folders) | Not exposed |
| **Connection** (listen port, UPnP, connection limits, protocol) | Not exposed |
| **Speed** (global/alt limits, speed scheduler) | Partial (global limits via Transfer screen) |
| **BitTorrent** (DHT, PeX, LSD, encryption, seeding limits, queueing) | Not exposed |
| **RSS** (feed settings, auto-download) | Not exposed |
| **Web UI** (port, auth, HTTPS, reverse proxy, DDNS) | Not exposed |
| **Advanced** (disk I/O, threading, memory, resume data, logging) | Not exposed |
| **Email Notifications** | Not exposed |
| **Proxy** | Not exposed |
| **IP Filter** | Not exposed |

### 3.4 RSS Manager — Completely Missing

No RSS UI exists. VueTorrent has:
- Feed list with add/rename/delete/refresh
- Article viewer with read/unread state
- Auto-download rule editor (pattern matching, episode filters, smart filters)
- Rule testing (matching articles preview)

### 3.5 Search — Completely Missing

No search UI exists. VueTorrent has:
- Search input with plugin/category selectors
- Results table with seeder/leecher counts
- Download-from-search functionality
- Plugin manager (install/uninstall/enable/update)

### 3.6 Torrent Creator — Completely Missing

No torrent creation UI. VueTorrent has:
- Source path browser
- Tracker/web seed input
- Format selector (v1/v2/hybrid)
- Progress monitoring
- Download created .torrent

### 3.7 Cookies Manager — Possibly Missing from UI

API calls exist (`app/cookies`, `app/setCookies`) but verify whether a management UI exists.

### 3.8 Server File Browser — Missing

VueTorrent uses `POST /app/getDirectoryContent` to let users browse the server filesystem when picking save paths. qRemote requires manual path entry.

---

## 4. Roadmap Phases

Each phase is self-contained and can be implemented independently. Phases are ordered by user impact and dependency.

---

### Phase 1: Core Torrent UX Polish

**Goal:** Make the existing torrent management experience feature-complete compared to VueTorrent's dashboard.

**Priority:** HIGH | **Estimated scope:** Medium

#### Task 1.1 — Enhanced Add Torrent Dialog

**Files to modify:** `app/torrent/add.tsx`, `services/api/torrents.ts`, `types/`

The current add-torrent screen only supports URL/magnet input. Expand it to match the full `AddTorrentPayload`:

1. Add a "Save Path" text input field (manual entry for now; file browser comes in Phase 6)
2. Add a "Category" dropdown, populated from `GET /torrents/categories`
3. Add a "Tags" multi-select or comma-separated input, populated from `GET /torrents/tags`
4. Add a "Rename" text input
5. Add toggle switches for:
   - `stopped` — "Add in stopped state"
   - `skip_checking` — "Skip hash check"
   - `sequentialDownload` — "Sequential download"
   - `firstLastPiecePrio` — "Prioritize first/last pieces"
   - `autoTMM` — "Automatic Torrent Management"
   - `addToTopOfQueue` — "Add to top of queue"
6. Add a `contentLayout` picker: Original / Subfolder / No Subfolder
7. Add a `stopCondition` picker: None / Metadata Received / Files Checked
8. Add optional speed limit fields: `dlLimit`, `upLimit` (bytes/sec inputs)
9. Add optional share limit fields: `ratioLimit`, `seedingTimeLimit`, `inactiveSeedingTimeLimit`
10. Update the `POST /torrents/add` call to include all new fields in the FormData payload

**API details from spec:**
- POST body is `multipart/form-data` when uploading .torrent files, `application/x-www-form-urlencoded` for URL/magnet
- Boolean fields are sent as string `"true"` / `"false"`
- `urls` field is newline-delimited
- `tags` field is comma-delimited

#### Task 1.2 — Torrent Export

**Files to create/modify:** `services/api/torrents.ts`, torrent detail screen

1. Add API function: `GET /api/v2/torrents/export?hash={hash}`
   - Response is binary blob (`application/x-bittorrent`)
   - Use `responseType: 'blob'` in axios
2. Add "Export .torrent" button to the torrent detail screen
3. Use Expo FileSystem / Sharing to save or share the downloaded file

#### Task 1.3 — Torrent Count Endpoint

**Files to modify:** `services/api/torrents.ts`

1. Add API function: `GET /api/v2/torrents/count`
   - Response: plain number
2. Optionally display in the status bar or torrent list header

#### Task 1.4 — Set Save Path / Download Path (5.0+ endpoints)

**Files to modify:** `services/api/torrents.ts`, torrent detail screen

1. Add API functions:
   - `POST /api/v2/torrents/setSavePath` — body: `id` (pipe-delimited hashes), `path`
   - `POST /api/v2/torrents/setDownloadPath` — body: `id` (pipe-delimited hashes), `path`
2. Add UI controls in the torrent detail view to change save/download paths
3. These are the newer 5.0 replacements for `setLocation`; keep both for backward compatibility

---

### Phase 2: Full Settings & Preferences

**Goal:** Expose the full qBittorrent preferences through the app's Settings screen so users can configure their server without needing the desktop client.

**Priority:** HIGH | **Estimated scope:** Large

#### Task 2.1 — Downloads Settings Panel

**New screen/section:** `app/settings/downloads.tsx`

Expose these preference fields via `GET /app/preferences` and `POST /app/setPreferences`:

| Field | Type | UI Control |
|---|---|---|
| `save_path` | string | Text input |
| `temp_path_enabled` | bool | Toggle |
| `temp_path` | string | Text input (shown when enabled) |
| `export_dir` | string | Text input |
| `export_dir_fin` | string | Text input |
| `auto_delete_mode` | int | Picker (0=Never, 1=If Added, 2=Always) |
| `preallocate_all` | bool | Toggle |
| `incomplete_files_ext` | bool | Toggle |
| `auto_tmm_enabled` | bool | Toggle |
| `torrent_changed_tmm_enabled` | bool | Toggle |
| `save_path_changed_tmm_enabled` | bool | Toggle |
| `category_changed_tmm_enabled` | bool | Toggle |
| `torrent_content_layout` | string | Picker (Original/Subfolder/NoSubfolder) |
| `add_trackers_enabled` | bool | Toggle |
| `add_trackers` | string | Multi-line text input |
| `scan_dirs` | object | Key-value editor (path -> 0/1/string) |
| `excluded_file_names_enabled` | bool | Toggle |
| `excluded_file_names` | string | Multi-line text input (glob patterns) |

**How preferences work:**
- Read all with `GET /api/v2/app/preferences` (returns full JSON object)
- Write changed fields only with `POST /api/v2/app/setPreferences` — body is `json=JSON.stringify(partialPrefsObject)`
- Only send fields that the user actually changed

#### Task 2.2 — Connection Settings Panel

**New screen/section:** `app/settings/connection.tsx`

| Field | Type | UI Control |
|---|---|---|
| `listen_port` | int | Number input |
| `random_port` | bool | Toggle |
| `upnp` | bool | Toggle |
| `max_connec` | int | Number input |
| `max_connec_per_torrent` | int | Number input |
| `max_uploads` | int | Number input |
| `max_uploads_per_torrent` | int | Number input |
| `outgoing_ports_min` | int | Number input |
| `outgoing_ports_max` | int | Number input |
| `enable_multi_connections_from_same_ip` | bool | Toggle |

#### Task 2.3 — Speed Settings Panel

**New screen/section:** `app/settings/speed.tsx`

| Field | Type | UI Control |
|---|---|---|
| `dl_limit` | int | Number input (KiB/s; -1 = unlimited) |
| `up_limit` | int | Number input (KiB/s; 0 = unlimited) |
| `alt_dl_limit` | int | Number input |
| `alt_up_limit` | int | Number input |
| `bittorrent_protocol` | int | Picker (0=TCP+uTP, 1=TCP, 2=uTP) |
| `limit_utp_rate` | bool | Toggle |
| `limit_tcp_overhead` | bool | Toggle |
| `limit_lan_peers` | bool | Toggle |
| `scheduler_enabled` | bool | Toggle |
| `schedule_from_hour` / `_min` | int | Time picker |
| `schedule_to_hour` / `_min` | int | Time picker |
| `scheduler_days` | int | Picker (0=Every day ... 9=Every Sunday) |

#### Task 2.4 — BitTorrent Settings Panel

**New screen/section:** `app/settings/bittorrent.tsx`

| Field | Type | UI Control |
|---|---|---|
| `dht` | bool | Toggle |
| `pex` | bool | Toggle |
| `lsd` | bool | Toggle |
| `encryption` | int | Picker (0=Prefer, 1=Force On, 2=Force Off) |
| `anonymous_mode` | bool | Toggle |
| `max_ratio_enabled` | bool | Toggle |
| `max_ratio` | float | Number input |
| `max_ratio_act` | int | Picker (0=Pause, 1=Remove) |
| `max_seeding_time_enabled` | bool | Toggle |
| `max_seeding_time` | int | Number input (minutes) |
| `queueing_enabled` | bool | Toggle |
| `max_active_downloads` | int | Number input |
| `max_active_torrents` | int | Number input |
| `max_active_uploads` | int | Number input |
| `dont_count_slow_torrents` | bool | Toggle |
| `slow_torrent_dl_rate_threshold` | int | Number input (KiB/s) |
| `slow_torrent_ul_rate_threshold` | int | Number input (KiB/s) |
| `slow_torrent_inactive_timer` | int | Number input (seconds) |

#### Task 2.5 — Web UI Settings Panel

**New screen/section:** `app/settings/webui.tsx`

| Field | Type | UI Control |
|---|---|---|
| `web_ui_address` | string | Text input |
| `web_ui_port` | int | Number input |
| `web_ui_upnp` | bool | Toggle |
| `web_ui_username` | string | Text input |
| `web_ui_password` | string | Password input (write-only) |
| `bypass_local_auth` | bool | Toggle |
| `bypass_auth_subnet_whitelist_enabled` | bool | Toggle |
| `bypass_auth_subnet_whitelist` | string | Text input (comma-delimited subnets) |
| `web_ui_max_auth_fail_count` | int | Number input |
| `web_ui_ban_duration` | int | Number input (seconds) |
| `web_ui_session_timeout` | int | Number input (seconds) |
| `use_https` | bool | Toggle |
| `web_ui_https_cert_path` | string | Text input |
| `web_ui_https_key_path` | string | Text input |
| `web_ui_csrf_protection_enabled` | bool | Toggle |
| `web_ui_clickjacking_protection_enabled` | bool | Toggle |
| `web_ui_secure_cookie_enabled` | bool | Toggle |
| `web_ui_host_header_validation_enabled` | bool | Toggle |
| `web_ui_domain_list` | string | Text input |
| `web_ui_use_custom_http_headers_enabled` | bool | Toggle |
| `web_ui_custom_http_headers` | string | Multi-line text input |
| `dyndns_enabled` | bool | Toggle |
| `dyndns_service` | int | Picker (0=DynDNS, 1=No-IP) |
| `dyndns_domain` | string | Text input |
| `dyndns_username` | string | Text input |
| `dyndns_password` | string | Password input |

#### Task 2.6 — Proxy Settings Panel

**New screen/section:** `app/settings/proxy.tsx`

| Field | Type | UI Control |
|---|---|---|
| `proxy_type` | int | Picker (-1=None, 1=HTTP, 2=SOCKS5, 3=HTTP+auth, 4=SOCKS5+auth, 5=SOCKS4) |
| `proxy_ip` | string | Text input |
| `proxy_port` | int | Number input |
| `proxy_auth_enabled` | bool | Toggle |
| `proxy_username` | string | Text input |
| `proxy_password` | string | Password input |
| `proxy_peer_connections` | bool | Toggle |
| `proxy_torrents_only` | bool | Toggle |

#### Task 2.7 — Email Notification Settings

**New screen/section:** `app/settings/email.tsx`

Add `sendTestEmail` API call: `POST /api/v2/app/sendTestEmail` (empty body).

| Field | Type | UI Control |
|---|---|---|
| `mail_notification_enabled` | bool | Toggle |
| `mail_notification_sender` | string | Text input |
| `mail_notification_email` | string | Text input |
| `mail_notification_smtp` | string | Text input |
| `mail_notification_ssl_enabled` | bool | Toggle |
| `mail_notification_auth_enabled` | bool | Toggle |
| `mail_notification_username` | string | Text input |
| `mail_notification_password` | string | Password input |
| "Send Test Email" | button | Calls `POST /app/sendTestEmail` |

#### Task 2.8 — Advanced Settings Panel

**New screen/section:** `app/settings/advanced.tsx`

| Field | Type | UI Control |
|---|---|---|
| `async_io_threads` | int | Number input |
| `file_pool_size` | int | Number input |
| `checking_memory_use` | int | Number input (MiB) |
| `disk_cache` | int | Number input (MiB; -1 = auto) |
| `disk_cache_ttl` | int | Number input (seconds) |
| `enable_os_cache` | bool | Toggle |
| `enable_coalesce_read_write` | bool | Toggle |
| `enable_piece_extent_affinity` | bool | Toggle |
| `enable_upload_suggestions` | bool | Toggle |
| `send_buffer_watermark` | int | Number input (KiB) |
| `send_buffer_low_watermark` | int | Number input (KiB) |
| `send_buffer_watermark_factor` | int | Number input (%) |
| `socket_backlog_size` | int | Number input |
| `upload_choking_algorithm` | int | Picker (0=Round-robin, 1=Fastest, 2=Anti-leech) |
| `upload_slots_behavior` | int | Picker (0=Fixed, 1=Rate-based) |
| `utp_tcp_mixed_mode` | int | Picker (0=Prefer TCP, 1=Peer proportional) |
| `save_resume_data_interval` | int | Number input (minutes) |
| `recheck_completed_torrents` | bool | Toggle |
| `resolve_peer_countries` | bool | Toggle |
| `embedded_tracker_port` | int | Number input |
| `enable_embedded_tracker` | bool | Toggle |
| `enable_multi_connections_from_same_ip` | bool | Toggle |
| `ip_filter_enabled` | bool | Toggle |
| `ip_filter_path` | string | Text input |
| `ip_filter_trackers` | bool | Toggle |
| `banned_IPs` | string | Multi-line text input |
| `current_network_interface` | string | See Task 2.9 |
| `current_interface_address` | string | See Task 2.9 |

#### Task 2.9 — Network Interface Selector

**Files to modify:** `services/api/application.ts`, Advanced Settings panel

1. Add API function: `GET /api/v2/app/networkInterfaceList`
   - Returns array of `{ name: string, value: string }`
2. Add API function: `GET /api/v2/app/networkInterfaceAddressList?iface={value}`
   - Returns array of IP address strings
3. In the Advanced Settings panel, use these to populate dropdown pickers for `current_network_interface` and `current_interface_address`

---

### Phase 3: RSS Manager

**Goal:** Full RSS feed and auto-download rule management.

**Priority:** MEDIUM | **Estimated scope:** Large

#### Task 3.1 — RSS API Service

**New file:** `services/api/rss.ts`

Implement all 13 RSS endpoints:

```
POST /rss/addFolder       — { path }
POST /rss/addFeed         — { url, path? }
POST /rss/removeItem      — { path }
POST /rss/moveItem        — { itemPath, destPath }
GET  /rss/items           — ?withData=true/false
POST /rss/markAsRead      — { itemPath, articleId? }
POST /rss/refreshItem     — { itemPath }
POST /rss/setRule         — { ruleName, ruleDef: JSON.stringify(FeedRule) }
POST /rss/renameRule      — { ruleName, newRuleName }
POST /rss/removeRule      — { ruleName }
GET  /rss/rules           — (no params)
GET  /rss/matchingArticles — ?ruleName={name}
POST /rss/setFeedURL      — { path, url }  (qBittorrent 4.6+)
```

All POST bodies use `application/x-www-form-urlencoded`.

The `ruleDef` parameter is a JSON-stringified object with these fields:
- `enabled` (bool), `mustContain` (string), `mustNotContain` (string), `useRegex` (bool)
- `episodeFilter` (string), `smartFilter` (bool), `previouslyMatchedEpisodes` (string[])
- `affectedFeeds` (string[]), `ignoreDays` (number), `lastMatch` (string)
- `addPaused` (bool), `assignedCategory` (string), `savePath` (string)

#### Task 3.2 — RSS Types

**New file or extend:** `types/rss.ts`

```typescript
interface Feed {
  name: string;
  uid: string;
  url: string;
  title?: string;
  lastBuildDate?: string;
  isLoading?: boolean;
  hasError?: boolean;
  articles?: FeedArticle[];
}

interface FeedArticle {
  id: string;
  title: string;
  description?: string;
  torrentURL?: string;
  link?: string;
  date: string;
  isRead?: boolean;
}

interface FeedRule {
  enabled: boolean;
  mustContain: string;
  mustNotContain: string;
  useRegex: boolean;
  episodeFilter: string;
  smartFilter: boolean;
  previouslyMatchedEpisodes: string[];
  affectedFeeds: string[];
  ignoreDays: number;
  lastMatch: string;
  addPaused: boolean;
  assignedCategory: string;
  savePath: string;
}
```

#### Task 3.3 — RSS Feed List Screen

**New screen:** `app/(tabs)/rss.tsx` or `app/rss/index.tsx`

Features:
1. List all feeds from `GET /rss/items?withData=false`
   - The response is a flat or nested object keyed by feed name; convert to array
2. "Add Feed" button -> dialog with URL + optional path inputs -> `POST /rss/addFeed`
3. "Add Folder" button -> dialog with path input -> `POST /rss/addFolder`
4. Swipe-to-delete on feed -> `POST /rss/removeItem`
5. Long-press to rename -> `POST /rss/moveItem`
6. Pull-to-refresh individual feed -> `POST /rss/refreshItem`
7. Change feed URL -> `POST /rss/setFeedURL` (qBittorrent 4.6+)

#### Task 3.4 — RSS Article Viewer

**New screen:** `app/rss/[feedName].tsx`

Features:
1. Fetch articles: `GET /rss/items?withData=true`, filter to selected feed
2. Display article list with title, date, read/unread status
3. Mark as read: `POST /rss/markAsRead` with `itemPath` and `articleId`
4. Mark entire feed as read: `POST /rss/markAsRead` with `itemPath` only (omit `articleId`)
5. Tap article to open torrent URL or add torrent

#### Task 3.5 — RSS Auto-Download Rules Screen

**New screen:** `app/rss/rules.tsx`

Features:
1. List all rules from `GET /rss/rules` (response is object keyed by rule name; convert to array)
2. "Add Rule" button -> rule editor
3. Rule editor fields:
   - `enabled` toggle
   - `mustContain` text input
   - `mustNotContain` text input
   - `useRegex` toggle
   - `episodeFilter` text input
   - `smartFilter` toggle
   - `affectedFeeds` multi-select (from feed list)
   - `ignoreDays` number input
   - `addPaused` toggle
   - `assignedCategory` picker (from categories)
   - `savePath` text input
4. Save rule: `POST /rss/setRule` with `ruleName` and `ruleDef=JSON.stringify(rule)`
5. Rename rule: `POST /rss/renameRule`
6. Delete rule: `POST /rss/removeRule`
7. "Test Rule" button: `GET /rss/matchingArticles?ruleName=X` -> show matched article titles

---

### Phase 4: Search Engine

**Goal:** Search for torrents across multiple search plugins from within the app.

**Priority:** MEDIUM | **Estimated scope:** Medium

#### Task 4.1 — Search API Service

**New file:** `services/api/search.ts`

Implement all 10 search endpoints:

```
POST /search/start           — { pattern, plugins, category } -> { id }
POST /search/stop            — { id }
POST /search/status          — { id? } -> [{ id, status, total }]
POST /search/results         — { id, limit?, offset? } -> { results[], status, total }
POST /search/delete          — { id }
GET  /search/plugins         — -> SearchPlugin[]
POST /search/installPlugin   — { sources }  (pipe-delimited URLs)
POST /search/uninstallPlugin — { names }  (pipe-delimited)
POST /search/enablePlugin    — { names, enable }
POST /search/updatePlugins   — (empty body)
```

#### Task 4.2 — Search Types

**New file or extend:** `types/search.ts`

```typescript
interface SearchResult {
  descrLink: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbLeechers: number;
  nbSeeders: number;
  siteUrl: string;
}

interface SearchPlugin {
  enabled: boolean;
  fullName: string;
  name: string;
  supportedCategories: { id: string; name: string }[];
  url: string;
  version: string;
}

interface SearchStatus {
  id: number;
  status: 'Running' | 'Stopped';
  total: number;
}
```

#### Task 4.3 — Search Screen

**New screen:** `app/(tabs)/search.tsx` or `app/search/index.tsx`

Features:
1. Search bar with text input for `pattern`
2. Plugin selector: fetch from `GET /search/plugins`, show as multi-select or "all"/"enabled"
3. Category selector: derived from selected plugins' `supportedCategories`
4. "Search" button: `POST /search/start` -> get job `id`
5. Poll results: `POST /search/results` with the job `id`, `limit=50`, incrementing `offset`
6. Display results in a FlatList with columns: fileName, fileSize, nbSeeders, nbLeechers, siteUrl
7. Tap result to add torrent: navigate to Add Torrent screen with `fileUrl` pre-filled, OR directly call `POST /torrents/add` with `urls=fileUrl`
8. "Stop" button: `POST /search/stop`
9. Clean up on leave: `POST /search/delete`
10. Show search status (Running/Stopped, result count) in header

#### Task 4.4 — Search Plugin Manager

**New screen:** `app/search/plugins.tsx`

Features:
1. List all plugins from `GET /search/plugins`
2. Toggle enable/disable: `POST /search/enablePlugin` with `names` and `enable`
3. "Install Plugin" button -> text input for URL -> `POST /search/installPlugin`
4. "Uninstall" option on each plugin -> `POST /search/uninstallPlugin`
5. "Update All" button -> `POST /search/updatePlugins`

---

### Phase 5: Torrent Creator

**Goal:** Allow users to create .torrent files from server-side content.

**Priority:** LOW | **Estimated scope:** Small-Medium

> Note: This feature requires qBittorrent 5.0+. The API endpoints are under `/api/v2/torrentcreator/`.

#### Task 5.1 — Torrent Creator API Service

**New file:** `services/api/torrentcreator.ts`

```
POST /torrentcreator/addTask      — { sourcePath, torrentFilePath?, format?, comment?,
                                       private?, pieceSize?, trackers?, urlSeeds?, source? }
                                    -> { taskID }
GET  /torrentcreator/status       — ?taskID={id} (optional) -> TorrentCreatorTask[]
GET  /torrentcreator/torrentFile  — ?taskID={id} -> binary blob
POST /torrentcreator/deleteTask   — { taskID }
```

Params for `addTask`:
- `sourcePath` (string, required): absolute server path
- `torrentFilePath` (string): output path (empty = in-memory)
- `format` (string): `v1`, `v2`, or `hybrid` (default: `hybrid`)
- `comment` (string)
- `private` (bool, default false)
- `pieceSize` (number, 0 = auto)
- `trackers` (string, pipe-delimited)
- `urlSeeds` (string, pipe-delimited)
- `source` (string, for private trackers, qBittorrent 5.1+)

#### Task 5.2 — Torrent Creator Types

```typescript
type TorrentFormat = 'v1' | 'v2' | 'hybrid';
type TorrentCreatorTaskStatus = 'Queued' | 'Running' | 'Finished' | 'Failed';

interface TorrentCreatorTask {
  taskID: string;
  status: TorrentCreatorTaskStatus;
  progress: number;
  errorMessage?: string;
  sourcePath: string;
  torrentFilePath: string;
  comment: string;
  format: TorrentFormat;
  private: boolean;
  pieceSize: number;
  trackers: string[];
  urlSeeds: string[];
  timeAdded: string;
  timeStarted: string;
  timeFinished: string;
}
```

#### Task 5.3 — Torrent Creator Screen

**New screen:** `app/torrent/create.tsx`

Features:
1. Source path input (text; enhanced with file browser if `getDirectoryContent` is implemented)
2. Output path input (optional)
3. Format picker: v1 / v2 / Hybrid
4. Comment text input
5. Private flag toggle
6. Piece size input (0 = auto)
7. Trackers multi-line input (one per line; joined with `|` for API)
8. Web seeds multi-line input
9. "Create" button -> `POST /torrentcreator/addTask`
10. Poll task status: `GET /torrentcreator/status?taskID=X`
11. Show progress bar when Running
12. "Download .torrent" button when Finished -> `GET /torrentcreator/torrentFile?taskID=X`
13. Error display when Failed
14. Delete task: `POST /torrentcreator/deleteTask`

---

### Phase 6: Advanced / Niche Features

**Goal:** Fill remaining gaps for power users.

**Priority:** LOW | **Estimated scope:** Small per feature

#### Task 6.1 — Server File Browser

**Files to modify:** `services/api/application.ts`, new reusable component

1. Add API function: `POST /api/v2/app/getDirectoryContent`
   - Body: `dirPath` (string, required), `mode` (string, optional: `all`/`files`/`dirs`)
   - Response: array of absolute path strings, or null on error
   - HTTP 400 if path is empty/relative/colon-prefixed, 404 if not found
2. Create a reusable `<PathPicker>` component:
   - Opens as a modal
   - Lists directories (and optionally files) from the server
   - Allows navigation up/down the directory tree
   - Returns selected path
3. Integrate PathPicker into: Add Torrent save path, Settings save paths, Torrent Creator source path

#### Task 6.2 — SSL Parameters

**Files to modify:** `services/api/torrents.ts`, torrent detail screen

1. Add API functions:
   - `GET /api/v2/torrents/SSLParameters?hash={hash}` -> `{ ssl_certificate, ssl_private_key, ssl_dh_params }`
   - `POST /api/v2/torrents/setSSLParameters` -> body: `hash`, `ssl_certificate`, `ssl_private_key`, `ssl_dh_params`
2. Add SSL tab/section in torrent detail for private tracker torrents
3. Show current SSL params, allow editing

#### Task 6.3 — Cookies Manager UI

**New screen:** `app/settings/cookies.tsx`

1. API calls already exist (`app/cookies`, `app/setCookies`)
2. Create a list view of all cookies showing domain, name, value, expiration
3. Allow adding/editing/removing cookies
4. `POST /app/setCookies` replaces the entire cookie array, so send the full modified list

#### Task 6.4 — RSS Preferences in Settings

Add RSS-specific preference fields to the Settings UI:

| Field | Type | UI Control |
|---|---|---|
| `rss_processing_enabled` | bool | Toggle |
| `rss_refresh_interval` | int | Number input (minutes) |
| `rss_max_articles_per_feed` | int | Number input |
| `rss_auto_downloading_enabled` | bool | Toggle |
| `rss_download_repack_proper_episodes` | bool | Toggle |
| `rss_smart_episode_filters` | string | Multi-line text input |

---

## 5. Data Models & Types to Add

These TypeScript types should be created based on the official API response schemas. Reference the VueTorrent document (Section 12) for the full field lists.

| Type | Used By | Key Fields |
|---|---|---|
| `AddTorrentPayload` | `POST /torrents/add` | `urls`, `torrents`, `savepath`, `category`, `tags`, `stopped`, `contentLayout`, `stopCondition`, `skip_checking`, `autoTMM`, `ratioLimit`, `seedingTimeLimit`, etc. |
| `Feed` | RSS screens | `name`, `uid`, `url`, `articles[]` |
| `FeedArticle` | RSS article viewer | `id`, `title`, `date`, `torrentURL`, `isRead` |
| `FeedRule` | RSS rule editor | `enabled`, `mustContain`, `mustNotContain`, `useRegex`, `episodeFilter`, `smartFilter`, `affectedFeeds[]`, `addPaused`, `assignedCategory`, `savePath` |
| `SearchResult` | Search results | `fileName`, `fileSize`, `fileUrl`, `nbSeeders`, `nbLeechers`, `siteUrl`, `descrLink` |
| `SearchPlugin` | Plugin manager | `name`, `fullName`, `enabled`, `version`, `url`, `supportedCategories[]` |
| `SearchStatus` | Search polling | `id`, `status`, `total` |
| `TorrentCreatorTask` | Creator screen | `taskID`, `status`, `progress`, `errorMessage`, `sourcePath` |
| `NetworkInterface` | Settings | `name`, `value` |
| `Cookie` | Cookie manager | `domain`, `path`, `name`, `value`, `expirationDate` |
| `SSLParameters` | Torrent detail | `ssl_certificate`, `ssl_private_key`, `ssl_dh_params` |

---

## 6. Enumeration Constants to Add

These constants should be added to your `constants/` directory for type safety and UI picker options.

| Enum | Values | Used In |
|---|---|---|
| `ContentLayout` | `"Original"`, `"Subfolder"`, `"NoSubfolder"` | Add torrent, preferences |
| `StopCondition` | `"None"`, `"MetadataReceived"`, `"FilesChecked"` | Add torrent |
| `ShareLimitAction` | `-1` (Default), `0` (Stop), `1` (Remove), `2` (Super-seed), `3` (Remove+files) | Share limits |
| `ProxyType` | `-1` (None) through `5` (SOCKS4) | Proxy settings |
| `Encryption` | `0` (Prefer), `1` (Force On), `2` (Force Off) | BitTorrent settings |
| `BitTorrentProtocol` | `0` (TCP+uTP), `1` (TCP), `2` (uTP) | Speed settings |
| `SchedulerDays` | `0` (Every day) through `9` (Every Sunday) | Speed scheduler |
| `DynDnsService` | `0` (DynDNS), `1` (No-IP) | Web UI settings |
| `UploadChokingAlgorithm` | `0` (Round-robin), `1` (Fastest), `2` (Anti-leech) | Advanced settings |
| `UploadSlotsBehavior` | `0` (Fixed), `1` (Rate-based) | Advanced settings |
| `UtpTcpMixedMode` | `0` (Prefer TCP), `1` (Peer proportional) | Advanced settings |
| `AutoDeleteMode` | `0` (Never), `1` (If Added), `2` (Always) | Download settings |
| `TorrentFormat` | `"v1"`, `"v2"`, `"hybrid"` | Torrent creator |
| `TorrentCreatorTaskStatus` | `"Queued"`, `"Running"`, `"Finished"`, `"Failed"` | Torrent creator |
| `DirectoryContentMode` | `"all"`, `"files"`, `"dirs"` | File browser |
| `FilePriority` | `0` (Skip), `1` (Normal), `6` (High), `7` (Maximal) | Already partially exists |
| `TrackerStatus` | `0`-`4` | Already partially exists |
| `PieceState` | `0`-`2` | Already partially exists |
| `LogType` | `1` (Normal), `2` (Info), `4` (Warning), `8` (Critical) | Already partially exists |
| `TorrentState` | 20+ string values | Already partially exists; add `stoppedDL`, `stoppedUP`, `forcedMetaDL` for 5.0 |

---

## Summary of Work by Phase

| Phase | New API Endpoints | New Screens | Estimated Effort |
|---|---|---|---|
| **Phase 1** — Core Torrent Polish | 4 | 0 (modify existing) | Small-Medium |
| **Phase 2** — Full Settings | 3 | 8-9 new settings panels | Large |
| **Phase 3** — RSS Manager | 13 | 3-4 | Large |
| **Phase 4** — Search Engine | 10 | 2 | Medium |
| **Phase 5** — Torrent Creator | 4 | 1 | Small-Medium |
| **Phase 6** — Advanced Features | 2 | 2-3 | Small |
| **Total** | ~36 new endpoints | ~16-19 new screens/panels | |

---

*This roadmap was generated on 2026-03-03 from the official qBittorrent WebUI API v5.0 spec and VueTorrent's implementation reference.*
