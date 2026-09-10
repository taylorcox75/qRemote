import { renderHook } from '@testing-library/react-native';
import { useMacCommands } from '@/hooks/useMacCommands';
import {
  addCommandListener,
  isMacIdiom,
  setEnabledCommands,
  setMenuTitles,
  setWindowMinSize,
  type MacCommandId,
} from '@/modules/mac-commands';

jest.mock('@/modules/mac-commands', () => ({
  MAC_COMMAND_IDS: [
    'newTransfer',
    'refresh',
    'toggleAltSpeed',
    'resume',
    'pause',
    'delete',
    'recheck',
    'reannounce',
    'queueTop',
    'queueUp',
    'queueDown',
    'queueBottom',
    'resumeAll',
    'pauseAll',
    'find',
    'toggleSidebar',
    'preferences',
  ],
  isMacIdiom: jest.fn(),
  setEnabledCommands: jest.fn(),
  setMenuTitles: jest.fn(),
  setWindowMinSize: jest.fn(),
  addCommandListener: jest.fn(),
}));

const mockI18n = { language: 'en' };

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: mockI18n,
  }),
}));

const mockIsMacIdiom = isMacIdiom as jest.Mock;
const mockSetEnabledCommands = setEnabledCommands as jest.Mock;
const mockSetMenuTitles = setMenuTitles as jest.Mock;
const mockSetWindowMinSize = setWindowMinSize as jest.Mock;
const mockAddCommandListener = addCommandListener as jest.Mock;

describe('useMacCommands', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockI18n.language = 'en';
  });

  describe('off Mac Catalyst (isMacIdiom false)', () => {
    beforeEach(() => {
      mockIsMacIdiom.mockReturnValue(false);
    });

    it('does nothing: no listener, no menu titles, no window size, no enabled commands', async () => {
      const handlers = { refresh: jest.fn() };
      await renderHook(() => useMacCommands(handlers, ['refresh']));

      expect(mockAddCommandListener).not.toHaveBeenCalled();
      expect(mockSetMenuTitles).not.toHaveBeenCalled();
      expect(mockSetWindowMinSize).not.toHaveBeenCalled();
      expect(mockSetEnabledCommands).not.toHaveBeenCalled();
    });
  });

  describe('on Mac Catalyst (isMacIdiom true)', () => {
    beforeEach(() => {
      mockIsMacIdiom.mockReturnValue(true);
      mockAddCommandListener.mockReturnValue({ remove: jest.fn() });
    });

    it('sets menu titles, window min size, enabled commands, and subscribes a listener on mount', async () => {
      const handlers = { refresh: jest.fn() };
      await renderHook(() => useMacCommands(handlers, ['refresh', 'find']));

      expect(mockSetMenuTitles).toHaveBeenCalledTimes(1);
      const titles = mockSetMenuTitles.mock.calls[0][0];
      expect(titles.refresh).toBe('commands.refresh');
      expect(titles.transferMenu).toBe('commands.transferMenu');
      expect(titles.newTransfer).toBe('commands.newTransfer');
      expect(titles.toggleAltSpeed).toBe('commands.toggleAltSpeed');
      expect(titles.resume).toBe('commands.resume');
      expect(titles.pause).toBe('commands.pause');
      expect(titles.delete).toBe('commands.delete');
      expect(titles.recheck).toBe('commands.recheck');
      expect(titles.reannounce).toBe('commands.reannounce');
      expect(titles.queueTop).toBe('commands.queueTop');
      expect(titles.queueUp).toBe('commands.queueUp');
      expect(titles.queueDown).toBe('commands.queueDown');
      expect(titles.queueBottom).toBe('commands.queueBottom');
      expect(titles.resumeAll).toBe('commands.resumeAll');
      expect(titles.pauseAll).toBe('commands.pauseAll');
      expect(titles.find).toBe('commands.find');
      expect(titles.toggleSidebar).toBe('commands.toggleSidebar');
      expect(titles.preferences).toBe('commands.preferences');

      expect(mockSetWindowMinSize).toHaveBeenCalledWith(720, 480);
      expect(mockSetEnabledCommands).toHaveBeenCalledWith(['refresh', 'find']);
      expect(mockAddCommandListener).toHaveBeenCalledTimes(1);
    });

    it('dispatches a fired command to the matching handler', async () => {
      const refresh = jest.fn();
      const pause = jest.fn();
      await renderHook(() => useMacCommands({ refresh, pause }, ['refresh', 'pause']));

      const listenerCb = mockAddCommandListener.mock.calls[0][0] as (e: { id: string }) => void;

      listenerCb({ id: 'refresh' });
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(pause).not.toHaveBeenCalled();

      listenerCb({ id: 'pause' });
      expect(pause).toHaveBeenCalledTimes(1);
    });

    it('does not throw when a fired command has no matching handler', async () => {
      await renderHook(() => useMacCommands({}, ['refresh']));
      const listenerCb = mockAddCommandListener.mock.calls[0][0] as (e: { id: string }) => void;

      expect(() => listenerCb({ id: 'refresh' })).not.toThrow();
    });

    it('always dispatches to the latest handlers without resubscribing', async () => {
      const firstRefresh = jest.fn();
      const secondRefresh = jest.fn();
      const { rerender } = await renderHook(
        ({ handlers }: { handlers: { refresh: () => void } }) =>
          useMacCommands(handlers, ['refresh']),
        { initialProps: { handlers: { refresh: firstRefresh } } },
      );

      await rerender({ handlers: { refresh: secondRefresh } });

      // Listener subscribed only once: the mount effect doesn't re-run just
      // because the handlers object identity changed.
      expect(mockAddCommandListener).toHaveBeenCalledTimes(1);

      const listenerCb = mockAddCommandListener.mock.calls[0][0] as (e: { id: string }) => void;
      listenerCb({ id: 'refresh' });

      expect(firstRefresh).not.toHaveBeenCalled();
      expect(secondRefresh).toHaveBeenCalledTimes(1);
    });

    it('re-calls setEnabledCommands when the enabled list changes', async () => {
      const { rerender } = await renderHook(
        ({ enabled }: { enabled: MacCommandId[] }) => useMacCommands({}, enabled),
        { initialProps: { enabled: ['refresh'] as MacCommandId[] } },
      );

      expect(mockSetEnabledCommands).toHaveBeenCalledTimes(1);
      expect(mockSetEnabledCommands).toHaveBeenLastCalledWith(['refresh']);

      await rerender({ enabled: ['refresh', 'find'] as const });

      expect(mockSetEnabledCommands).toHaveBeenCalledTimes(2);
      expect(mockSetEnabledCommands).toHaveBeenLastCalledWith(['refresh', 'find']);
    });

    it('re-calls setMenuTitles when the language changes, without resubscribing the listener', async () => {
      const { rerender } = await renderHook(() => useMacCommands({}, ['refresh']));

      expect(mockSetMenuTitles).toHaveBeenCalledTimes(1);

      mockI18n.language = 'fr';
      await rerender({});

      expect(mockSetMenuTitles).toHaveBeenCalledTimes(2);
      // The listener subscription effect is keyed on [active] only, so a
      // language change must not tear it down and resubscribe.
      expect(mockAddCommandListener).toHaveBeenCalledTimes(1);
    });

    it('does not re-call setEnabledCommands when the enabled list is equal but a new array instance', async () => {
      const { rerender } = await renderHook(
        ({ enabled }: { enabled: MacCommandId[] }) => useMacCommands({}, enabled),
        { initialProps: { enabled: ['refresh', 'find'] as MacCommandId[] } },
      );

      expect(mockSetEnabledCommands).toHaveBeenCalledTimes(1);

      await rerender({ enabled: ['refresh', 'find'] });

      expect(mockSetEnabledCommands).toHaveBeenCalledTimes(1);
    });

    it('removes the listener subscription on unmount', async () => {
      const remove = jest.fn();
      mockAddCommandListener.mockReturnValue({ remove });

      const { unmount } = await renderHook(() => useMacCommands({}, ['refresh']));
      await unmount();

      expect(remove).toHaveBeenCalledTimes(1);
    });

    it('computes isMacIdiom only once even across re-renders', async () => {
      const { rerender } = await renderHook(() => useMacCommands({}, ['refresh']), {
        initialProps: { n: 1 },
      });
      await rerender({ n: 2 });
      await rerender({ n: 3 });

      expect(mockIsMacIdiom).toHaveBeenCalledTimes(1);
    });
  });
});
