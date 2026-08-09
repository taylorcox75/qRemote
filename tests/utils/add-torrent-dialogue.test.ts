import {
  getAddTorrentDialogueVariant,
  getSearchAddOpensDialogue,
} from '@/utils/add-torrent-dialogue';

describe('getAddTorrentDialogueVariant', () => {
  it('returns compact by default', () => {
    expect(getAddTorrentDialogueVariant(undefined)).toBe('compact');
    expect(getAddTorrentDialogueVariant(null)).toBe('compact');
    expect(getAddTorrentDialogueVariant({})).toBe('compact');
  });

  it('returns compact when full dialogue is disabled', () => {
    expect(getAddTorrentDialogueVariant({ useFullAddTorrentDialogue: false })).toBe('compact');
  });

  it('returns full when full dialogue is enabled', () => {
    expect(getAddTorrentDialogueVariant({ useFullAddTorrentDialogue: true })).toBe('full');
  });
});

describe('getSearchAddOpensDialogue', () => {
  it('defaults to true for users with no stored value', () => {
    expect(getSearchAddOpensDialogue(undefined)).toBe(true);
    expect(getSearchAddOpensDialogue(null)).toBe(true);
    expect(getSearchAddOpensDialogue({})).toBe(true);
  });

  it('returns true when explicitly enabled', () => {
    expect(getSearchAddOpensDialogue({ searchAddOpensDialogue: true })).toBe(true);
  });

  it('returns false only when explicitly disabled', () => {
    expect(getSearchAddOpensDialogue({ searchAddOpensDialogue: false })).toBe(false);
  });
});
