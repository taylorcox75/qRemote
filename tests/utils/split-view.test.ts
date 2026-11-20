import { getSplitLayout } from '@/utils/split-view';
import { SPLIT_LIST_WIDTH } from '@/constants/spacing';

const none = { left: 0, right: 0 };

describe('getSplitLayout', () => {
  it('splits a wide window on the list', () => {
    expect(getSplitLayout(951, { left: 0, right: 59 }, '/')).toEqual({
      split: true,
      listWidth: SPLIT_LIST_WIDTH,
    });
  });

  it('never splits a phone-width window', () => {
    expect(getSplitLayout(402, none, '/').split).toBe(false);
  });

  it('counts the side insets against the width', () => {
    expect(getSplitLayout(800, { left: 0, right: 60 }, '/').split).toBe(false);
  });

  it('goes full width once a screen is pushed', () => {
    expect(getSplitLayout(1194, none, '/torrent/files').split).toBe(false);
  });

  it('stays split while another tab is showing (no narrow flash on return)', () => {
    expect(getSplitLayout(951, none, '/settings/appearance').split).toBe(true);
    expect(getSplitLayout(951, none, '/transfer').split).toBe(true);
  });

  it('includes a left inset in the list column', () => {
    expect(getSplitLayout(1194, { left: 20, right: 0 }, '/').listWidth).toBe(SPLIT_LIST_WIDTH + 20);
  });
});
