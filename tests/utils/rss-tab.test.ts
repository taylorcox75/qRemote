import { resolveRssTabVisible } from '@/utils/rss-tab';

describe('resolveRssTabVisible', () => {
  const connected = { isConnected: true, isTransitioning: false };

  it('follows rss_processing_enabled once known for the connection', () => {
    expect(resolveRssTabVisible(false, { ...connected, rssEnabled: true })).toBe(true);
    expect(resolveRssTabVisible(true, { ...connected, rssEnabled: false })).toBe(false);
  });

  it('holds the last value while the preference is unknown or refetching', () => {
    expect(resolveRssTabVisible(true, { ...connected, rssEnabled: undefined })).toBe(true);
    expect(resolveRssTabVisible(false, { ...connected, rssEnabled: undefined })).toBe(false);
  });

  it('holds through connects and automatic reconnects', () => {
    const blip = { isConnected: false, isTransitioning: true, rssEnabled: undefined };
    expect(resolveRssTabVisible(true, blip)).toBe(true);
    expect(resolveRssTabVisible(false, blip)).toBe(false);
  });

  it('hides on a settled disconnect', () => {
    expect(
      resolveRssTabVisible(true, { isConnected: false, isTransitioning: false, rssEnabled: true }),
    ).toBe(false);
  });
});
