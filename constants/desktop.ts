/**
 * Desktop metrics for the regular (iPad) and mac (Mac Catalyst) layout
 * idioms. The compact (iPhone) idiom never reads these: it keeps the
 * existing constants/spacing.ts and constants/typography.ts values.
 *
 * mac follows macOS conventions (13pt body, 26pt list rows, 11pt captions,
 * hairline separators). regular follows iPadOS conventions (17pt body, 44pt
 * sidebar rows). Every value is a plain number so components can pick with
 * desktopMetrics(idiom).
 */
import type { LayoutIdiom } from '@/hooks/useLayoutIdiom';

export interface DesktopMetrics {
  /** Sidebar column width. */
  sidebarWidth: number;
  /** Sidebar row height and text size. */
  sidebarRowHeight: number;
  sidebarFontSize: number;
  sidebarIconSize: number;
  /** Sidebar horizontal inset (server header / row padding) and row margin. */
  sidebarInsetHorizontal: number;
  sidebarRowMargin: number;
  /** Category dot / tag icon size, server badge size, collapse chevron size. */
  sidebarCategoryIconSize: number;
  sidebarServerBadgeSize: number;
  sidebarCollapseIconSize: number;
  /** Section header (NAVIGATION, STATUS...) height and text size. */
  sectionHeaderHeight: number;
  sectionHeaderFontSize: number;
  /** Rounded selection highlight radius. */
  selectionRadius: number;
  /** Toolbar above the content (search, sort, add). */
  toolbarHeight: number;
  toolbarControlHeight: number;
  toolbarFontSize: number;
  toolbarIconSize: number;
  searchFieldWidth: number;
  /** Table (mac) and row (regular) metrics. */
  tableRowHeight: number;
  tableHeaderHeight: number;
  tableFontSize: number;
  tableHeaderFontSize: number;
  /** Square artwork plate in the table name cell (Pogona NameCell.thumb). */
  tableArtworkSize: number;
  /** Status badge. */
  badgeHeight: number;
  badgeFontSize: number;
  /** Bottom status bar (mac only). */
  statusBarHeight: number;
  statusBarFontSize: number;
  /** Detail pane width (regular) / default panel height (mac). */
  detailPaneWidth: number;
  /** Hairline separator width. */
  hairline: number;
  /**
   * Mac Catalyst overlays the native titlebar (traffic lights) on the
   * window content. These reserve that strip so nothing draws behind the
   * lights. Zero on iPad (regular), which uses a real status-bar inset.
   */
  titlebarHeight: number;
  trafficLightsWidth: number;
}

const MAC: DesktopMetrics = {
  sidebarWidth: 220,
  sidebarRowHeight: 26,
  sidebarFontSize: 13,
  sidebarIconSize: 15,
  sidebarInsetHorizontal: 10,
  sidebarRowMargin: 6,
  sidebarCategoryIconSize: 8,
  sidebarServerBadgeSize: 24,
  sidebarCollapseIconSize: 20,
  sectionHeaderHeight: 22,
  sectionHeaderFontSize: 11,
  selectionRadius: 5,
  titlebarHeight: 36,
  trafficLightsWidth: 80,
  toolbarHeight: 36,
  toolbarControlHeight: 24,
  toolbarFontSize: 13,
  toolbarIconSize: 15,
  searchFieldWidth: 220,
  tableRowHeight: 26,
  tableHeaderHeight: 24,
  tableFontSize: 13,
  tableHeaderFontSize: 11,
  tableArtworkSize: 28,
  badgeHeight: 18,
  badgeFontSize: 11,
  statusBarHeight: 22,
  statusBarFontSize: 11,
  detailPaneWidth: 380,
  hairline: 1,
};

const REGULAR: DesktopMetrics = {
  sidebarWidth: 260,
  sidebarRowHeight: 44,
  sidebarFontSize: 17,
  sidebarIconSize: 20,
  sidebarInsetHorizontal: 16,
  sidebarRowMargin: 6,
  sidebarCategoryIconSize: 15,
  sidebarServerBadgeSize: 32,
  sidebarCollapseIconSize: 20,
  sectionHeaderHeight: 32,
  sectionHeaderFontSize: 13,
  selectionRadius: 10,
  titlebarHeight: 0,
  trafficLightsWidth: 0,
  toolbarHeight: 52,
  toolbarControlHeight: 36,
  toolbarFontSize: 17,
  toolbarIconSize: 20,
  searchFieldWidth: 280,
  tableRowHeight: 44,
  tableHeaderHeight: 32,
  tableFontSize: 15,
  tableHeaderFontSize: 13,
  tableArtworkSize: 32,
  badgeHeight: 22,
  badgeFontSize: 13,
  statusBarHeight: 0,
  statusBarFontSize: 0,
  detailPaneWidth: 380,
  hairline: 1,
};

export function desktopMetrics(idiom: LayoutIdiom): DesktopMetrics {
  return idiom === 'mac' ? MAC : REGULAR;
}

export const DESKTOP_METRICS = { mac: MAC, regular: REGULAR } as const;
