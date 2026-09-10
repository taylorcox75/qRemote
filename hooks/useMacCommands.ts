/**
 * useMacCommands.ts - wires the Mac Catalyst menu bar (Pogona's File/View/
 * Transfer menus, see modules/mac-commands) to in-app handlers.
 *
 * No-ops entirely off Mac Catalyst: isMacIdiom() is read once (native
 * module reports false on iOS/jest), and every effect below is gated on
 * that. Hooks are still called unconditionally per the rules of hooks; only
 * their *bodies* are conditional.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  addCommandListener,
  isMacIdiom,
  setEnabledCommands,
  setMenuTitles,
  setWindowMinSize,
  type MacCommandId,
} from '@/modules/mac-commands';

const MAC_MIN_WINDOW_WIDTH = 720;
const MAC_MIN_WINDOW_HEIGHT = 480;

export function useMacCommands(
  handlers: Partial<Record<MacCommandId, () => void>>,
  enabled: MacCommandId[],
): void {
  const { t, i18n } = useTranslation();

  // Computed once: the idiom can't change for the life of the process.
  const active = useMemo(() => isMacIdiom(), []);

  // Keep the latest handlers available to the listener without resubscribing.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!active) {
      return;
    }

    setWindowMinSize(MAC_MIN_WINDOW_WIDTH, MAC_MIN_WINDOW_HEIGHT);

    const subscription = addCommandListener(({ id }) => {
      handlersRef.current[id]?.();
    });

    return () => {
      subscription.remove();
    };
  }, [active]);

  // Kept on its own effect, keyed on the current language, so an in-session
  // language switch (app/(tabs)/settings/appearance.tsx calls
  // i18n.changeLanguage) refreshes the menu bar's titles like every other
  // string in the app rather than waiting for a process restart.
  useEffect(() => {
    if (!active) {
      return;
    }

    setMenuTitles({
      newTransfer: t('commands.newTransfer'),
      refresh: t('commands.refresh'),
      toggleAltSpeed: t('commands.toggleAltSpeed'),
      resume: t('commands.resume'),
      pause: t('commands.pause'),
      delete: t('commands.delete'),
      recheck: t('commands.recheck'),
      reannounce: t('commands.reannounce'),
      queueTop: t('commands.queueTop'),
      queueUp: t('commands.queueUp'),
      queueDown: t('commands.queueDown'),
      queueBottom: t('commands.queueBottom'),
      resumeAll: t('commands.resumeAll'),
      pauseAll: t('commands.pauseAll'),
      find: t('commands.find'),
      toggleSidebar: t('commands.toggleSidebar'),
      preferences: t('commands.preferences'),
      transferMenu: t('commands.transferMenu'),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, i18n.language]);

  const enabledKey = enabled.join(',');

  useEffect(() => {
    if (!active) {
      return;
    }
    setEnabledCommands(enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, enabledKey]);
}
