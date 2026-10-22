'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import SeatMap, { Seat } from '@/components/seats/SeatMap';
import SeatLegend from '@/components/seats/SeatLegend';
import SelectedSeats from '@/components/seats/SelectedSeats';
import CountdownTimer from '@/components/seats/CountdownTimer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

const MAX_SEATS = 10;

export default function SeatSelectionPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const eventId = params.id as string;
  const showtimeId = params.showtimeId as string;

  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);

  // Fetch seat map and any existing held seats
  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const mapRes = await api.get(`/seats/showtime/${showtimeId}/status`);

        const rawSeats = Array.isArray(mapRes.data) ? mapRes.data : (mapRes.data.seats || []);
        const seatData: Seat[] = rawSeats.map((s: any) => ({
          id: s.id,
          row: s.row,
          number: s.number,
          x: s.x,
          y: s.y,
          status: s.status,
          category: s.category?.name || s.category || '',
          price: s.category?.price || s.price || 0,
          color: s.category?.color || s.color || undefined,
          section: s.section?.name || s.section || '',
        }));
        setSeats(seatData);

        // Try to restore held seats
        try {
          const holdRes = await api.get(`/reservations/showtime/${showtimeId}`);
          if (holdRes.data?.seats?.length > 0) {
            const heldIds = new Set<string>(holdRes.data.seats.map((s: any) => s.seatId || s.id));
            setSelectedIds(heldIds);
            if (holdRes.data.expiresAt) {
              setHoldExpiresAt(holdRes.data.expiresAt);
            }
          }
        } catch {
          // No held seats or not authenticated - that's fine
        }
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
      }
    };
    fetchSeats();
  }, [showtimeId, t]);

  const handleSeatClick = useCallback(
    (seat: Seat) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(seat.id)) {
          next.delete(seat.id);
        } else {
          if (next.size >= MAX_SEATS) return prev;
          next.add(seat.id);
        }
        return next;
      });
    },
    []
  );

  const handleRemove = useCallback((seatId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(seatId);
      return next;
    });
  }, []);

  const handleBook = async () => {
    if (!user) {
      router.push(`/auth/login?redirect=/events/${eventId}/showtimes/${showtimeId}/seats`);
      return;
    }

    if (selectedIds.size === 0) return;

    setBooking(true);
    setError('');

    try {
      // Step 1: Hold the seats
      const holdRes = await api.post('/reservations/hold', {
        showtimeId,
        seatIds: Array.from(selectedIds),
      });

      if (holdRes.data?.expiresAt) {
        setHoldExpiresAt(holdRes.data.expiresAt);
      }

      // Step 2: Create order from held seats (no seatIds - uses held seats)
      const res = await api.post('/orders', {
        showtimeId,
      });
      const orderId = res.data.id || res.data.orderId;
      router.push(`/booking/${orderId}`);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.message || '';
      if (code === 'SEATS_UNAVAILABLE' || message.includes('already held') || message.includes('not available')) {
        setError(t('errors.booking.seatsUnavailable'));
        // Refresh seat map
        const mapRes = await api.get(`/seats/showtime/${showtimeId}/status`);
        const rawSeats = Array.isArray(mapRes.data) ? mapRes.data : (mapRes.data.seats || []);
        setSeats(rawSeats.map((s: any) => ({
          id: s.id, row: s.row, number: s.number, x: s.x, y: s.y,
          status: s.status,
          category: s.category?.name || s.category || '',
          price: s.category?.price || s.price || 0,
          color: s.category?.color || s.color || undefined,
          section: s.section?.name || s.section || '',
        })));
        setSelectedIds(new Set());
      } else if (code === 'SALE_CLOSED') {
        setError(t('errors.booking.saleClosed'));
      } else {
        setError(message || t('errors.server.generic'));
      }
    } finally {
      setBooking(false);
    }
  };

  const handleHoldExpired = useCallback(() => {
    setSelectedIds(new Set());
    setHoldExpiresAt(null);
    setError(t('booking.reservation.expired'));
  }, [t]);

  const selectedSeats = seats.filter((s) => selectedIds.has(s.id));

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-6 sm:px-6 lg:px-8">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute bottom-10 right-1/3 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-4">
          <h1 className="text-gradient text-2xl font-bold">{t('seats.selection.title')}</h1>
          <p className="text-sm text-gray-400">{t('seats.selection.subtitle')}</p>
          <p className="text-xs text-gray-500">
            {t('seats.selection.maxSeats', { max: MAX_SEATS })}
          </p>
        </div>

        {error && <ErrorMessage message={error} className="mb-4" />}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Map */}
          <div className="space-y-3">
            <SeatMap
              seats={seats}
              selectedSeatIds={selectedIds}
              onSeatClick={handleSeatClick}
            />
            <SeatLegend />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {holdExpiresAt && (
              <CountdownTimer
                expiresAt={holdExpiresAt}
                onExpired={handleHoldExpired}
                label={t('booking.reservation.timeRemaining')}
              />
            )}
            <SelectedSeats
              seats={selectedSeats}
              onRemove={handleRemove}
              onBook={handleBook}
              loading={booking}
              disabled={!user}
            />
            {!user && (
              <p className="text-center text-sm text-accent-400">
                {t('seats.selection.loginRequired')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
