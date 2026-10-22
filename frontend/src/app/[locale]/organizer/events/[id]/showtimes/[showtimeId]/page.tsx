'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import SeatMap, { Seat } from '@/components/seats/SeatMap';
import SeatLegend from '@/components/seats/SeatLegend';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { toast } from '@/components/common/Toast';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface PricingCategory {
  category: string;
  price: number;
}

export default function ShowtimeDetailPage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams();
  const eventId = params.id as string;
  const showtimeId = params.showtimeId as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [seats, setSeats] = useState<Seat[]>([]);
  const [pricing, setPricing] = useState<PricingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [seatsRes, pricingRes] = await Promise.all([
          api.get(`/showtimes/${showtimeId}/seats`),
          api.get(`/organizer/showtimes/${showtimeId}/pricing`),
        ]);
        setSeats(seatsRes.data?.seats || seatsRes.data || []);
        setPricing(pricingRes.data || []);
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [showtimeId, t]);

  const handleUploadSeatMap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      await api.post(`/organizer/showtimes/${showtimeId}/seat-map`, json);
      const res = await api.get(`/showtimes/${showtimeId}/seats`);
      setSeats(res.data?.seats || res.data || []);
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updatePrice = (category: string, price: number) => {
    setPricing((prev) =>
      prev.map((p) => (p.category === category ? { ...p, price } : p))
    );
  };

  const savePricing = async () => {
    try {
      await api.put(`/organizer/showtimes/${showtimeId}/pricing`, { pricing });
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">
        {t('organizer.showtimes.edit')}
      </h1>

      {error && <ErrorMessage message={error} className="mt-4" />}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Seat Map Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">
              {t('organizer.showtimes.seatMap')}
            </h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleUploadSeatMap}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                <ArrowUpTrayIcon className="h-4 w-4" />
                {uploading ? '...' : t('organizer.showtimes.uploadSeatMap')}
              </button>
            </div>
          </div>

          {seats.length > 0 ? (
            <>
              <SeatMap
                seats={seats}
                selectedSeatIds={new Set()}
                onSeatClick={() => {}}
              />
              <SeatLegend />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 py-16 text-center text-gray-400">
              {t('organizer.showtimes.uploadSeatMap')}
            </div>
          )}
        </div>

        {/* Pricing Sidebar */}
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            {t('organizer.showtimes.pricing')}
          </h2>
          <div className="mt-4 space-y-3">
            {pricing.length === 0 ? (
              <p className="text-sm text-gray-400">{t('common.states.empty')}</p>
            ) : (
              pricing.map((p) => (
                <div key={p.category} className="glass-card p-3">
                  <label className="mb-1 block text-sm font-medium text-gray-300">
                    {p.category}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={p.price}
                      onChange={(e) => updatePrice(p.category, Number(e.target.value))}
                      className="input-field"
                      min={0}
                      step={1000}
                    />
                    <span className="text-sm text-gray-400">VND</span>
                  </div>
                </div>
              ))
            )}
            {pricing.length > 0 && (
              <button onClick={savePricing} className="btn-primary w-full">
                {t('organizer.showtimes.setPrice')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
