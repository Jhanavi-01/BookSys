'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/components/common/Toast';
import { PlusIcon } from '@heroicons/react/24/outline';

interface ShowtimeItem {
  id: string;
  startsAt: string;
  endsAt: string;
  saleStatus: string;
  venue?: { id: string; name: string };
  _count?: { seats: number; tickets: number };
}

interface Venue {
  id: string;
  name: string;
}

export default function ShowtimesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useParams();
  const eventId = params.id as string;

  const [showtimes, setShowtimes] = useState<ShowtimeItem[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newDateTime, setNewDateTime] = useState('');
  const [newEndDateTime, setNewEndDateTime] = useState('');
  const [newVenueId, setNewVenueId] = useState('');

  useEffect(() => {
    fetchShowtimes();
    api.get('/organizer/venues').then((res) => setVenues(res.data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchShowtimes = async () => {
    try {
      const res = await api.get(`/showtimes/event/${eventId}`);
      const data = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setShowtimes(data);
    } catch {
      setShowtimes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newDateTime || !newVenueId) {
      toast('error', 'Please select a date and venue');
      return;
    }
    setCreating(true);
    try {
      const startsAt = new Date(newDateTime).toISOString();
      const endsAt = newEndDateTime
        ? new Date(newEndDateTime).toISOString()
        : new Date(new Date(newDateTime).getTime() + 3 * 60 * 60 * 1000).toISOString();

      await api.post('/showtimes', {
        eventId,
        venueId: newVenueId,
        startsAt,
        endsAt,
      });
      setNewDateTime('');
      setNewEndDateTime('');
      await fetchShowtimes();
      toast('success', t('common.states.success'));
    } catch (err: any) {
      toast('error', err?.response?.data?.message || t('errors.server.generic'));
    } finally {
      setCreating(false);
    }
  };

  const toggleSale = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ON_SALE' ? 'CLOSED' : 'ON_SALE';
    try {
      await api.patch(`/showtimes/${id}/sale-status`, { saleStatus: newStatus });
      await fetchShowtimes();
      toast('success', t('common.states.success'));
    } catch (err: any) {
      toast('error', err?.response?.data?.message || t('errors.server.generic'));
    }
  };

  const cloneShowtime = async (id: string) => {
    try {
      await api.post(`/showtimes/${id}/clone`, {});
      await fetchShowtimes();
      toast('success', t('common.states.success'));
    } catch (err: any) {
      toast('error', err?.response?.data?.message || t('errors.server.generic'));
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient">{t('organizer.showtimes.title')}</h1>
        <Link href={`/organizer/events/${eventId}`} className="btn-secondary text-sm">
          {t('common.buttons.back')}
        </Link>
      </div>

      {/* Add showtime */}
      <div className="glass-card mt-6 space-y-3 p-4">
        <p className="text-sm font-semibold text-gray-300">Add New Showtime</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Venue *</label>
            <select
              value={newVenueId}
              onChange={(e) => setNewVenueId(e.target.value)}
              className="input-field [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100"
            >
              <option value="">Select venue...</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Start Date & Time *</label>
            <input
              type="datetime-local"
              value={newDateTime}
              onChange={(e) => setNewDateTime(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">End Date & Time</label>
            <input
              type="datetime-local"
              value={newEndDateTime}
              onChange={(e) => setNewEndDateTime(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <button onClick={handleCreate} disabled={creating || !newDateTime || !newVenueId} className="btn-primary flex items-center gap-1">
          <PlusIcon className="h-4 w-4" />
          {creating ? 'Creating...' : 'Add Showtime'}
        </button>
      </div>

      {showtimes.length === 0 ? (
        <div className="mt-8 text-center text-gray-400">No showtimes added yet</div>
      ) : (
        <div className="mt-6 space-y-3">
          {showtimes.map((st) => (
            <div key={st.id} className="glass-card glass-card-hover p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-gray-100">
                    {formatDate(st.startsAt, locale)}
                  </p>
                  <p className="text-sm text-gray-400">
                    {st.venue?.name || 'No venue'} — {st._count?.tickets || 0}/{st._count?.seats || 0} tickets sold
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      st.saleStatus === 'ON_SALE'
                        ? 'badge-success'
                        : st.saleStatus === 'CLOSED'
                        ? 'bg-white/10 text-gray-400'
                        : 'badge-accent'
                    )}
                  >
                    {st.saleStatus === 'ON_SALE' ? 'On Sale' : st.saleStatus === 'CLOSED' ? 'Closed' : 'Draft'}
                  </span>
                  {st.saleStatus !== 'ON_SALE' && (
                    <button onClick={() => toggleSale(st.id, st.saleStatus)} className="btn-primary text-xs">
                      Open Sale
                    </button>
                  )}
                  {st.saleStatus === 'ON_SALE' && (
                    <button onClick={() => toggleSale(st.id, st.saleStatus)} className="btn-secondary text-xs">
                      Close Sale
                    </button>
                  )}
                  <button onClick={() => cloneShowtime(st.id)} className="btn-secondary text-xs">
                    Clone
                  </button>
                  <Link
                    href={`/organizer/events/${eventId}/showtimes/${st.id}`}
                    className="btn-secondary text-xs"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
