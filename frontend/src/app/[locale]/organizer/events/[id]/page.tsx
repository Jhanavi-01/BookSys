'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import ErrorMessage from '@/components/common/ErrorMessage';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/components/common/Toast';

const CATEGORIES = [
  'music', 'sports', 'theater', 'comedy', 'arts', 'technology',
  'festival', 'family', 'conference', 'workshop', 'exhibition',
];

export default function EditEventPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const eventId = params.id as string;

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'music',
    venueId: '',
    startDate: '',
    endDate: '',
    coverImage: '',
  });
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventRes, venuesRes] = await Promise.all([
          api.get(`/events/${eventId}`),
          api.get('/organizer/venues'),
        ]);
        const e = eventRes.data;
        setForm({
          title: e.title || '',
          description: e.description || '',
          category: e.category || 'music',
          venueId: e.showtimes?.[0]?.venue?.id || e.venueId || '',
          startDate: e.startDate ? new Date(e.startDate).toISOString().slice(0, 16) : '',
          endDate: e.endDate ? new Date(e.endDate).toISOString().slice(0, 16) : '',
          coverImage: e.coverImage || e.imageUrl || '',
        });
        setVenues(venuesRes.data || []);
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, t]);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.put(`/events/${eventId}`, {
        title: form.title,
        description: form.description,
        category: form.category,
        imageUrl: form.coverImage || undefined,
      });
      toast('success', t('common.states.success'));
    } catch {
      setError(t('errors.server.generic'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gradient">{t('organizer.events.edit')}</h1>

      <div className="glass-card mt-6 p-6">
        {error && <ErrorMessage message={error} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {t('organizer.events.eventName')}
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">
              {t('organizer.events.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              className="input-field min-h-[120px]"
              rows={5}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t('organizer.events.category')}
              </label>
              <select value={form.category} onChange={(e) => update('category', e.target.value)} className="input-field [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100">
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{t(`events.categories.${cat}` as any)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t('organizer.events.venue')}
              </label>
              <select value={form.venueId} onChange={(e) => update('venueId', e.target.value)} className="input-field [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100">
                <option value="">--</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.events.startDate')}</label>
              <input type="datetime-local" value={form.startDate} onChange={(e) => update('startDate', e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.events.endDate')}</label>
              <input type="datetime-local" value={form.endDate} onChange={(e) => update('endDate', e.target.value)} className="input-field" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.events.coverImage')}</label>
            <input type="url" value={form.coverImage} onChange={(e) => update('coverImage', e.target.value)} className="input-field" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('common.states.saving') : t('common.buttons.save')}
            </button>
            <button type="button" onClick={() => router.push('/organizer/events')} className="btn-secondary">
              {t('common.buttons.back')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
