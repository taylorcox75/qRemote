import { getAddTorrentDialogueVariant } from '@/utils/add-torrent-dialogue';

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
