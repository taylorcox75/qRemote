import { extractMagnetLink, isMagnetLink } from '@/utils/magnet';

describe('isMagnetLink', () => {
  it('returns true for valid magnet links', () => {
    expect(isMagnetLink('magnet:?xt=urn:btih:abc123')).toBe(true);
  });

  it('is case-insensitive and ignores outer whitespace', () => {
    expect(isMagnetLink('  MAGNET:?xt=urn:btih:abc123  ')).toBe(true);
  });

  it('returns false for non-magnet values', () => {
    expect(isMagnetLink('https://example.com/file.torrent')).toBe(false);
    expect(isMagnetLink('')).toBe(false);
  });
});

describe('extractMagnetLink', () => {
  const sampleMagnet = 'magnet:?xt=urn:btih:ABCDEF1234567890&dn=Ubuntu';
  const encodedSampleMagnet = encodeURIComponent(sampleMagnet);

  it('extracts direct magnet links', () => {
    expect(extractMagnetLink(sampleMagnet)).toBe(sampleMagnet);
  });

  it('extracts URL-encoded direct magnet links', () => {
    expect(extractMagnetLink(encodedSampleMagnet)).toBe(sampleMagnet);
  });

  it('extracts magnet from deep-link magnet param', () => {
    const incomingUrl = `qRemote:///?magnet=${encodedSampleMagnet}`;
    expect(extractMagnetLink(incomingUrl)).toBe(sampleMagnet);
  });

  it('extracts magnet from deep-link url param', () => {
    const incomingUrl = `qRemote:///?url=${encodedSampleMagnet}`;
    expect(extractMagnetLink(incomingUrl)).toBe(sampleMagnet);
  });

  it('returns null when no magnet link exists', () => {
    expect(extractMagnetLink('qRemote:///?foo=bar')).toBeNull();
    expect(extractMagnetLink('https://example.com/file.torrent')).toBeNull();
    expect(extractMagnetLink('')).toBeNull();
    expect(extractMagnetLink(undefined)).toBeNull();
    expect(extractMagnetLink(null)).toBeNull();
  });

  it('falls back to regex extraction for free-form text', () => {
    const incomingText = `Hey, use this ${sampleMagnet} thanks`;
    expect(extractMagnetLink(incomingText)).toBe(sampleMagnet);
  });
});
