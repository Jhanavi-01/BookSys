'use client';

import { useTranslations } from 'next-intl';

const LEGEND_ITEMS = [
  { status: 'available', color: '#22c55e' },
  { status: 'selected', color: '#818cf8' },
  { status: 'held', color: '#f97316' },
  { status: 'sold', color: '#ef4444' },
  { status: 'blocked', color: '#4b5563' },
] as const;

export default function SeatLegend() {
  const t = useTranslations('seats');

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
      <span className="text-sm font-semibold text-gray-300">{t('map.legend')}:</span>
      {LEGEND_ITEMS.map(({ status, color }) => (
        <div key={status} className="flex items-center gap-1.5">
          <span
            className="inline-block h-4 w-4 rounded-full border border-white/10"
            style={{ backgroundColor: color }}
          />
          <span className="text-xs text-gray-400">{t(`status.${status}`)}</span>
        </div>
      ))}
    </div>
  );
}
