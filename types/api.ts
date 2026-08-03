/**
 * api.ts — TypeScript interfaces for the qBittorrent WebUI API v2 data model.
 *
 * Key exports: ServerConfig, TorrentInfo, TorrentState, TorrentProperties, GlobalTransferInfo,
 *   MainData, ServerState, Category, Tracker, TorrentFile, FilePriority, LogEntry, PeerLogEntry,
 *   RssFeed, RssItemsResponse, RssRule, RssRulesResponse
 * Known issues: ApplicationPreferences uses Record<string, unknown> as the full preference schema is extensive.
 */

// Server Configuration
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port?: number;
  basePath?: string;
  username: string;
  password: string;
  useHttps?: boolean;
  bypassAuth?: boolean; // Skip authentication when local network auth is disabled

  /**
   * When true, the connection flow will attempt the fallback endpoint after the
   * primary endpoint fails with a network error. Authentication is shared with
   * the primary endpoint since fallback represents an alternate route to the
   * same qBittorrent instance (e.g. LAN vs WAN, DDNS vs static IP).
   */
  useFallback?: boolean;
  /** Fallback host (IP or domain). Required when useFallback is true. */
  fallbackHost?: string;
  /** Fallback port. Same 1–65535 validation as the primary port. */
  fallbackPort?: number;
  /** Whether the fallback endpoint should be reached over HTTPS. */
  fallbackUseHttps?: boolean;
  /** Reserved for future fallback base path UI; not surfaced in settings yet. */
  fallbackBasePath?: string;

  /** When true, send an HTTP Basic Auth header on every request (for reverse-proxy frontends). */
  useBasicAuth?: boolean;
  /** Proxy Basic Auth username (in-memory + AsyncStorage; separate from qBittorrent WebUI username). */
  basicAuthUsername?: string;
  /** Proxy Basic Auth password (in-memory only; stored in SecureStore). */
  basicAuthPassword?: string;

  /** When true, authenticate with a qBittorrent API key (v5.2.0+ / WebAPI 2.14.1+) instead of username/password login. */
  useApiKey?: boolean;
  /** qBittorrent API key, sent as `Authorization: Bearer <apiKey>` (in-memory only; stored in SecureStore). */
  apiKey?: string;
}

export type ServerEndpointKind = 'primary' | 'fallback';

// Authentication
export interface LoginResponse {
  status: 'Ok' | 'Fails';
}

// Application
export interface ApplicationVersion {
  version: string;
  apiVersion: string;
}

export interface BuildInfo {
  qt: string;
  libtorrent: string;
  boost: string;
  openssl: string;
  bitness: number;
}

/**
 * Value for a single entry in ApplicationPreferences.scan_dirs:
 * 0 = download into the monitored folder itself, 1 = the default save location,
 * any other string = a custom override path ("Other...").
 */
export type ScanDirOverride = 0 | 1 | string;

export interface ApplicationPreferences {
  save_path?: string;
  auto_tmm_enabled?: boolean;
  torrent_changed_tmm_enabled?: boolean;
  save_path_changed_tmm_enabled?: boolean;
  category_changed_tmm_enabled?: boolean;
  use_category_paths_in_manual_mode?: boolean;
  torrent_content_layout?: 'Original' | 'Subfolder' | 'NoSubfolder';
  temp_path_enabled?: boolean;
  temp_path?: string;
  preallocate_all?: boolean;
  incomplete_files_ext?: boolean;
  use_unwanted_folder?: boolean;
  export_dir?: string;
  export_dir_fin?: string;
  add_to_top_of_queue?: boolean;
  torrent_stop_condition?: 'None' | 'MetadataReceived' | 'FilesChecked';
  merge_trackers?: boolean;
  /** 0/1 as a boolean-ish number: whether the .torrent file is deleted after adding. */
  auto_delete_mode?: number;
  scan_dirs?: Record<string, ScanDirOverride>;
  excluded_file_names_enabled?: boolean;
  excluded_file_names?: string;
  mail_notification_enabled?: boolean;
  mail_notification_sender?: string;
  mail_notification_email?: string;
  mail_notification_smtp?: string;
  mail_notification_encryption_type?: 'None' | 'STARTTLS' | 'SMTPS';
  mail_notification_auth_enabled?: boolean;
  mail_notification_username?: string;
  mail_notification_password?: string;
  autorun_on_torrent_added_enabled?: boolean;
  autorun_on_torrent_added_program?: string;
  autorun_enabled?: boolean;
  autorun_program?: string;
  /** True if the global share ratio limit is enabled. */
  max_ratio_enabled?: boolean;
  /** Global share ratio limit. */
  max_ratio?: number;
  /** Action when a torrent hits a share limit: 0 = pause, 1 = remove. */
  max_ratio_act?: number;
  /** True if the global seeding time limit is enabled. */
  max_seeding_time_enabled?: boolean;
  /** Global seeding time limit, in minutes. */
  max_seeding_time?: number;
  [key: string]: unknown;
}

// Logs
export interface LogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: number; // 1=normal, 2=warning, 4=critical
}

export interface PeerLogEntry {
  id: number;
  ip: string;
  port: number;
  connection: string;
  flags: string;
  client: string;
}

// Sync
export interface MainData {
  rid: number;
  full_update: boolean;
  torrents?: { [hash: string]: TorrentInfo };
  torrents_removed?: string[];
  categories?: { [name: string]: Category };
  categories_removed?: string[];
  tags?: string[];
  tags_removed?: string[];
  server_state?: Partial<ServerState>;
}

export interface TorrentInfo {
  added_on: number;
  amount_left: number;
  auto_tmm: boolean;
  availability: number;
  category: string;
  completed: number;
  completion_on: number;
  content_path?: string;
  dl_limit: number;
  dlspeed: number;
  download_path: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  f_l_piece_prio: boolean;
  force_start: boolean;
  hash: string;
  /**
   * Per-torrent inactive-seeding limit in minutes (-2 = use global, -1 = no
   * limit). Reported from qBittorrent 5.0 / WebAPI 2.11.0 — absent on older
   * servers. Must be echoed back on setShareLimits, see `share_limit_action`.
   */
  inactive_seeding_time_limit?: number;
  last_activity: number;
  magnet_uri: string;
  /** Effective ratio limit, with a `-2` ratio_limit already resolved to the global value. */
  max_ratio: number;
  /** Effective seeding time limit (minutes), with `-2` already resolved to the global value. */
  max_seeding_time: number;
  name: string;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  /** qBittorrent 5.x only — absent on 4.x servers. */
  popularity?: number;
  priority: number;
  progress: number;
  ratio: number;
  /** Per-torrent ratio limit: -2 = use global limit, -1 = no limit. Compare `max_ratio` (effective). */
  ratio_limit?: number;
  save_path: string;
  seeding_time: number;
  /** Per-torrent seeding limit (minutes): -2 = use global, -1 = no limit. Compare `max_seeding_time`. */
  seeding_time_limit?: number;
  seen_complete: number;
  seq_dl: boolean;
  /**
   * What qBittorrent does when a share limit is reached, e.g. 'Default' (use the
   * global setting), 'Stop', 'Remove', 'RemoveWithContent', 'EnableSuperSeeding'.
   * Reported from WebAPI 2.10.4. `setShareLimits` REQUIRES this param on newer
   * servers and applies whatever is sent, so it must be round-tripped rather
   * than defaulted — sending 'Default' silently resets the torrent to the global
   * action (which may be "Remove", deleting the torrent).
   */
  share_limit_action?: string;
  /** Whether all or any share limit must be met, e.g. 'Default' | 'MatchAny' | 'MatchAll' (WebAPI 2.16.0+). */
  share_limits_mode?: string;
  size: number;
  state: TorrentState;
  super_seeding: boolean;
  tags: string;
  time_active: number;
  total_size: number;
  tracker: string;
  up_limit: number;
  uploaded: number;
  uploaded_session: number;
  upspeed: number;
}

export type TorrentState =
  | 'error'
  | 'missingFiles'
  | 'uploading'
  | 'pausedUP'
  | 'queuedUP'
  | 'stalledUP'
  | 'checkingUP'
  | 'forcedUP'
  | 'stoppedUP'
  | 'allocating'
  | 'downloading'
  | 'metaDL'
  | 'forcedMetaDL'
  | 'pausedDL'
  | 'queuedDL'
  | 'stalledDL'
  | 'checkingDL'
  | 'forcedDL'
  | 'stoppedDL'
  | 'checkingResumeData'
  | 'moving'
  | 'unknown';

export interface Category {
  name: string;
  savePath: string;
}

export interface ServerState {
  alltime_dl: number;
  alltime_ul: number;
  average_time_queue: number;
  connection_status: 'connected' | 'firewalled' | 'disconnected';
  dht_nodes: number;
  dl_info_data: number;
  dl_info_speed: number;
  dl_rate_limit: number;
  free_space_on_disk: number;
  global_ratio: string;
  queued_io_jobs: number;
  queueing: boolean;
  read_cache_hits: string;
  read_cache_overload: string;
  refresh_interval: number;
  total_buffers_size: number;
  total_peer_connections: number;
  total_queued_size: number;
  total_size?: number;
  up_info_data: number;
  up_info_speed: number;
  up_rate_limit: number;
  use_alt_speed_limits: boolean;
  write_cache_hits: string;
  write_cache_overload: string;
}

// Transfer Info
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
  alt_dl_limit?: number; // bytes/s — fetched from app/preferences, converted from kB/s
  alt_up_limit?: number; // bytes/s
}

// Torrent Properties
export interface TorrentProperties {
  addition_date: number;
  comment: string;
  completion_date: number;
  created_by: string;
  creation_date: number;
  dl_limit: number;
  dl_speed: number;
  dl_speed_avg: number;
  download_path: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  hash: string;
  infohash_v1: string;
  infohash_v2: string;
  last_activity: number;
  peers: number;
  peers_total: number;
  piece_size: number;
  pieces_have: number;
  pieces_num: number;
  reannounce: number;
  save_path: string;
  seeding_time: number;
  seeds: number;
  seeds_total: number;
  share_ratio: number;
  time_elapsed: number;
  total_downloaded: number;
  total_size: number;
  total_uploaded: number;
  up_limit: number;
  up_speed: number;
  up_speed_avg: number;
  uploaded: number;
  uploaded_session: number;
}

export interface Tracker {
  url: string;
  status: number;
  tier: number;
  msg: string;
}

export interface WebSeed {
  url: string;
}

export interface TorrentFile {
  index: number;
  name: string;
  size: number;
  progress: number;
  priority: FilePriority;
  is_seed: boolean;
  piece_range: [number, number];
}

export type FilePriority = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TorrentPieceState {
  [pieceIndex: number]: number; // 0=not downloaded, 1=downloading, 2=downloaded
}

export interface TorrentPieceHash {
  [pieceIndex: number]: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

// Search (qBittorrent /api/v2/search/*)
// Available from qBittorrent v4.1.4 / WebAPI v2.1.1.
export interface SearchJob {
  id: number;
}

export type SearchStatusValue = 'Running' | 'Stopped';

export interface SearchJobStatus {
  id: number;
  status: SearchStatusValue;
  total: number;
}

export interface SearchResult {
  fileName: string;
  fileSize: number;
  fileUrl: string;
  nbLeechers: number;
  nbSeeders: number;
  siteUrl: string;
  descrLink: string;
  /** Name of the plugin that produced this result. Absent on older servers. */
  engineName?: string;
  /** Unix timestamp (seconds) the torrent was published, if the plugin reported one (qBit 5.0+ / WebAPI >= 2.11.0). */
  pubDate?: number;
}

export interface SearchResultsResponse {
  status: SearchStatusValue;
  results: SearchResult[];
  total: number;
}

export interface SearchPluginCategory {
  id: string;
  name: string;
}

export interface SearchPlugin {
  enabled: boolean;
  fullName: string;
  name: string;
  supportedCategories: SearchPluginCategory[];
  url: string;
  version: string;
}

// RSS (qBittorrent /api/v2/rss/*)
// Available since early WebAPI v2 (well before anything else gated in this
// file). Field shapes reconstructed from the qBittorrent WebUI API docs —
// spot-check against a live server if a field turns out to be missing/renamed.
export interface RssArticle {
  id: string;
  title: string;
  date?: string;
  link?: string;
  description?: string;
  torrentURL?: string;
  [key: string]: unknown; // qBittorrent includes extra per-feed fields
}

export interface RssFeed {
  uid: string;
  url: string;
  title?: string;
  lastBuildDate?: string;
  isLoading?: boolean;
  hasError?: boolean;
  articles?: RssArticle[];
}

/**
 * A folder node has no `url` key — its own keys are child item names, each
 * itself an RssFeed or a nested folder. Use isRssFeed() (utils/rss.ts) to
 * distinguish a feed from a folder at runtime.
 */
export type RssTreeNode = RssFeed | { [name: string]: RssTreeNode };
export type RssItemsResponse = { [name: string]: RssTreeNode };

export interface RssRule {
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
  addPaused: boolean | null;
  assignedCategory: string;
  savePath: string;
  torrentContentLayout: string | null;
}

export type RssRulesResponse = Record<string, RssRule>; // keyed by rule name
export type RssMatchingArticlesResponse = Record<string, string[]>; // feed URL -> article titles
