import { create } from 'zustand';
import type { ToastItem } from '../types';

interface ToastState {
  toasts: ToastItem[];
  addToast: (
    type: ToastItem['type'],
    message: string,
    duration?: number,
  ) => void;
  removeToast: (id: string) => void;
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],

  addToast: (type, message, duration = 3000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: ToastItem = { id, type, message, duration };

    set((s) => ({ toasts: [...s.toasts, toast] }));

    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, duration);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
