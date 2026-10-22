'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/components/common/Toast';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  capacity: number;
}

export default function VenuesPage() {
  const t = useTranslations();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', capacity: 0 });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchVenues = async () => {
    try {
      const res = await api.get('/organizer/venues');
      setVenues(res.data || []);
    } catch {
      setVenues([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVenues(); }, []);

  const resetForm = () => {
    setForm({ name: '', address: '', city: '', capacity: 0 });
    setEditing(null);
    setShowForm(false);
  };

  const handleEdit = (venue: Venue) => {
    setEditing(venue);
    setForm({ name: venue.name, address: venue.address, city: venue.city, capacity: venue.capacity });
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/organizer/venues/${editing.id}`, form);
      } else {
        await api.post('/organizer/venues', form);
      }
      await fetchVenues();
      resetForm();
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/organizer/venues/${deleteId}`);
      setVenues((prev) => prev.filter((v) => v.id !== deleteId));
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    } finally {
      setDeleteId(null);
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient">{t('organizer.venues.title')}</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          {t('organizer.venues.create')}
        </button>
      </div>

      {showForm && (
        <div className="glass-card mt-6 p-6">
          <h2 className="text-lg font-semibold text-gray-100">
            {editing ? t('organizer.venues.edit') : t('organizer.venues.create')}
          </h2>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.venues.name')}</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.venues.city')}</label>
                <input type="text" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="input-field" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.venues.address')}</label>
              <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">{t('organizer.venues.capacity')}</label>
              <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} className="input-field w-40" min={0} />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? t('common.states.saving') : t('common.buttons.save')}
              </button>
              <button type="button" onClick={resetForm} className="btn-secondary">{t('common.buttons.cancel')}</button>
            </div>
          </form>
        </div>
      )}

      {venues.length === 0 && !showForm ? (
        <div className="mt-8 text-center text-gray-400">{t('organizer.venues.noVenues')}</div>
      ) : (
        <div className="mt-6 space-y-3">
          {venues.map((venue) => (
            <div key={venue.id} className="glass-card glass-card-hover flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-gray-100">{venue.name}</p>
                <p className="text-sm text-gray-400">{venue.address}, {venue.city}</p>
                <p className="text-xs text-gray-500">{t('organizer.venues.capacity')}: {venue.capacity}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(venue)} className="rounded p-1.5 text-gray-400 hover:bg-white/10 hover:text-gray-200">
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteId(venue.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t('common.buttons.delete')}
        message={t('organizer.events.deleteConfirm')}
        confirmLabel={t('common.buttons.delete')}
        cancelLabel={t('common.buttons.cancel')}
      />
    </div>
  );
}
