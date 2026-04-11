import { AppPreferences } from '@/types/preferences';

export type AddTorrentDialogueVariant = 'compact' | 'full';

export const getAddTorrentDialogueVariant = (
  preferences: Partial<AppPreferences> | null | undefined
): AddTorrentDialogueVariant => {
  return preferences?.useFullAddTorrentDialogue === true ? 'full' : 'compact';
};
