import { getKnownSavePaths } from '@/utils/save-paths';
import { TorrentInfo, Category } from '@/types/api';

function torrent(save_path: string): TorrentInfo {
  return { save_path } as TorrentInfo;
}

function category(savePath: string): Category {
  return { name: 'x', savePath };
}

describe('getKnownSavePaths', () => {
  it('returns [] when there are no torrents or categories', () => {
    expect(getKnownSavePaths([], {})).toEqual([]);
  });

  it('collects and sorts unique paths from torrents', () => {
    expect(
      getKnownSavePaths(
        [torrent('/data/movies'), torrent('/data/tv'), torrent('/data/movies')],
        {},
      ),
    ).toEqual(['/data/movies', '/data/tv']);
  });

  it('collects paths from categories', () => {
    expect(
      getKnownSavePaths([], { movies: category('/data/movies'), tv: category('/data/tv') }),
    ).toEqual(['/data/movies', '/data/tv']);
  });

  it('merges torrent and category paths, deduping across both', () => {
    expect(
      getKnownSavePaths([torrent('/data/movies'), torrent('/data/books')], {
        movies: category('/data/movies'),
      }),
    ).toEqual(['/data/books', '/data/movies']);
  });

  it('trims whitespace and drops blank paths', () => {
    expect(
      getKnownSavePaths([torrent('  /data/movies  '), torrent(''), torrent('   ')], {
        empty: category(''),
      }),
    ).toEqual(['/data/movies']);
  });
});
