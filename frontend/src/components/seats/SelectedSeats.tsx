'use client';

import { useTranslations, useLocale } from 'next-intl';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Seat } from './SeatMap';
import { formatCurrency } from '@/lib/utils';

interface SelectedSeatsProps {
  seats: Seat[];
  onRemove: (seatId: string) => void;
  onBook: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function SelectedSeats({
  seats,
  onRemove,
  onBook,
  disabled = false,
  loading = false,
}: SelectedSeatsProps) {
  const t = useTranslations('seats');
  const locale = useLocale();
  const total = seats.reduce((sum, s) => sum + (s.price || 0), 0);

  return (
    <div className="glass-card overflow-hidden rounded-xl">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-100">
          {t('status.yours')}
        </h3>
        <p className="text-xs text-gray-500">
          {t('selection.selectedCount', { count: seats.length })}
        </p>
      </div>

      {seats.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          {t('selection.noSelection')}
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {seats.map((seat) => (
            <div
              key={seat.id}
              className="flex items-center justify-between border-b border-white/5 px-4 py-2 last:border-0"
            >
              <div>
                <p className="text-sm font-medium text-gray-100">
                  {t('tooltip.row')} {seat.row}, {t('tooltip.seat')} {seat.number}
                </p>
                <p className="text-xs text-gray-500">
                  {seat.category} - {formatCurrency(seat.price || 0, locale)}
                </p>
              </div>
              <button
                onClick={() => onRemove(seat.id)}
                className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-400">
            {t('selection.totalPrice', { price: '' })}
          </span>
          <span className="text-lg font-bold text-accent-400">
            {formatCurrency(total, locale)}
          </span>
        </div>
        <button
          onClick={onBook}
          disabled={seats.length === 0 || disabled || loading}
          className="btn-primary w-full"
        >
          {loading ? '...' : t('selection.bookNow')}
        </button>
      </div>
    </div>
  );
}
