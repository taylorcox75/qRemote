import {
  getPrefilledDownloader,
  getResultDownloader,
  isAggregatorResult,
  planPluginUrlAdd,
} from '@/utils/search-download';

const HTML_URL = 'https://www.limetorrents.lol/Some-Release-torrent-6943379.html';

describe('isAggregatorResult', () => {
  it('recognizes Jackett and Prowlarr by plugin name, case-insensitively', () => {
    expect(isAggregatorResult({ fileUrl: HTML_URL, engineName: 'Jackett' })).toBe(true);
    expect(isAggregatorResult({ fileUrl: HTML_URL, engineName: 'prowlarr' })).toBe(true);
    expect(isAggregatorResult({ fileUrl: HTML_URL, engineName: 'My-JACKETT-proxy' })).toBe(true);
  });

  it('recognizes an apikey query param in the link, whatever the plugin is called', () => {
    expect(
      isAggregatorResult({
        fileUrl: 'http://host:9696/1/download?apikey=abc&link=xyz&file=Name',
        engineName: 'indexerhub',
      }),
    ).toBe(true);
    expect(
      isAggregatorResult({
        fileUrl: 'http://host:9117/dl/idx/?jackett_apikey=abc&path=xyz',
        engineName: 'indexerhub',
      }),
    ).toBe(true);
    expect(
      isAggregatorResult({ fileUrl: 'http://host/dl?x=1&APIKEY=abc', engineName: 'indexerhub' }),
    ).toBe(true);
  });

  it('is false for an ordinary plugin and link', () => {
    expect(isAggregatorResult({ fileUrl: HTML_URL, engineName: 'limetorrents' })).toBe(false);
    expect(isAggregatorResult({ fileUrl: HTML_URL })).toBe(false);
  });

  it('does not mistake a path or an unrelated param for an apikey', () => {
    expect(
      isAggregatorResult({ fileUrl: 'https://site.example/apikey=docs', engineName: 'plugin' }),
    ).toBe(false);
    expect(
      isAggregatorResult({ fileUrl: 'https://site.example/dl?myapikey=1', engineName: 'plugin' }),
    ).toBe(false);
  });
});

describe('getResultDownloader', () => {
  it('names the result’s plugin for a non-magnet URL', () => {
    expect(getResultDownloader({ fileUrl: HTML_URL, engineName: 'limetorrents' })).toBe(
      'limetorrents',
    );
  });

  it('returns the plugin for every result of a single-plugin search (all one site)', () => {
    // A search with only LimeTorrents enabled: every result shares one site, which
    // must NOT be mistaken for an aggregator batch.
    const batch = [1, 2, 3].map((n) => ({
      fileUrl: `https://www.limetorrents.lol/Release-${n}-torrent-${n}.html`,
      engineName: 'limetorrents',
      siteUrl: 'https://www.limetorrents.lol',
    }));
    expect(batch.map((result) => getResultDownloader(result))).toEqual([
      'limetorrents',
      'limetorrents',
      'limetorrents',
    ]);
  });

  it('is undefined for a magnet link, whatever its case or padding', () => {
    expect(
      getResultDownloader({ fileUrl: 'magnet:?xt=urn:btih:abc', engineName: 'limetorrents' }),
    ).toBeUndefined();
    expect(
      getResultDownloader({ fileUrl: '  MAGNET:?xt=urn:btih:abc', engineName: 'limetorrents' }),
    ).toBeUndefined();
  });

  it('is undefined for Jackett and Prowlarr results', () => {
    expect(getResultDownloader({ fileUrl: HTML_URL, engineName: 'Jackett' })).toBeUndefined();
    expect(getResultDownloader({ fileUrl: HTML_URL, engineName: 'prowlarr' })).toBeUndefined();
  });

  it('is undefined for a link carrying an apikey, even from an unrecognized plugin name', () => {
    expect(
      getResultDownloader({
        fileUrl: 'http://host:9696/1/download?apikey=abc&link=xyz',
        engineName: 'indexerhub',
      }),
    ).toBeUndefined();
  });

  it('is undefined when the server reported no engine name', () => {
    expect(getResultDownloader({ fileUrl: HTML_URL })).toBeUndefined();
    expect(getResultDownloader({ fileUrl: HTML_URL, engineName: '' })).toBeUndefined();
  });

  it('is undefined when there is no URL at all', () => {
    expect(getResultDownloader({ fileUrl: '', engineName: 'limetorrents' })).toBeUndefined();
  });
});

describe('planPluginUrlAdd', () => {
  const v5_2 = { supportsFetchMetadataDownloader: true, supportsSearchDownloadTorrent: true };
  const v5_0 = { supportsFetchMetadataDownloader: false, supportsSearchDownloadTorrent: true };
  const v4 = { supportsFetchMetadataDownloader: false, supportsSearchDownloadTorrent: false };

  it('adds with the downloader param when the server supports it', () => {
    expect(planPluginUrlAdd('limetorrents', v5_2)).toBe('addWithDownloader');
  });

  it('falls back to search/downloadTorrent on 5.0–5.1', () => {
    expect(planPluginUrlAdd('limetorrents', v5_0)).toBe('searchDownloadTorrent');
  });

  it('is a plain add on qBittorrent 4.x, which cannot resolve through a plugin', () => {
    expect(planPluginUrlAdd('limetorrents', v4)).toBe('plainAdd');
  });

  it('is a plain add whenever there is no downloader', () => {
    expect(planPluginUrlAdd(undefined, v5_2)).toBe('plainAdd');
    expect(planPluginUrlAdd(undefined, v5_0)).toBe('plainAdd');
    expect(planPluginUrlAdd(undefined, v4)).toBe('plainAdd');
  });
});

describe('getPrefilledDownloader', () => {
  const prefilled = { url: HTML_URL, plugin: 'limetorrents' };

  it('applies the plugin to exactly the pre-filled URL', () => {
    expect(getPrefilledDownloader([HTML_URL], prefilled)).toBe('limetorrents');
  });

  it('ignores surrounding whitespace on either side', () => {
    expect(getPrefilledDownloader([HTML_URL], { ...prefilled, url: `  ${HTML_URL}\n` })).toBe(
      'limetorrents',
    );
  });

  it('does not apply once the URL was edited', () => {
    expect(getPrefilledDownloader([`${HTML_URL}?x=1`], prefilled)).toBeUndefined();
  });

  it('does not apply when more URLs were added alongside it', () => {
    expect(
      getPrefilledDownloader([HTML_URL, 'magnet:?xt=urn:btih:abc'], prefilled),
    ).toBeUndefined();
  });

  it('does not apply to an empty list or when nothing was remembered', () => {
    expect(getPrefilledDownloader([], prefilled)).toBeUndefined();
    expect(getPrefilledDownloader([HTML_URL], null)).toBeUndefined();
    expect(getPrefilledDownloader([HTML_URL], undefined)).toBeUndefined();
  });
});
