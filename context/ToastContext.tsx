import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Toast, ToastType } from '../components/Toast';
import { storageService } from '../services/storage';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; type: ToastType; duration: number } | null>(null);
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
    setToast({ message, type, duration: duration ?? defaultDuration });
  };

  const hideToast = () => {
    setToast(null);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
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

