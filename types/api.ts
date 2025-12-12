// Server Configuration
export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port?: number;
  username: string;
  password: string;
  useHttps?: boolean;
}

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

export interface ApplicationPreferences {
  [key: string]: any;
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
  server_state?: ServerState;
}

export interface TorrentInfo {
  added_on: number;
  amount_left: number;
  auto_tmm: boolean;
  availability: number;
  category: string;
  completed: number;
  completion_on: number;
  content_path: string;
  dl_limit: number;
  dlspeed: number;
  download_path: string;
  downloaded: number;
  downloaded_session: number;
  eta: number;
  f_l_piece_prio: boolean;
  force_start: boolean;
  hash: string;
  last_activity: number;
  magnet_uri: string;
  max_ratio: number;
  max_seeding_time: number;
  name: string;
  num_complete: number;
  num_incomplete: number;
  num_leechs: number;
  num_seeds: number;
  priority: number;
  progress: number;
  ratio: number;
  ratio_limit: number;
  save_path: string;
  seeding_time: number;
  seeding_time_limit: number;
  seen_complete: number;
  seq_dl: boolean;
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
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

