import { buildRssRuleDef, RssRuleEdits } from '@/utils/rss-rule';
import { RssRule } from '@/types/api';

const legacyRule: RssRule = {
  enabled: true,
  mustContain: 'show',
  mustNotContain: '',
  useRegex: false,
  episodeFilter: '',
  smartFilter: false,
  previouslyMatchedEpisodes: ['S01E01'],
  affectedFeeds: ['http://feed'],
  ignoreDays: 0,
  lastMatch: '',
  addPaused: null,
  assignedCategory: 'tv',
  savePath: '/tv',
  torrentContentLayout: null,
};

const modernRule: RssRule = {
  ...legacyRule,
  priority: 3,
  torrentParams: {
    category: 'tv',
    save_path: '/tv',
    use_auto_tmm: false,
    tags: ['hd'],
    download_path: '/incomplete',
    stop_condition: 'MetadataReceived',
    ratio_limit: 2,
  },
  someFutureKey: 'x',
} as RssRule;

function editsFrom(rule: RssRule, patch: Partial<RssRuleEdits> = {}): RssRuleEdits {
  const {
    enabled,
    mustContain,
    mustNotContain,
    useRegex,
    episodeFilter,
    smartFilter,
    previouslyMatchedEpisodes,
    affectedFeeds,
    ignoreDays,
    lastMatch,
    addPaused,
    assignedCategory,
    savePath,
    torrentContentLayout,
  } = rule;
  return {
    enabled,
    mustContain,
    mustNotContain,
    useRegex,
    episodeFilter,
    smartFilter,
    previouslyMatchedEpisodes,
    affectedFeeds,
    ignoreDays,
    lastMatch,
    addPaused,
    assignedCategory,
    savePath,
    torrentContentLayout,
    ...patch,
  };
}

describe('buildRssRuleDef', () => {
  it('builds a plain rule when creating (no existing rule)', () => {
    const edits = editsFrom(legacyRule);
    const def = buildRssRuleDef(undefined, edits);
    expect(def).toEqual(edits);
    expect(def.torrentParams).toBeUndefined();
  });

  it('keeps legacy rules (pre-4.6) flat and applies edits', () => {
    const def = buildRssRuleDef(legacyRule, editsFrom(legacyRule, { savePath: '/new' }));
    expect(def.savePath).toBe('/new');
    expect(def.torrentParams).toBeUndefined();
  });

  it('preserves unknown fields and torrentParams when nothing add-related changed', () => {
    const def = buildRssRuleDef(modernRule, editsFrom(modernRule, { mustContain: 'other' }));
    expect(def.mustContain).toBe('other');
    expect(def.priority).toBe(3);
    expect((def as unknown as Record<string, unknown>).someFutureKey).toBe('x');
    expect(def.torrentParams).toEqual(modernRule.torrentParams);
    expect(def.torrentParams).not.toBe(modernRule.torrentParams);
  });

  it('writes a changed save path and category into torrentParams', () => {
    const def = buildRssRuleDef(
      modernRule,
      editsFrom(modernRule, { savePath: '/movies', assignedCategory: 'movies' }),
    );
    expect(def.savePath).toBe('/movies');
    expect(def.assignedCategory).toBe('movies');
    expect(def.torrentParams).toMatchObject({
      save_path: '/movies',
      category: 'movies',
      use_auto_tmm: false,
      tags: ['hd'],
      download_path: '/incomplete',
      stop_condition: 'MetadataReceived',
      ratio_limit: 2,
    });
  });

  it('clearing the save path drops use_auto_tmm back to the server default', () => {
    const def = buildRssRuleDef(modernRule, editsFrom(modernRule, { savePath: '' }));
    expect(def.torrentParams?.save_path).toBe('');
    expect(def.torrentParams).not.toHaveProperty('use_auto_tmm');
  });

  it('maps addPaused to stopped, removing it for "default"', () => {
    const paused = buildRssRuleDef(modernRule, editsFrom(modernRule, { addPaused: true }));
    expect(paused.torrentParams?.stopped).toBe(true);

    const withStopped: RssRule = {
      ...modernRule,
      addPaused: false,
      torrentParams: { ...modernRule.torrentParams, stopped: false },
    };
    const reset = buildRssRuleDef(withStopped, editsFrom(withStopped, { addPaused: null }));
    expect(reset.torrentParams).not.toHaveProperty('stopped');
  });

  it('maps torrentContentLayout to content_layout, removing it when cleared', () => {
    const set = buildRssRuleDef(
      modernRule,
      editsFrom(modernRule, { torrentContentLayout: 'NoSubfolder' }),
    );
    expect(set.torrentParams?.content_layout).toBe('NoSubfolder');

    const withLayout: RssRule = {
      ...modernRule,
      torrentContentLayout: 'Subfolder',
      torrentParams: { ...modernRule.torrentParams, content_layout: 'Subfolder' },
    };
    const cleared = buildRssRuleDef(
      withLayout,
      editsFrom(withLayout, { torrentContentLayout: null }),
    );
    expect(cleared.torrentParams).not.toHaveProperty('content_layout');
  });

  it('treats an empty-string layout the same as null (no change)', () => {
    const withTp: RssRule = {
      ...modernRule,
      torrentContentLayout: '',
      torrentParams: { ...modernRule.torrentParams },
    };
    const def = buildRssRuleDef(withTp, editsFrom(withTp, { torrentContentLayout: null }));
    expect(def.torrentParams).toEqual(modernRule.torrentParams);
  });
});
