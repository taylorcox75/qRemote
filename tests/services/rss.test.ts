jest.mock('@/services/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    postUrlEncoded: jest.fn(),
  },
}));

import { rssApi } from '@/services/api/rss';
import { apiClient } from '@/services/api/client';
import { RssRule } from '@/types/api';

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.postUrlEncoded as jest.Mock;

const sampleRule: RssRule = {
  enabled: true,
  mustContain: '1080p',
  mustNotContain: '',
  useRegex: false,
  episodeFilter: '',
  smartFilter: false,
  previouslyMatchedEpisodes: [],
  affectedFeeds: ['https://example.com/rss'],
  ignoreDays: 0,
  lastMatch: '',
  addPaused: null,
  assignedCategory: '',
  savePath: '',
  torrentContentLayout: null,
};

describe('rssApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addFolder posts path', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.addFolder('Movies');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/addFolder', { path: 'Movies' });
  });

  it('addFeed posts url and path', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.addFeed('https://example.com/rss', 'Movies');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/addFeed', {
      url: 'https://example.com/rss',
      path: 'Movies',
    });
  });

  it('removeItem posts path', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.removeItem('Movies\\MyFeed');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/removeItem', { path: 'Movies\\MyFeed' });
  });

  it('moveItem posts itemPath and destPath', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.moveItem('MyFeed', 'Movies\\MyFeed');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/moveItem', {
      itemPath: 'MyFeed',
      destPath: 'Movies\\MyFeed',
    });
  });

  it('getAllItems defaults withData to true', async () => {
    mockGet.mockResolvedValueOnce({ MyFeed: { uid: '1', url: 'https://example.com/rss' } });
    const result = await rssApi.getAllItems();
    expect(mockGet).toHaveBeenCalledWith('/api/v2/rss/items', { withData: true });
    expect(result).toEqual({ MyFeed: { uid: '1', url: 'https://example.com/rss' } });
  });

  it('getAllItems returns {} for a falsy response', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await rssApi.getAllItems(false);
    expect(mockGet).toHaveBeenCalledWith('/api/v2/rss/items', { withData: false });
    expect(result).toEqual({});
  });

  it('markAsRead includes articleId when provided', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.markAsRead('MyFeed', 'article-1');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/markAsRead', {
      itemPath: 'MyFeed',
      articleId: 'article-1',
    });
  });

  it('markAsRead omits articleId when marking a whole feed read', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.markAsRead('MyFeed');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/markAsRead', { itemPath: 'MyFeed' });
  });

  it('refreshItem posts itemPath', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.refreshItem('MyFeed');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/refreshItem', { itemPath: 'MyFeed' });
  });

  it('setRule JSON-encodes the rule definition', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.setRule('MyRule', sampleRule);
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/setRule', {
      ruleName: 'MyRule',
      ruleDef: JSON.stringify(sampleRule),
    });
  });

  it('renameRule posts old and new names', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.renameRule('OldName', 'NewName');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/renameRule', {
      ruleName: 'OldName',
      newRuleName: 'NewName',
    });
  });

  it('removeRule posts ruleName', async () => {
    mockPost.mockResolvedValueOnce(undefined);
    await rssApi.removeRule('MyRule');
    expect(mockPost).toHaveBeenCalledWith('/api/v2/rss/removeRule', { ruleName: 'MyRule' });
  });

  it('getAllRules returns the rules map', async () => {
    mockGet.mockResolvedValueOnce({ MyRule: sampleRule });
    const result = await rssApi.getAllRules();
    expect(mockGet).toHaveBeenCalledWith('/api/v2/rss/rules');
    expect(result).toEqual({ MyRule: sampleRule });
  });

  it('getAllRules returns {} for a falsy response', async () => {
    mockGet.mockResolvedValueOnce(undefined);
    const result = await rssApi.getAllRules();
    expect(result).toEqual({});
  });

  it('getMatchingArticles passes ruleName and returns the map', async () => {
    mockGet.mockResolvedValueOnce({ 'https://example.com/rss': ['Article 1'] });
    const result = await rssApi.getMatchingArticles('MyRule');
    expect(mockGet).toHaveBeenCalledWith('/api/v2/rss/matchingArticles', { ruleName: 'MyRule' });
    expect(result).toEqual({ 'https://example.com/rss': ['Article 1'] });
  });
});
