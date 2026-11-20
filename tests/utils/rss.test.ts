import {
  getRssFeedDisplayName,
  flattenRssTree,
  isRssFeed,
  joinRssPath,
  parentRssPath,
  rssPathBaseName,
  sortArticlesByDateDesc,
  toSearchQuery,
} from '@/utils/rss';
import { RssArticle, RssFeed, RssItemsResponse } from '@/types/api';

const feed = (url: string): RssFeed => ({ uid: url, url });

describe('isRssFeed', () => {
  it('is true for a node with a url field', () => {
    expect(isRssFeed(feed('https://example.com/feed'))).toBe(true);
  });

  it('is false for a plain folder node', () => {
    expect(isRssFeed({ SomeFeed: feed('https://example.com/feed') })).toBe(false);
  });

  it('is false for an empty folder node', () => {
    expect(isRssFeed({})).toBe(false);
  });
});

describe('joinRssPath / parentRssPath / rssPathBaseName', () => {
  it('joins a root-level name with no leading separator', () => {
    expect(joinRssPath('', 'Movies')).toBe('Movies');
  });

  it('joins a nested name with a backslash separator', () => {
    expect(joinRssPath('Movies', '4K')).toBe('Movies\\4K');
  });

  it('parentRssPath returns empty string for a root-level path', () => {
    expect(parentRssPath('Movies')).toBe('');
  });

  it('parentRssPath returns the parent for a nested path', () => {
    expect(parentRssPath('Movies\\4K\\MyFeed')).toBe('Movies\\4K');
  });

  it('rssPathBaseName returns the whole path for a root-level path', () => {
    expect(rssPathBaseName('Movies')).toBe('Movies');
  });

  it('rssPathBaseName returns the last segment for a nested path', () => {
    expect(rssPathBaseName('Movies\\4K\\MyFeed')).toBe('MyFeed');
  });
});

describe('flattenRssTree', () => {
  it('returns empty folders/feeds for an empty tree', () => {
    expect(flattenRssTree({})).toEqual({ folders: [], feeds: [] });
  });

  it('never recurses into strings, nulls or arrays (malformed rss/items body)', () => {
    // A text body used to recurse forever: Object.entries('n') yields 'n' again.
    expect(flattenRssTree('not json' as never)).toEqual({ folders: [], feeds: [] });
    expect(flattenRssTree(['a'] as never)).toEqual({ folders: [], feeds: [] });
    const tree = { bad: null, str: 'x', ok: { url: 'http://f', title: 'F' } } as never;
    expect(flattenRssTree(tree)).toEqual({
      folders: [],
      feeds: [{ path: 'ok', feed: { url: 'http://f', title: 'F' } }],
    });
  });

  it('collects root-level feeds with their own name as the path', () => {
    const tree: RssItemsResponse = {
      FeedA: feed('https://a.example.com/rss'),
      FeedB: feed('https://b.example.com/rss'),
    };
    const { folders, feeds } = flattenRssTree(tree);
    expect(folders).toEqual([]);
    expect(feeds).toEqual([
      { path: 'FeedA', feed: tree.FeedA },
      { path: 'FeedB', feed: tree.FeedB },
    ]);
  });

  it('collects nested folders and feeds with backslash-joined paths', () => {
    const deepFeed = feed('https://deep.example.com/rss');
    const topFeed = feed('https://top.example.com/rss');
    const tree: RssItemsResponse = {
      Movies: {
        '4K': {
          DeepFeed: deepFeed,
        },
        TopFeed: topFeed,
      },
    };
    const { folders, feeds } = flattenRssTree(tree);
    expect(folders.sort()).toEqual(['Movies', 'Movies\\4K'].sort());
    expect(feeds.sort((a, b) => a.path.localeCompare(b.path))).toEqual(
      [
        { path: 'Movies\\4K\\DeepFeed', feed: deepFeed },
        { path: 'Movies\\TopFeed', feed: topFeed },
      ].sort((a, b) => a.path.localeCompare(b.path)),
    );
  });

  it('handles an empty folder with no children', () => {
    const tree: RssItemsResponse = { EmptyFolder: {} };
    const { folders, feeds } = flattenRssTree(tree);
    expect(folders).toEqual(['EmptyFolder']);
    expect(feeds).toEqual([]);
  });
});

describe('toSearchQuery', () => {
  it('unwraps a trailing parenthesized release year, keeping the year', () => {
    expect(toSearchQuery('RBG (2018)')).toBe('RBG 2018');
  });

  it('unwraps a bracketed year too', () => {
    expect(toSearchQuery('RBG [2018]')).toBe('RBG 2018');
  });

  it('strips a parenthetical qualifier that is not a year', () => {
    expect(toSearchQuery("Ocean's Eleven (Remastered)")).toBe("Ocean's Eleven");
  });

  it('keeps the year but strips a second, non-year parenthetical group', () => {
    expect(toSearchQuery('The Movie (2018) (Extended Cut)')).toBe('The Movie 2018');
  });

  it('leaves a title with no parentheses unchanged', () => {
    expect(toSearchQuery('The Wire')).toBe('The Wire');
  });

  it('collapses internal whitespace left behind after stripping', () => {
    expect(toSearchQuery('Title  (2018)  Subtitle')).toBe('Title 2018 Subtitle');
  });
});

describe('sortArticlesByDateDesc', () => {
  const article = (id: string, date?: string): RssArticle => ({ id, title: id, date });

  it('sorts dated articles newest first', () => {
    const oldest = article('a', '2024-01-01T00:00:00Z');
    const middle = article('b', '2024-06-01T00:00:00Z');
    const newest = article('c', '2024-12-01T00:00:00Z');
    expect(sortArticlesByDateDesc([oldest, newest, middle])).toEqual([newest, middle, oldest]);
  });

  it('puts undated entries last, keeping their original relative order', () => {
    const dated = article('dated', '2024-06-01T00:00:00Z');
    const undated1 = article('undated1');
    const undated2 = article('undated2');
    expect(sortArticlesByDateDesc([undated1, dated, undated2])).toEqual([
      dated,
      undated1,
      undated2,
    ]);
  });

  it('treats an unparseable date string as undated', () => {
    const dated = article('dated', '2024-06-01T00:00:00Z');
    const garbage = article('garbage', 'not-a-real-date');
    expect(sortArticlesByDateDesc([garbage, dated])).toEqual([dated, garbage]);
  });

  it('leaves a feed with no dates at all in its original order', () => {
    const first = article('first');
    const second = article('second');
    const third = article('third');
    expect(sortArticlesByDateDesc([first, second, third])).toEqual([first, second, third]);
  });

  it('does not mutate the input array', () => {
    const oldest = article('a', '2024-01-01T00:00:00Z');
    const newest = article('b', '2024-12-01T00:00:00Z');
    const input = [oldest, newest];
    const result = sortArticlesByDateDesc(input);
    expect(input).toEqual([oldest, newest]);
    expect(result).not.toBe(input);
  });

  it('returns an empty array unchanged', () => {
    expect(sortArticlesByDateDesc([])).toEqual([]);
  });
});

describe('getRssFeedDisplayName', () => {
  const feed = { url: 'https://example.com/rss.xml', title: 'Example Releases' };

  it('shows the name the user gave the feed', () => {
    expect(getRssFeedDisplayName('My Shows', feed)).toBe('My Shows');
  });

  it('keeps a rename inside a folder', () => {
    expect(getRssFeedDisplayName('TV\\My Shows', feed)).toBe('My Shows');
  });

  it('falls back to the feed title when the name is just the URL (never renamed)', () => {
    expect(getRssFeedDisplayName('https://example.com/rss.xml', feed)).toBe('Example Releases');
    expect(getRssFeedDisplayName('TV\\https://example.com/rss.xml', feed)).toBe('Example Releases');
  });

  it('falls back to the URL when an unnamed feed has no title yet', () => {
    expect(getRssFeedDisplayName('https://example.com/rss.xml', { ...feed, title: '' })).toBe(
      'https://example.com/rss.xml',
    );
  });
});
