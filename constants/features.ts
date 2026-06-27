/**
 * Compile-time feature flags.
 * Flip a flag and rebuild to enable/disable a feature for a given build.
 */

export const FEATURES = {
  /**
   * In-app torrent search (Search tab + Search plugins screen).
   * Disabled by default — App Store builds must not expose arbitrary-indexer
   * search/download. Set to `true` for sideloaded / non-App-Store builds.
   */
  search: false,
};
