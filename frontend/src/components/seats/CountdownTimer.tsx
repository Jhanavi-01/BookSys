'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ClockIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  expiresAt: string | Date;
  onExpired?: () => void;
  className?: string;
  label?: string;
}

function computeRemaining(expiresAt: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
}

export default function CountdownTimer({
  expiresAt,
  onExpired,
  className,
  label,
}: CountdownTimerProps) {
  const t = useTranslations('booking.countdown');
  const expDate = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const [remaining, setRemaining] = useState(() => computeRemaining(expDate));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = computeRemaining(expDate);
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [expDate, onExpired]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining <= 60;
  const isExpired = remaining <= 0;

  if (isExpired) {
    return (
      <div className={cn('rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-center backdrop-blur-sm', className)}>
        <p className="text-sm font-semibold text-red-400">{t('expired')}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border p-3 backdrop-blur-sm',
        isUrgent
          ? 'border-red-500/20 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
          : 'border-accent-500/20 bg-accent-500/10 shadow-[0_0_20px_rgba(234,179,8,0.1)]',
        className
      )}
    >
      <ClockIcon className={cn('h-5 w-5', isUrgent ? 'text-red-400' : 'text-accent-400')} />
      <div className="flex-1">
        {label && <p className="text-xs text-gray-400">{label || t('title')}</p>}
        <p
          className={cn(
            'font-mono text-lg font-bold',
            isUrgent
              ? 'animate-pulse text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]'
              : 'text-accent-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]'
          )}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}
