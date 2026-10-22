'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';
import { ArrowDownTrayIcon, TicketIcon, MapPinIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface TicketItem {
  id: string;
  ticketCode: string;
  eventTitle: string;
  showtimeDate: string;
  venueName: string;
  row: string;
  seatNumber: number;
  gate?: string;
  category: string;
  price: number;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED';
  orderId: string;
  qrData: string;
}

export default function TicketsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<TicketItem | null>(null);
  const [cancelPreview, setCancelPreview] = useState<{
    refundPercentage: number;
    refundAmount: number;
    currency: string;
    ticketPrice: number;
  } | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const fetchTickets = useCallback(async () => {
    try {
      const res = await api.get('/tickets');
      const rawTickets = res.data || [];
      const mapped = rawTickets.map((tk: any) => ({
        id: tk.id,
        ticketCode: tk.ticketCode,
        eventTitle: tk.showtime?.event?.title || tk.eventTitle || '',
        showtimeDate: tk.showtime?.startsAt || tk.showtimeDate || '',
        venueName: tk.showtime?.venue?.name || tk.venueName || '',
        row: tk.seatLabel?.split(/(\d+)/)[0] || tk.row || '',
        seatNumber: parseInt(tk.seatLabel?.match(/\d+/)?.[0]) || tk.seatNumber || 0,
        category: tk.category || '',
        price: tk.price || 0,
        status: tk.status === 'ACTIVE' ? 'VALID' : tk.status,
        orderId: tk.orderId || '',
        qrData: `${window.location.origin}/en/verify/${tk.ticketCode}`,
      }));
      setTickets(mapped);
    } catch {
      setError(t('errors.server.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const now = new Date();
  const upcoming = tickets.filter(
    (tk) => new Date(tk.showtimeDate) >= now && tk.status !== 'CANCELLED'
  );
  const past = tickets.filter(
    (tk) => new Date(tk.showtimeDate) < now || tk.status === 'CANCELLED'
  );
  const displayed = tab === 'upcoming' ? upcoming : past;

  const downloadQR = useCallback(async (ticket: TicketItem) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const dataUrl = await QRCode.toDataURL(ticket.qrData || ticket.ticketCode, {
        width: 400,
        margin: 2,
      });
      const link = document.createElement('a');
      link.download = `ticket-${ticket.ticketCode}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // fallback
    }
  }, []);

  const openCancelDialog = useCallback(async (ticket: TicketItem) => {
    setCancelTarget(ticket);
    setCancelError('');
    setCancelPreview(null);
    try {
      const res = await api.get(`/tickets/${ticket.id}/refund-preview`);
      setCancelPreview(res.data);
    } catch {
      // If preview fails, still show dialog with unknown refund
      setCancelPreview(null);
    }
  }, []);

  const closeCancelDialog = useCallback(() => {
    setCancelTarget(null);
    setCancelPreview(null);
    setCancelError('');
  }, []);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      await api.patch(`/tickets/${cancelTarget.id}/cancel`);
      closeCancelDialog();
      await fetchTickets();
    } catch (err: any) {
      setCancelError(err?.response?.data?.message || t('tickets.cancel.error'));
    } finally {
      setCancelLoading(false);
    }
  }, [cancelTarget, closeCancelDialog, fetchTickets, t]);

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/3 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <h1 className="text-gradient text-2xl font-bold">{t('tickets.title')}</h1>

        {error && <ErrorMessage message={error} className="mt-4" />}

        {tickets.length === 0 ? (
          <div className="glass-card mt-8 rounded-xl border border-dashed border-white/10 py-16 text-center">
            <TicketIcon className="mx-auto h-12 w-12 text-gray-600" />
            <p className="mt-4 text-gray-500">{t('tickets.noTickets')}</p>
            <Link href="/events" className="btn-primary mt-4 inline-flex">
              {t('tickets.browseEvents')}
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="mt-6 flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1 backdrop-blur-sm">
              <button
                onClick={() => setTab('upcoming')}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  tab === 'upcoming'
                    ? 'bg-primary-600/20 text-primary-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('tickets.upcoming')} ({upcoming.length})
              </button>
              <button
                onClick={() => setTab('past')}
                className={cn(
                  'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                  tab === 'past'
                    ? 'bg-primary-600/20 text-primary-400 shadow-sm'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {t('tickets.past')} ({past.length})
              </button>
            </div>

            {/* Ticket Cards */}
            <div className="mt-6 space-y-4">
              {displayed.map((ticket) => {
                const isCancelled = ticket.status === 'CANCELLED' || ticket.status === 'REFUNDED';
                return (
                  <div
                    key={ticket.id}
                    className={cn(
                      'relative flex overflow-hidden rounded-2xl shadow-lg',
                      isCancelled && 'opacity-50'
                    )}
                  >
                    {/* Left - Dark section with QR */}
                    <div className="flex w-40 flex-col items-center justify-center bg-[#1a1a1a] p-4 sm:w-48">
                      <h4 className="mb-3 text-center text-sm font-bold uppercase tracking-wider text-white">
                        {ticket.eventTitle}
                      </h4>
                      {!isCancelled && <QRDisplay data={ticket.qrData || ticket.ticketCode} />}
                      {!isCancelled && (
                        <button
                          onClick={() => downloadQR(ticket)}
                          className="mt-2 flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300"
                        >
                          <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                          Download QR
                        </button>
                      )}
                    </div>

                    {/* Middle - Cream ticket body */}
                    <div className="relative flex flex-1 flex-col justify-between bg-[#f5f0e8] p-5 text-[#1a1a1a]">
                      {/* Circular cutouts */}
                      <div className="absolute -top-3 right-[88px] h-6 w-6 rounded-full bg-dark-950 sm:right-[104px]" />
                      <div className="absolute -bottom-3 right-[88px] h-6 w-6 rounded-full bg-dark-950 sm:right-[104px]" />

                      {/* Status badge */}
                      <div className="absolute right-24 top-3 sm:right-28">
                        <StatusBadge status={ticket.status} t={t} />
                      </div>

                      <div>
                        <h3 className="text-lg font-extrabold uppercase tracking-tight">{ticket.eventTitle}</h3>
                        <div className="mt-1 flex items-center gap-3">
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Admit One</span>
                          <span className="rounded bg-[#1a1a1a] px-2 py-0.5 text-xs font-bold uppercase text-white">{ticket.category || 'Standard'}</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1.5 border-t border-dashed border-gray-300 pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ticket.venueName}</span>
                          <span className="font-medium">{formatDate(ticket.showtimeDate, locale, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <MapPinIcon className="h-3.5 w-3.5" />
                          <span>{ticket.venueName}</span>
                          <span className="ml-auto">{formatDate(ticket.showtimeDate, locale, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center justify-between">
                        <p className="font-mono text-[10px] text-gray-400">Ticket: {ticket.ticketCode}</p>
                        {ticket.status === 'VALID' && new Date(ticket.showtimeDate) > now && (
                          <button
                            onClick={() => openCancelDialog(ticket)}
                            className="flex items-center gap-1 rounded-md bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20"
                          >
                            <XCircleIcon className="h-3.5 w-3.5" />
                            {t('tickets.cancel.button')}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Right stub - with dotted border */}
                    <div className="flex w-20 flex-col items-center justify-center border-l-2 border-dashed border-gray-300 bg-[#f5f0e8] p-2 sm:w-24">
                      <div className="flex flex-col items-center gap-2">
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Seat</p>
                          <p className="text-2xl font-extrabold text-[#1a1a1a]">{ticket.seatNumber}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Row</p>
                          <p className="text-2xl font-extrabold text-[#1a1a1a]">{ticket.row}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl border border-white/10 bg-dark-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">{t('tickets.cancel.title')}</h3>
            <p className="mt-2 text-sm text-gray-400">{t('tickets.cancel.confirm')}</p>

            <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {cancelTarget.eventTitle}
              </p>
              <p className="mt-1 text-sm text-gray-300">
                {cancelTarget.seatNumber ? `Row ${cancelTarget.row}, Seat ${cancelTarget.seatNumber}` : cancelTarget.ticketCode}
              </p>

              <div className="mt-3 border-t border-white/10 pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t('tickets.cancel.refundPolicy')}
                </p>
                {cancelPreview ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">
                        {t('tickets.cancel.refundPercent', { percent: cancelPreview.refundPercentage })}
                      </span>
                      <span className={cn(
                        'text-sm font-bold',
                        cancelPreview.refundPercentage === 0 ? 'text-red-400' :
                        cancelPreview.refundPercentage === 50 ? 'text-yellow-400' : 'text-green-400'
                      )}>
                        {formatCurrency(cancelPreview.refundAmount, locale)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {cancelPreview.refundPercentage === 0 && t('tickets.cancel.noRefund')}
                      {cancelPreview.refundPercentage === 50 && t('tickets.cancel.halfRefund')}
                      {cancelPreview.refundPercentage === 100 && t('tickets.cancel.fullRefund')}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
                  </div>
                )}
              </div>
            </div>

            {cancelError && (
              <p className="mt-3 text-sm text-red-400">{cancelError}</p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeCancelDialog}
                disabled={cancelLoading}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10"
              >
                {t('tickets.cancel.cancelButton')}
              </button>
              <button
                onClick={confirmCancel}
                disabled={cancelLoading}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancelLoading ? t('tickets.cancel.processing') : t('tickets.cancel.confirmButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function QRDisplay({ data }: { data: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const render = async () => {
      if (!canvasRef.current) return;
      try {
        const QRCode = (await import('qrcode')).default;
        await QRCode.toCanvas(canvasRef.current, data, { width: 120, margin: 1 });
      } catch {
        // fallback
      }
    };
    render();
  }, [data]);

  return <canvas ref={canvasRef} className="h-28 w-28 rounded" />;
}

function StatusBadge({ status, t }: { status: string; t: any }) {
  const styles: Record<string, string> = {
    VALID: 'badge-success',
    USED: 'bg-white/5 text-gray-500 border border-white/10',
    CANCELLED: 'badge-danger',
    EXPIRED: 'bg-white/5 text-gray-500 border border-white/10',
    REFUNDED: 'badge-accent',
  };

  const labels: Record<string, string> = {
    VALID: 'valid',
    USED: 'used',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
    REFUNDED: 'refunded',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold',
        styles[status] || 'bg-white/5 text-gray-500'
      )}
    >
      {t(`tickets.status.${labels[status] || 'valid'}`)}
    </span>
  );
}
