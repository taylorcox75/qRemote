import { CHANGELOG } from '@/constants/changelog';

describe('CHANGELOG release entries', () => {
  it('includes newly added recent release notes through 3.2.1', () => {
    expect(CHANGELOG[0]).toEqual({
      version: '3.2.1',
      date: '2026-05-29',
      changes: ['Updated release notes'],
    });

    const versions = CHANGELOG.map((entry) => entry.version);
    expect(versions).toEqual(expect.arrayContaining(['3.2.0', '3.1.2', '3.1.1']));
  });
});
