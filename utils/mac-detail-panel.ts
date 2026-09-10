/**
 * mac-detail-panel.ts - bounds for the mac idiom's bottom-docked detail
 * panel (app/(tabs)/(torrents)/index.tsx's macSplitterPanResponder). Kept
 * here, not inline in that ~2600-line screen, so it stays trivially
 * unit-testable and reusable.
 */

export const MAC_DETAIL_PANEL_MIN_HEIGHT = 160;
export const MAC_DETAIL_PANEL_MAX_HEIGHT = 600;

export function clampMacDetailPanelHeight(height: number): number {
  return Math.min(MAC_DETAIL_PANEL_MAX_HEIGHT, Math.max(MAC_DETAIL_PANEL_MIN_HEIGHT, height));
}
