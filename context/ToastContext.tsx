import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Toast, ToastType } from '../components/Toast';
import { storageService } from '../services/storage';

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
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [defaultDuration, setDefaultDuration] = useState<number>(3000);

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

  const showToast = (message: string, type: ToastType = 'info', duration?: number) => {
    setToast({ message, type, duration: duration ?? defaultDuration, id: Date.now() });
  };

  const hideToast = () => {
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast, toast, hideToast }}>
      {children}
      {/* Only render toast here on Android - iOS modal screens render their own */}
      {Platform.OS === 'android' && toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onHide={hideToast}
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
 * Component to render toast in modal screens on iOS.
 * Add this at the end of your modal screen's root view.
 */
export function ModalToast() {
  const { toast, hideToast } = useToast();
  
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

