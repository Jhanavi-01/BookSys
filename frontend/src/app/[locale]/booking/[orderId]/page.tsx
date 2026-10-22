'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import CountdownTimer from '@/components/seats/CountdownTimer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ErrorMessage from '@/components/common/ErrorMessage';

interface OrderDetail {
  id: string;
  status: string;
  eventTitle: string;
  showtimeDate: string;
  venueName: string;
  items: {
    seatId: string;
    row: string;
    number: number;
    category: string;
    price: number;
  }[];
  subtotal: number;
  serviceFee: number;
  total: number;
  expiresAt: string;
}

function mapOrderResponse(data: any): OrderDetail {
  const items = (data.orderItems || data.items || []).map((item: any) => ({
    seatId: item.seat?.id || item.seatId || item.id,
    row: item.seat?.row || item.row || '',
    number: item.seat?.number || item.number || 0,
    category: item.category?.name || item.category || '',
    price: item.unitPrice || item.category?.price || item.price || 0,
  }));

  const subtotal = items.reduce((sum: number, i: any) => sum + i.price, 0);

  return {
    id: data.id,
    status: data.status,
    eventTitle: data.showtime?.event?.title || data.eventTitle || '',
    showtimeDate: data.showtime?.startsAt || data.showtimeDate || '',
    venueName: data.showtime?.venue?.name || data.venueName || '',
    items,
    subtotal,
    serviceFee: 0,
    total: data.totalAmount || data.total || subtotal,
    expiresAt: data.paymentTimeoutAt || data.expiresAt || '',
  };
}

export default function BookingPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        setOrder(mapOrderResponse(res.data));
      } catch {
        setError(t('errors.server.generic'));
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, t]);

  const handlePay = async () => {
    setPaying(true);
    setError('');
    try {
      const returnUrl = `${window.location.origin}/${locale}/booking/${orderId}/result`;
      const res = await api.post('/payments/create', {
        orderId,
        returnUrl,
        cancelUrl: returnUrl,
      });
      const payUrl = res.data.paymentUrl || res.data.redirectUrl;
      if (payUrl) {
        window.location.href = payUrl;
      } else {
        // Mock provider - payment happens instantly
        router.push(`/booking/${orderId}/result`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('errors.booking.paymentFailed');
      setError(msg);
      setPaying(false);
    }
  };

  const handleExpired = () => {
    setError(t('booking.countdown.expiredMessage'));
  };

  if (loading) return <LoadingSpinner className="py-20" />;
  if (error && !order) return <ErrorMessage message={error} className="mx-auto mt-10 max-w-lg" />;
  if (!order) return null;

  const canPay = order.status === 'AWAITING_PAYMENT' || order.status === 'PENDING' || order.status === 'FAILED';

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/3 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl">
        <h1 className="text-gradient text-2xl font-bold">{t('booking.checkout.title')}</h1>
        <p className="text-sm text-gray-500">
          {t('orders.details.orderNumber', { id: orderId.slice(0, 8) })}
        </p>

        {error && <ErrorMessage message={error} className="mt-4" />}

        {canPay && order.expiresAt && (
          <CountdownTimer
            expiresAt={order.expiresAt}
            onExpired={handleExpired}
            label={t('booking.countdown.title')}
            className="mt-4"
          />
        )}

        <div className="glass-card mt-6 divide-y divide-white/10 rounded-xl">
          {/* Event Info */}
          <div className="p-4">
            <p className="text-sm text-gray-500">{t('booking.checkout.event')}</p>
            <p className="font-semibold text-gray-100">{order.eventTitle}</p>
            <p className="text-sm text-gray-500">
              {formatDate(order.showtimeDate, locale)} &middot; {order.venueName}
            </p>
          </div>

          {/* Items */}
          <div className="p-4">
            <p className="mb-3 text-sm font-medium text-gray-500">{t('booking.checkout.seats')}</p>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.seatId} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-100">
                      {t('orders.items.seat', { row: item.row, number: String(item.number) })}
                    </span>
                    <span className="ml-2 text-gray-500">
                      {t('orders.items.category', { category: item.category })}
                    </span>
                  </div>
                  <span className="font-medium text-gray-300">{formatCurrency(item.price, locale)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('booking.checkout.subtotal')}</span>
              <span className="text-gray-300">{formatCurrency(order.subtotal, locale)}</span>
            </div>
            {order.serviceFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('booking.checkout.serviceFee')}</span>
                <span className="text-gray-300">{formatCurrency(order.serviceFee, locale)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-2 text-base font-bold">
              <span className="text-gray-100">{t('booking.checkout.total')}</span>
              <span className="text-accent-400">{formatCurrency(order.total, locale)}</span>
            </div>
          </div>
        </div>

        {canPay && (
          <button
            onClick={handlePay}
            disabled={paying}
            className="btn-primary mt-6 w-full text-lg"
          >
            {paying
              ? t('booking.checkout.processingPayment')
              : order.status === 'FAILED'
              ? t('booking.checkout.payAgain')
              : t('booking.checkout.payNow')}
          </button>
        )}
      </div>
    </div>
  );
}
