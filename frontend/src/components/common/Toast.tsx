'use client';

import { useEffect, useState, useCallback } from 'react';
import { create } from 'zustand';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (type: ToastType, message: string, duration?: number) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (type, message, duration = 5000) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message, duration }] }));
  },
  remove: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(type: ToastType, message: string) {
  useToastStore.getState().add(type, message);
}

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onRemove, 200);
    }, item.duration || 5000);
    return () => clearTimeout(timer);
  }, [item.duration, onRemove]);

  const icons = {
    success: <CheckCircleIcon className="h-5 w-5 text-emerald-400" />,
    error: <ExclamationCircleIcon className="h-5 w-5 text-red-400" />,
    warning: <ExclamationCircleIcon className="h-5 w-5 text-yellow-400" />,
    info: <InformationCircleIcon className="h-5 w-5 text-blue-400" />,
  };

  const bgColors = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-yellow-500/10 border-yellow-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-xl transition-all duration-200',
        bgColors[item.type],
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      )}
    >
      {icons[item.type]}
      <p className="flex-1 text-sm text-gray-100">{item.message}</p>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onRemove, 200);
        }}
        className="text-gray-500 hover:text-gray-300 transition-colors"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, remove } = useToastStore();

  const handleRemove = useCallback(
    (id: string) => {
      remove(id);
    },
    [remove]
  );

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} item={t} onRemove={() => handleRemove(t.id)} />
      ))}
    </div>
  );
}
