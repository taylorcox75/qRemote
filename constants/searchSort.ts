import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { SearchSortKey } from '@/types/preferences';

/**
 * Search tab sort options, in dropdown order. Shared by the Search tab's sort
 * menu and the Settings → Appearance "Default search sort" picker.
 */
export const SEARCH_SORT_OPTIONS: Array<{
  key: SearchSortKey;
  labelKey: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}> = [
  { key: 'relevance', labelKey: 'screens.search.sortRelevance', icon: 'sparkles-outline' },
  { key: 'seeders', labelKey: 'screens.search.sortSeeders', icon: 'arrow-up-outline' },
  { key: 'leechers', labelKey: 'screens.search.sortLeechers', icon: 'arrow-down-outline' },
  { key: 'size', labelKey: 'screens.search.sortSize', icon: 'cube-outline' },
  { key: 'name', labelKey: 'screens.search.sortName', icon: 'text-outline' },
  { key: 'date', labelKey: 'screens.search.sortDate', icon: 'calendar-outline' },
  { key: 'quality', labelKey: 'screens.search.sortQuality', icon: 'film-outline' },
];

/**
 * Sorts offered as the default. Date is left out: it needs a server that
 * reports publish dates (`ApiFeatures.supportsSearchPubDate`), and a default
 * the current server can't honor would leave the list unsorted.
 */
export const SEARCH_DEFAULT_SORT_OPTIONS = SEARCH_SORT_OPTIONS.filter((opt) => opt.key !== 'date');
