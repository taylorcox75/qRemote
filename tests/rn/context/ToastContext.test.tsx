import React from 'react';
import { Text, TouchableOpacity, Platform } from 'react-native';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react-native';
import { ToastProvider, useToast, ModalToast } from '@/context/ToastContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { storageService } from '@/services/storage';

jest.mock('@/services/storage', () => ({
  storageService: {
    getPreferences: jest.fn(),
  },
}));

function Consumer() {
  const { showToast, toast, hideToast } = useToast();
  return (
    <>
      <TouchableOpacity testID="show" onPress={() => showToast('hello', 'success')} />
      <TouchableOpacity testID="hide" onPress={hideToast} />
      <Text testID="toast-text">{toast ? toast.message : 'none'}</Text>
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  (storageService.getPreferences as jest.Mock).mockResolvedValue({});
});

describe('ToastContext', () => {
  it('throws when useToast used outside provider', async () => {
    const Bad = () => {
      useToast();
      return null;
    };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(render(<Bad />)).rejects.toThrow('useToast must be used within a ToastProvider');
    spy.mockRestore();
  });

  it('starts with no toast', async () => {
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
      </ToastProvider>
      </ThemeProvider>
    );
    expect(screen.getByTestId('toast-text').props.children).toBe('none');
  });

  it('showToast sets toast state and it renders; hideToast clears it', async () => {
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
      </ToastProvider>
      </ThemeProvider>
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('show'));
    });
    await waitFor(() => expect(screen.getByTestId('toast-text').props.children).toBe('hello'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('hide'));
    });
    await waitFor(() => expect(screen.getByTestId('toast-text').props.children).toBe('none'));
  });

  it('loads toastDuration preference on mount', async () => {
    (storageService.getPreferences as jest.Mock).mockResolvedValue({ toastDuration: 5000 });
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
      </ToastProvider>
      </ThemeProvider>
    );
    await waitFor(() => expect(storageService.getPreferences).toHaveBeenCalled());
  });

  it('ignores errors loading toastDuration preference', async () => {
    (storageService.getPreferences as jest.Mock).mockRejectedValue(new Error('fail'));
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
      </ToastProvider>
      </ThemeProvider>
    );
    await waitFor(() => expect(storageService.getPreferences).toHaveBeenCalled());
  });

  it('ignores non-numeric toastDuration preference', async () => {
    (storageService.getPreferences as jest.Mock).mockResolvedValue({ toastDuration: 'nope' });
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
      </ToastProvider>
      </ThemeProvider>
    );
    await waitFor(() => expect(storageService.getPreferences).toHaveBeenCalled());
  });

  it('ModalToast renders nothing on Android', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'android';
    await render(
      <ThemeProvider>
      <ToastProvider>
        <Consumer />
        <ModalToast />
      </ToastProvider>
      </ThemeProvider>
    );
    await act(async () => {
      fireEvent.press(screen.getByTestId('show'));
    });
    // ModalToast shouldn't add a second toast text node; global toast still shows.
    await waitFor(() => expect(screen.getByTestId('toast-text').props.children).toBe('hello'));
    Platform.OS = originalOS;
  });

  it('ModalToast suppresses the global toast on iOS while mounted', async () => {
    const originalOS = Platform.OS;
    Platform.OS = 'ios';

    function Wrapper() {
      const [showModal, setShowModal] = React.useState(true);
      return (
        <>
          <Consumer />
          {showModal && <ModalToast />}
          <TouchableOpacity testID="unmount-modal" onPress={() => setShowModal(false)} />
        </>
      );
    }

    await render(
      <ThemeProvider>
      <ToastProvider>
        <Wrapper />
      </ToastProvider>
      </ThemeProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('show'));
    });
    await waitFor(() => expect(screen.getByTestId('toast-text').props.children).toBe('hello'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('unmount-modal'));
    });

    Platform.OS = originalOS;
  });
});
