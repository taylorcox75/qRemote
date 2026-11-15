/**
 * rss-tab.ts — whether the RSS tab is shown in the Liquid Glass (native) tab
 * bar, held steady through transient connection states.
 *
 * Showing/hiding a native tab re-keys expo-router's native tab view, which
 * remounts every tab's screens (navigation state survives, component state
 * doesn't). That's accepted only on a real change — a server connecting, a
 * manual disconnect, or `rss_processing_enabled` actually flipping — which
 * already end the qBittorrent session (search jobs) and clear selection. So
 * automatic reconnects, connects in progress and preference refetches keep the
 * last known value instead of blinking the tab (and remounting everything).
 *
 * Key exports: resolveRssTabVisible, RssTabInput
 */

export interface RssTabInput {
  isConnected: boolean;
  /** A connect / automatic reconnect is in flight (not a settled disconnect). */
  isTransitioning: boolean;
  /**
   * The current connection's `rss_processing_enabled`, or undefined while it
   * isn't known yet (not fetched for this connection, or refetching).
   */
  rssEnabled: boolean | undefined;
}

export function resolveRssTabVisible(previous: boolean, input: RssTabInput): boolean {
  if (input.isConnected) {
    return input.rssEnabled === undefined ? previous : input.rssEnabled;
  }
  return input.isTransitioning ? previous : false;
}
