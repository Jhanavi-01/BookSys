'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatCurrency, formatShortDate, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';

interface OrderItem {
  id: string;
  eventTitle: string;
  showtimeDate: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'badge-accent',
  PAID: 'badge-success',
  CONFIRMED: 'badge-success',
  CANCELLED: 'bg-white/5 text-gray-500 border border-white/10',
  REFUNDED: 'badge-primary',
  EXPIRED: 'bg-white/5 text-gray-500 border border-white/10',
  FAILED: 'badge-danger',
};

export default function OrdersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const res = await api.get('/orders/my', { params: { page, limit: 10 } });
        setOrders(res.data.content || res.data.items || res.data || []);
        setTotalPages(res.data.totalPages || 1);
      } catch {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [page]);

  const statusKey = (status: string): string => {
    const map: Record<string, string> = {
      PENDING: 'pending',
      PAID: 'paid',
      CONFIRMED: 'paid',
      CANCELLED: 'cancelled',
      REFUNDED: 'refunded',
      EXPIRED: 'expired',
      FAILED: 'failed',
    };
    return map[status] || 'pending';
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/3 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <h1 className="text-gradient text-2xl font-bold">{t('orders.title')}</h1>

        {orders.length === 0 ? (
          <div className="glass-card mt-8 rounded-xl border border-dashed border-white/10 py-16 text-center">
            <p className="text-gray-500">{t('orders.noOrders')}</p>
            <Link href="/events" className="btn-primary mt-4 inline-flex">
              {t('common.buttons.viewAll')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/booking/${order.id}`}
                  className="glass-card glass-card-hover flex items-center justify-between rounded-xl p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-100">{order.eventTitle}</p>
                    <p className="text-sm text-gray-500">
                      {formatShortDate(order.createdAt, locale)} &middot; {order.itemCount}{' '}
                      {t('booking.checkout.seats').toLowerCase()}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    <span className="font-semibold text-accent-400">
                      {formatCurrency(order.total, locale)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        STATUS_STYLES[order.status] || 'bg-white/5 text-gray-500'
                      )}
                    >
                      {t(`orders.status.${statusKey(order.status)}`)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              className="mt-6"
            />
          </>
        )}
      </div>
    </div>
  );
}
