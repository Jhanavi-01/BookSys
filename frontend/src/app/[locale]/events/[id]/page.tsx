'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import {
  CalendarIcon,
  MapPinIcon,
  ShareIcon,
  UserIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

interface ShowtimeItem {
  id: string;
  dateTime: string;
  saleStatus: 'PENDING' | 'OPEN' | 'CLOSED';
  saleStart?: string;
  availableSeats: number;
  minPrice: number;
  maxPrice: number;
}

interface EventDetail {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  category: string;
  venueName: string;
  venueAddress: string;
  organizerName: string;
  startDate: string;
  endDate?: string;
  showtimes: ShowtimeItem[];
}

export default function EventDetailPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get(`/events/${eventId}`);
        setEvent(res.data);
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [eventId, t]);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: event?.title,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleSelectSeats = (showtimeId: string) => {
    if (!user) {
      router.push(`/auth/login?redirect=/events/${eventId}/showtimes/${showtimeId}/seats`);
      return;
    }
    router.push(`/events/${eventId}/showtimes/${showtimeId}/seats`);
  };

  if (loading) return <LoadingSpinner className="py-20" />;
  if (error) return <ErrorMessage message={error} className="mx-auto mt-10 max-w-lg" />;
  if (!event) return null;

  const saleStatusLabel = (s: ShowtimeItem) => {
    switch (s.saleStatus) {
      case 'OPEN':
        return (
          <span className="badge-success">
            {t('events.details.saleOpen')}
          </span>
        );
      case 'CLOSED':
        return (
          <span className="badge-danger">
            {t('events.details.saleClosed')}
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge-accent">
            {t('events.details.salePending')}
          </span>
        );
    }
  };

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6 lg:px-8">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-72 w-72 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        {/* Cover */}
        <div className="relative mb-8 overflow-hidden rounded-2xl border border-white/10 bg-dark-900">
          {event.coverImage ? (
            <img
              src={event.coverImage}
              alt={event.title}
              className="h-64 w-full object-cover sm:h-80 lg:h-96"
            />
          ) : (
            <div className="flex h-64 items-center justify-center bg-gradient-to-br from-orange-900/50 to-orange-600/30 sm:h-80 lg:h-96">
              <span className="text-6xl font-bold text-white/20">{event.title.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-sm font-medium uppercase text-orange-400">
                  {t(`events.categories.${event.category}` as any)}
                </span>
                <h1 className="text-gradient mt-1 text-3xl font-bold">{event.title}</h1>
              </div>
              <button
                onClick={handleShare}
                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
                title={t('events.details.shareEvent')}
              >
                <ShareIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="h-4 w-4" />
                {formatDate(event.startDate, locale, { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="h-4 w-4" />
                {event.venueName}
              </div>
              <div className="flex items-center gap-1.5">
                <UserIcon className="h-4 w-4" />
                {t('events.details.organizer')} {event.organizerName}
              </div>
            </div>

            <div className="mt-8">
              <h2 className="text-xl font-bold text-gray-100">{t('events.details.about')}</h2>
              <div
                className="prose prose-invert mt-4 max-w-none text-gray-300"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </div>

            {/* Venue Info */}
            <div className="glass-card mt-8 rounded-xl p-4">
              <h3 className="font-semibold text-gray-100">{t('events.details.venue')}</h3>
              <p className="mt-1 text-sm text-gray-300">{event.venueName}</p>
              <p className="text-sm text-gray-500">{event.venueAddress}</p>
            </div>
          </div>

          {/* Sidebar - Showtimes */}
          <div>
            <div className="sticky top-20">
              <h2 className="text-xl font-bold text-gray-100">{t('events.details.showtimes')}</h2>
              <div className="mt-4 space-y-3">
                {event.showtimes?.map((st) => (
                  <div key={st.id} className="glass-card rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-100">
                          {formatDate(st.dateTime, locale)}
                        </span>
                      </div>
                      {saleStatusLabel(st)}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {t('events.details.seatsAvailable', { count: st.availableSeats })}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-accent-400">
                      {t('events.details.priceRange', {
                        min: formatCurrency(st.minPrice, locale),
                        max: formatCurrency(st.maxPrice, locale),
                      })}
                    </div>
                    {st.saleStatus === 'OPEN' ? (
                      <button
                        onClick={() => handleSelectSeats(st.id)}
                        className="btn-primary mt-3 w-full text-sm"
                      >
                        {user ? t('events.details.selectSeats') : t('events.details.loginToBook')}
                      </button>
                    ) : st.saleStatus === 'PENDING' && st.saleStart ? (
                      <p className="mt-2 text-center text-xs text-accent-400">
                        {t('events.details.saleOpenAt', { date: formatDate(st.saleStart, locale) })}
                      </p>
                    ) : null}
                  </div>
                ))}
                {(!event.showtimes || event.showtimes.length === 0) && (
                  <p className="text-sm text-gray-500">{t('common.states.empty')}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
