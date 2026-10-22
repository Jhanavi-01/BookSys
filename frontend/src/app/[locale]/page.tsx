'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  MagnifyingGlassIcon,
  MusicalNoteIcon,
  TrophyIcon,
  FilmIcon,
  FaceSmileIcon,
  PaintBrushIcon,
  CpuChipIcon,
  SparklesIcon,
  UserGroupIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  BuildingLibraryIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/api';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import RotatingBadge from '@/components/common/RotatingBadge';

interface EventCard {
  id: string;
  title: string;
  coverImage?: string;
  startDate: string;
  venueName: string;
  minPrice: number;
  maxPrice: number;
  category: string;
  featured: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  music: MusicalNoteIcon,
  sports: TrophyIcon,
  theater: FilmIcon,
  comedy: FaceSmileIcon,
  arts: PaintBrushIcon,
  technology: CpuChipIcon,
  festival: SparklesIcon,
  family: UserGroupIcon,
  conference: AcademicCapIcon,
  workshop: WrenchScrewdriverIcon,
  exhibition: BuildingLibraryIcon,
};

export default function HomePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [searchQuery, setSearchQuery] = useState('');
  const [featured, setFeatured] = useState<EventCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await api.get('/events', { params: { featured: true, limit: 6 } });
        setFeatured(res.data?.content || res.data || []);
      } catch {
        setFeatured([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();
  }, []);

  const categories = [
    'music', 'sports', 'theater', 'comedy', 'arts', 'technology',
    'festival', 'family', 'conference', 'workshop', 'exhibition',
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 py-24 sm:py-32">
        {/* Gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-30 blur-[120px]"
            style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, rgba(234, 88, 12, 0.3) 40%, transparent 70%)' }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] translate-x-1/2 translate-y-1/2 rounded-full opacity-25 blur-[100px]"
            style={{ background: 'radial-gradient(circle, rgba(251, 191, 36, 0.5) 0%, rgba(245, 158, 11, 0.2) 40%, transparent 70%)' }}
          />
          <div
            className="absolute left-1/2 top-3/4 h-[300px] w-[300px] -translate-x-1/2 rounded-full opacity-20 blur-[80px]"
            style={{ background: 'radial-gradient(circle, rgba(234, 88, 12, 0.4) 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1 className="text-gradient text-5xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            {t('home.hero.title')}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-400">
            {t('home.hero.subtitle')}
          </p>

          {/* Glassmorphism search bar */}
          <div className="glass-card mx-auto mt-10 flex max-w-xl items-center overflow-hidden">
            <div className="flex flex-1 items-center px-4">
              <MagnifyingGlassIcon className="h-5 w-5 flex-shrink-0 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('home.hero.searchPlaceholder')}
                className="w-full border-0 bg-transparent px-3 py-3.5 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    window.location.href = `/${locale}/events?q=${encodeURIComponent(searchQuery)}`;
                  }
                }}
              />
            </div>
            <Link
              href={`/events${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`}
              className="btn-accent m-1.5 rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              {t('home.hero.searchButton')}
            </Link>
          </div>

          <div className="mt-10 flex justify-center">
            <RotatingBadge />
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-100">{t('home.featured.title')}</h2>
            <p className="mt-1 text-sm text-gray-400">{t('home.featured.subtitle')}</p>
          </div>
          <Link
            href="/events"
            className="text-sm font-semibold text-orange-400 transition-colors hover:text-orange-300"
          >
            {t('home.featured.viewAll')} &rarr;
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner className="py-12" />
        ) : featured.length > 0 ? (
          <div className="animate-fade-in grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="glass-card-hover group overflow-hidden"
              >
                <div className="relative aspect-[16/9] overflow-hidden">
                  {event.coverImage ? (
                    <img
                      src={event.coverImage}
                      alt={event.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-dark-800 to-dark-700">
                      <SparklesIcon className="h-12 w-12 text-orange-500/40" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  {event.featured && (
                    <span className="badge-accent absolute left-3 top-3">
                      {t('events.listing.featuredBadge')}
                    </span>
                  )}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-base font-semibold text-white line-clamp-2 drop-shadow-lg">
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
                  <p className="mt-2 text-sm text-gray-500">
                    {formatShortDate(event.startDate, locale)} &middot; {event.venueName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="glass-card border-dashed py-12 text-center">
            <p className="text-gray-500">{t('events.listing.noEvents')}</p>
            <Link href="/events" className="btn-primary mt-4 inline-flex">
              {t('common.buttons.viewAll')}
            </Link>
          </div>
        )}
      </section>

      {/* Categories */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold text-gray-100">{t('home.categories.title')}</h2>
            <p className="mt-1 text-sm text-gray-400">{t('home.categories.subtitle')}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || SparklesIcon;
              return (
                <Link
                  key={cat}
                  href={`/events?category=${cat}`}
                  className="glass-card-hover group flex flex-col items-center gap-3 p-5 text-center"
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl transition-shadow duration-300 group-hover:shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                    style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(234, 88, 12, 0.15) 100%)' }}
                  >
                    <Icon className="h-6 w-6 text-orange-400 transition-colors group-hover:text-orange-300" />
                  </div>
                  <span className="text-sm font-medium text-gray-300 transition-colors group-hover:text-white">
                    {t(`events.categories.${cat}` as any)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA + Stats */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="glass-card glass-border-glow glass-shine relative p-10 text-center sm:p-14">
            {/* Inner glow orb */}
            <div
              className="pointer-events-none absolute left-1/2 top-0 h-[200px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[80px]"
              style={{ background: 'radial-gradient(circle, rgba(249, 115, 22, 0.6) 0%, transparent 70%)' }}
            />

            <h2 className="relative text-3xl font-bold text-gradient">
              {t('home.cta.title')}
            </h2>
            <p className="relative mt-3 text-gray-400">{t('home.cta.subtitle')}</p>
            <Link href="/auth/register" className="btn-accent relative mt-6 inline-flex text-lg">
              {t('home.cta.button')}
            </Link>

            <div className="glass-divider relative mt-10" />

            <div className="relative mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {(['events', 'tickets', 'organizers', 'cities'] as const).map((stat) => (
                <div key={stat}>
                  <p className="text-xl font-bold text-accent-400">
                    {t(`home.cta.stats.${stat}`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
