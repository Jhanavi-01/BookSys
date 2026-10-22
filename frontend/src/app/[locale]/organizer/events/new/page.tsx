'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import api from '@/lib/api';
import ErrorMessage from '@/components/common/ErrorMessage';
import { toast } from '@/components/common/Toast';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

const CATEGORIES = [
  'music', 'sports', 'theater', 'comedy', 'arts', 'technology',
  'festival', 'family', 'conference', 'workshop', 'exhibition',
];

interface Venue {
  id: string;
  name: string;
}

interface TicketTier {
  name: string;
  price: number;
  rows: number;
  seatsPerRow: number;
  color: string;
}

const DEFAULT_TIERS: TicketTier[] = [
  { name: 'VIP', price: 2000000, rows: 3, seatsPerRow: 10, color: '#FFD700' },
  { name: 'Standard', price: 800000, rows: 5, seatsPerRow: 15, color: '#4CAF50' },
];

const TIER_COLORS = ['#FFD700', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0', '#FF5722'];

export default function CreateEventPage() {
  const t = useTranslations();
  const router = useRouter();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'music',
    venueId: '',
    startDate: '',
    endDate: '',
    coverImage: '',
  });
  const [tiers, setTiers] = useState<TicketTier[]>(DEFAULT_TIERS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/organizer/venues').then((res) => setVenues(res.data || [])).catch(() => {});
  }, []);

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateTier = (index: number, key: keyof TicketTier, value: any) => {
    setTiers((prev) => prev.map((t, i) => i === index ? { ...t, [key]: value } : t));
  };

  const addTier = () => {
    const colorIndex = tiers.length % TIER_COLORS.length;
    setTiers((prev) => [...prev, {
      name: `Tier ${prev.length + 1}`,
      price: 500000,
      rows: 3,
      seatsPerRow: 10,
      color: TIER_COLORS[colorIndex],
    }]);
  };

  const removeTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSeats = tiers.reduce((sum, t) => sum + t.rows * t.seatsPerRow, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!form.title || !form.category) {
      setError('Event name and category are required');
      return;
    }

    if (!form.venueId) {
      setError('Please select a venue');
      return;
    }

    if (!form.startDate) {
      setError('Start date is required');
      return;
    }

    if (tiers.some((t) => !t.name || t.price < 0 || t.rows < 1 || t.seatsPerRow < 1)) {
      setError('Please fill in all ticket tier details correctly');
      return;
    }

    setSaving(true);
    try {
      // Step 1: Create the event
      const eventRes = await api.post('/events', {
        title: form.title,
        description: form.description,
        category: form.category,
        imageUrl: form.coverImage || undefined,
      });
      const eventId = eventRes.data.id;

      // Step 2: Create a showtime
      const startsAt = new Date(form.startDate).toISOString();
      const endsAt = form.endDate
        ? new Date(form.endDate).toISOString()
        : new Date(new Date(form.startDate).getTime() + 3 * 60 * 60 * 1000).toISOString();

      const showtimeRes = await api.post('/showtimes', {
        eventId,
        venueId: form.venueId,
        startsAt,
        endsAt,
      });
      const showtimeId = showtimeRes.data.id;

      // Step 3: Create seat categories and seats via the seat map upload
      // First get or create sections for the venue
      const venue = venues.find((v) => v.id === form.venueId);

      // Build seat map data
      const categories: any[] = [];
      const sections: any[] = [];
      let yOffset = 0;

      for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
        const tier = tiers[tierIdx];
        const sectionId = `section-${tierIdx}`;

        categories.push({
          sectionId: form.venueId, // use venue ID as section fallback
          name: tier.name,
          price: Math.round(tier.price),
          color: tier.color,
          currency: 'VND',
        });

        const seats: any[] = [];
        const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const rowOffset = sections.reduce((sum, s) => sum + s.seats.length, 0) > 0
          ? String.fromCharCode(65 + sections.reduce((count, s) => {
              const rows = new Set(s.seats.map((seat: any) => seat.row));
              return count + rows.size;
            }, 0))
          : 'A';

        let globalRowIndex = 0;
        for (const s of sections) {
          const rows = new Set(s.seats.map((seat: any) => seat.row));
          globalRowIndex += rows.size;
        }

        for (let r = 0; r < tier.rows; r++) {
          const rowLetter = rowLetters[globalRowIndex + r] || `R${globalRowIndex + r}`;
          for (let s = 1; s <= tier.seatsPerRow; s++) {
            seats.push({
              row: rowLetter,
              number: s,
              label: `${rowLetter}${s}`,
              x: s * 40,
              y: yOffset + r * 45,
            });
          }
        }

        yOffset += tier.rows * 45 + 60; // gap between tiers

        sections.push({
          sectionId: form.venueId,
          categoryName: tier.name,
          seats,
        });
      }

      // Upload seat map
      await api.post(`/organizer/showtimes/${showtimeId}/seat-map`, {
        categories,
        sections,
      });

      toast('success', 'Event created with ' + totalSeats + ' seats!');
      router.push(`/organizer/events/${eventId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('errors.server.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gradient">{t('organizer.events.create')}</h1>

      <div className="glass-card mt-6 p-6">
        {error && <ErrorMessage message={error} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Event Details */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-gray-100">Event Details</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Event Name *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  className="input-field"
                  placeholder="e.g. Summer Music Festival"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  className="input-field min-h-[100px]"
                  rows={4}
                  placeholder="Tell people about your event..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Category *</label>
                  <select
                    value={form.category}
                    onChange={(e) => update('category', e.target.value)}
                    className="input-field [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{t(`events.categories.${cat}` as any)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Venue *</label>
                  <select
                    value={form.venueId}
                    onChange={(e) => update('venueId', e.target.value)}
                    className="input-field [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100"
                  >
                    <option value="">Select venue...</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => update('startDate', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-300">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => update('endDate', e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Cover Image URL</label>
                <input
                  type="url"
                  value={form.coverImage}
                  onChange={(e) => update('coverImage', e.target.value)}
                  className="input-field"
                  placeholder="https://images.unsplash.com/..."
                />
              </div>
            </div>
          </div>

          {/* Ticket Pricing & Seats */}
          <div className="border-t border-white/10 pt-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">Ticket Tiers & Pricing</h2>
                <p className="text-sm text-gray-500">
                  Total: {totalSeats} seats
                </p>
              </div>
              <button
                type="button"
                onClick={addTier}
                className="btn-secondary flex items-center gap-1 text-sm"
              >
                <PlusIcon className="h-4 w-4" />
                Add Tier
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                  style={{ borderLeftColor: tier.color, borderLeftWidth: '4px' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Tier Name *</label>
                        <input
                          type="text"
                          value={tier.name}
                          onChange={(e) => updateTier(idx, 'name', e.target.value)}
                          className="input-field text-sm"
                          placeholder="e.g. VIP"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Price (VND) *</label>
                        <input
                          type="number"
                          value={tier.price}
                          onChange={(e) => updateTier(idx, 'price', Number(e.target.value))}
                          className="input-field text-sm"
                          min={0}
                          step={10000}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Rows</label>
                        <input
                          type="number"
                          value={tier.rows}
                          onChange={(e) => updateTier(idx, 'rows', Number(e.target.value))}
                          className="input-field text-sm"
                          min={1}
                          max={26}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-gray-400">Seats/Row</label>
                        <input
                          type="number"
                          value={tier.seatsPerRow}
                          onChange={(e) => updateTier(idx, 'seatsPerRow', Number(e.target.value))}
                          className="input-field text-sm"
                          min={1}
                          max={50}
                        />
                      </div>
                    </div>
                    {tiers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTier(idx)}
                        className="ml-2 mt-5 rounded p-1.5 text-gray-500 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {tier.rows * tier.seatsPerRow} seats — ₫{tier.price.toLocaleString()} each
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 border-t border-white/10 pt-5">
            <button type="submit" disabled={saving} className="btn-primary px-8">
              {saving ? 'Creating...' : `Create Event (${totalSeats} seats)`}
            </button>
            <button
              type="button"
              onClick={() => router.push('/organizer/events')}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
