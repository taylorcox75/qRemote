import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Toast, ToastType } from '@/components/Toast';
import { storageService } from '@/services/storage';

interface ToastState {
  message: string;
  type: ToastType;
  duration: number;
  id: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  toast: ToastState | null;
  hideToast: () => void;
  /** Internal — ModalToast mounts register here so the global toast yields. */
  registerModalHost: () => () => void;
  /** Screens with a tall custom header (search bar, buttons overlaying the
   *  top safe area) call this while focused so the global toast renders
   *  below that header instead of at the default safe-area offset. Pass
   *  `null` to go back to the default. */
  setToastTopOffset: (offset: number | null) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [defaultDuration, setDefaultDuration] = useState<number>(3000);
  // Number of currently-mounted ModalToast hosts (screens presented as
  // native modal sheets). While one is mounted on iOS, the global toast
  // below stays unrendered — otherwise both would show the same toast
  // (one in the sheet's layer, a ghost copy behind it, both visible during
  // an interactive sheet dismissal).
  const [modalHostCount, setModalHostCount] = useState(0);
  const [topOffsetOverride, setTopOffsetOverride] = useState<number | null>(null);

  const registerModalHost = useCallback(() => {
    setModalHostCount((n) => n + 1);
    return () => setModalHostCount((n) => Math.max(0, n - 1));
  }, []);

  const setToastTopOffset = useCallback((offset: number | null) => {
    setTopOffsetOverride(offset);
  }, []);

  // Load toast duration preference
  useEffect(() => {
    const loadToastDuration = async () => {
      try {
        const prefs = await storageService.getPreferences();
        if (prefs.toastDuration && typeof prefs.toastDuration === 'number') {
          setDefaultDuration(prefs.toastDuration);
        }
      } catch (error) {
        // Use default 3000ms if loading fails
      }
    };
    loadToastDuration();
  }, []);

  // Stable identity: callers routinely list showToast/hideToast in their own
  // effect dependency arrays. Recreating them every render (as plain
  // functions would) makes those effects re-fire in a loop whenever their
  // other trigger condition stays true across renders — setToast() here
  // causes this provider to re-render, which would hand out a new function
  // reference, which the consuming effect sees as a "changed" dependency.
  const showToast = useCallback(
    (message: string, type: ToastType = 'info', duration?: number) => {
      setToast({ message, type, duration: duration ?? defaultDuration, id: Date.now() });
    },
    [defaultDuration],
  );

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  const contextValue = useMemo(
    () => ({ showToast, toast, hideToast, registerModalHost, setToastTopOffset }),
    [showToast, toast, hideToast, registerModalHost, setToastTopOffset],
  );

  // On iOS, yield to a mounted ModalToast host: rendering both would show
  // the same toast twice (the local one in the sheet's layer, this one as a
  // ghost copy behind it, both visible during an interactive dismissal).
  const suppressGlobal = Platform.OS === 'ios' && modalHostCount > 0;

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Always a plain view, never wrapped in a native Modal — a Modal
          captures every touch on screen at the native layer regardless of
          pointerEvents settings on its content, freezing the rest of the UI
          until the toast times out. This mount lives above the Stack
          navigator, so a screen presented as its own native modal sheet
          (its own separate native layer) would render this behind that
          sheet — those screens mount <ModalToast/> locally instead, which
          renders the exact same plain view but from within their own tree,
          so it's already in the right layer without needing any Modal. */}
      {toast && !suppressGlobal && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={hideToast}
          topOffsetOverride={topOffsetOverride ?? undefined}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

/**
 * Toast for screens presented as a native modal sheet (`presentation:
 * 'modal'` in the Stack navigator) — server/add.tsx, server/[id].tsx. That
 * presentation is its own separate native layer on iOS, so the global toast
 * mounted above the Stack navigator would render behind it. Mounting this
 * plain (non-Modal — see the comment on the global mount above for why)
 * Toast locally, as a child of the modal screen's own tree, puts it in the
 * same layer as that screen's content with no extra wrapping needed. Only
 * does anything on iOS — Android's global toast already layers above
 * everything there, so rendering this too would just show it twice.
 */
export function ModalToast() {
  const { toast, hideToast, registerModalHost } = useToast();

  // Register as the active toast host so the provider's global toast yields
  // while this screen is mounted (prevents the same toast rendering twice).
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    return registerModalHost();
  }, [registerModalHost]);

  if (Platform.OS !== 'ios' || !toast) {
    return null;
  }

  return (
    <Toast
      key={toast.id}
      message={toast.message}
      type={toast.type}
      duration={toast.duration}
      onHide={hideToast}
    />
  );
}

