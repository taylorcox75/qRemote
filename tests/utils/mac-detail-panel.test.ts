import {
  clampMacDetailPanelHeight,
  MAC_DETAIL_PANEL_MIN_HEIGHT,
  MAC_DETAIL_PANEL_MAX_HEIGHT,
} from '@/utils/mac-detail-panel';

describe('clampMacDetailPanelHeight', () => {
  it('passes through a value already inside the 160..600 bounds', () => {
    expect(clampMacDetailPanelHeight(300)).toBe(300);
  });

  it('clamps to the 160 minimum', () => {
    expect(clampMacDetailPanelHeight(0)).toBe(MAC_DETAIL_PANEL_MIN_HEIGHT);
    expect(clampMacDetailPanelHeight(159)).toBe(MAC_DETAIL_PANEL_MIN_HEIGHT);
    expect(clampMacDetailPanelHeight(-500)).toBe(MAC_DETAIL_PANEL_MIN_HEIGHT);
  });

  it('is exact at the 160 boundary', () => {
    expect(clampMacDetailPanelHeight(160)).toBe(160);
  });

  it('clamps to the 600 maximum', () => {
    expect(clampMacDetailPanelHeight(601)).toBe(MAC_DETAIL_PANEL_MAX_HEIGHT);
    expect(clampMacDetailPanelHeight(10000)).toBe(MAC_DETAIL_PANEL_MAX_HEIGHT);
  });

  it('is exact at the 600 boundary', () => {
    expect(clampMacDetailPanelHeight(600)).toBe(600);
  });
});
