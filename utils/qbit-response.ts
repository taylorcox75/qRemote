/**
 * qbit-response.ts — recognizes whether a response actually came from the
 * qBittorrent WebUI API.
 *
 * With no login (auth mode None / API key / qui), connecting only fetched
 * `app/version` and accepted any 200. A URL that reaches something else — a
 * reverse proxy's catch-all page, another web app on that port, a login
 * portal — answers every path with HTML and a 200, so the app "connected" and
 * then polled HTML: an empty torrent list, a flickering error state, and the
 * Transfer crash in #334. Validating the version bodies at connect turns that
 * into a clear "this isn't qBittorrent" error instead.
 */

/** Thrown when the server's replies don't look like qBittorrent's WebUI API. */
export const NOT_QBITTORRENT_MESSAGE =
  'The server answered, but not like qBittorrent. Check the address, port and path.';

/** `app/version` body: "v5.3.0", "v4.6.7", "5.0.0beta1"… — short, no markup. */
export function isQbitAppVersion(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  const v = body.trim();
  return v.length > 0 && v.length <= 64 && /^v?\d+\.\d+/i.test(v);
}

/** `app/webapiVersion` body: "2.16.2", "2.6" (qBit drops a zero patch). */
export function isQbitWebApiVersion(body: unknown): boolean {
  if (typeof body !== 'string') return false;
  return /^\d+\.\d+(\.\d+)?$/.test(body.trim());
}
