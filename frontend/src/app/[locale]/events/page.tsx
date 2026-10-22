'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import RotatingBadge from '@/components/common/RotatingBadge';

interface EventItem {
  id: string;
  title: string;
  coverImage?: string;
  startDate: string;
  venueName: string;
  minPrice: number;
  maxPrice: number;
  category: string;
  featured: boolean;
  soldOut: boolean;
}

const CATEGORIES = [
  'music', 'sports', 'theater', 'comedy', 'arts', 'technology',
  'festival', 'family', 'conference', 'workshop', 'exhibition',
];

export default function EventsListingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(
    async (reset: boolean = false) => {
      if (reset) {
        setLoading(true);
        setEvents([]);
        setCursor(null);
      } else {
        setLoadingMore(true);
      }
      setError('');

      try {
        const params: Record<string, string> = { limit: '12' };
        if (query) params.q = query;
        if (category) params.category = category;
        if (!reset && cursor) params.cursor = cursor;

        const res = await api.get('/events', { params });
        const data = res.data;
        const newEvents = data.content || data.items || data || [];
        const nextCursor = data.nextCursor || null;

        if (reset) {
          setEvents(newEvents);
        } else {
          setEvents((prev) => [...prev, ...newEvents]);
        }
        setCursor(nextCursor);
        setHasMore(!!nextCursor && newEvents.length > 0);
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, category, cursor, t]
  );

  useEffect(() => {
    fetchEvents(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents(true);
  };

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6 lg:px-8">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-80 w-80 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-60 w-60 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-gradient text-3xl font-bold">{t('events.listing.title')}</h1>
            <p className="mt-1 text-gray-400">{t('events.listing.subtitle')}</p>
          </div>
          <div className="hidden md:block">
            <RotatingBadge />
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <form onSubmit={handleSearch} className="flex flex-1">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('events.listing.searchPlaceholder')}
                className="input-field pl-10"
              />
            </div>
          </form>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">{t('events.listing.allCategories')}</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {t(`events.categories.${cat}` as any)}
              </option>
            ))}
          </select>
        </div>

        {error && <ErrorMessage message={error} className="mb-6" />}

        {loading ? (
          <LoadingSpinner className="py-20" />
        ) : events.length === 0 ? (
          <div className="glass-card rounded-xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-gray-500">{t('events.listing.noEvents')}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="glass-card glass-card-hover group overflow-hidden rounded-xl"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-dark-900">
                    {event.coverImage ? (
                      <img
                        src={event.coverImage}
                        alt={event.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-orange-900/50 to-orange-700/30">
                        <SparklesIcon className="h-10 w-10 text-orange-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute left-2 top-2 flex gap-1">
                      {event.featured && (
                        <span className="badge-accent">
                          {t('events.listing.featuredBadge')}
                        </span>
                      )}
                      {event.soldOut && (
                        <span className="badge-danger">
                          {t('events.listing.soldOutBadge')}
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-sm font-semibold text-white line-clamp-2 drop-shadow-lg">
                        {event.title}
                      </h3>
                      <p className="mt-1 text-sm font-semibold text-amber-400 drop-shadow-lg">
                        {t('events.listing.from')} {formatCurrency(event.minPrice, locale)}
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <span className="badge-accent text-xs">
                      {t(`events.categories.${event.category}` as any)}
                    </span>
                    <p className="mt-2 text-xs text-gray-500">
                      {formatShortDate(event.startDate, locale)} &middot; {event.venueName}
                    </p>
                  </div>
                </Link>
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchEvents(false)}
                  disabled={loadingMore}
                  className="btn-secondary"
                >
                  {loadingMore ? t('common.states.loading') : t('common.buttons.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
