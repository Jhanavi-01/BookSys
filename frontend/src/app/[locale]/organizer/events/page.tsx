'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatShortDate, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { toast } from '@/components/common/Toast';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface EventItem {
  id: string;
  title: string;
  category: string;
  startDate: string;
  published: boolean;
  ticketsSold: number;
}

export default function OrganizerEventsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchEvents = async () => {
    try {
      const res = await api.get('/organizer/events');
      const raw = res.data?.content || res.data || [];
      setEvents(raw.map((e: any) => ({
        id: e.id,
        title: e.title,
        category: e.category || '',
        startDate: e.showtimes?.[0]?.startsAt || e.startDate || e.createdAt,
        published: e.status === 'PUBLISHED',
        ticketsSold: e._count?.tickets || e.ticketsSold || 0,
      })));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/events/${deleteId}`);
      setEvents((prev) => prev.filter((e) => e.id !== deleteId));
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  const togglePublish = async (id: string, published: boolean) => {
    try {
      const newStatus = published ? 'DRAFT' : 'PUBLISHED';
      await api.patch(`/events/${id}/status`, { status: newStatus });
      setEvents((prev) =>
        prev.map((e) => (e.id === id ? { ...e, published: !published } : e))
      );
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient">{t('organizer.events.title')}</h1>
        <Link href="/organizer/events/new" className="btn-primary flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          {t('organizer.events.create')}
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-gray-400">{t('organizer.events.noEvents')}</p>
        </div>
      ) : (
        <div className="glass-card mt-6 overflow-hidden">
          <table className="glass-table min-w-full">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                  {t('organizer.events.eventName')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                  {t('organizer.events.category')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                  {t('organizer.events.startDate')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-400">
                  {t('admin.users.status')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
                  {t('admin.users.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/organizer/events/${event.id}`}
                      className="font-medium text-purple-400 hover:text-purple-300"
                    >
                      {event.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {t(`events.categories.${event.category}` as any)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    {formatShortDate(event.startDate, locale)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePublish(event.id, event.published)}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        event.published
                          ? 'badge-success'
                          : 'bg-white/10 text-gray-400'
                      )}
                    >
                      {event.published
                        ? t('organizer.events.published')
                        : t('organizer.events.draft')}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/organizer/events/${event.id}`}
                        className="rounded p-1 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Link>
                      <Link
                        href={`/organizer/events/${event.id}/showtimes`}
                        className="text-xs font-medium text-purple-400 hover:text-purple-300"
                      >
                        {t('organizer.showtimes.title')}
                      </Link>
                      <button
                        onClick={() => setDeleteId(event.id)}
                        className="rounded p-1 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        loading={deleting}
      />
    </div>
  );
}
