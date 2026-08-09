import { AppPreferences } from '@/types/preferences';

export type AddTorrentDialogueVariant = 'compact' | 'full';

export const getAddTorrentDialogueVariant = (
  preferences: Partial<AppPreferences> | null | undefined,
): AddTorrentDialogueVariant => {
  return preferences?.useFullAddTorrentDialogue === true ? 'full' : 'compact';
};

/**
 * Whether the + on a Search result opens the add-torrent dialogue (#217).
 * Defaults to true: the key is new, so users upgrading have no stored value
 * and must land on the new behavior, not on a falsy default.
 */
export const getSearchAddOpensDialogue = (
  preferences: Partial<AppPreferences> | null | undefined,
): boolean => preferences?.searchAddOpensDialogue !== false;
