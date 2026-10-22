'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatCurrency, formatShortDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  CalendarIcon,
  TicketIcon,
  CurrencyDollarIcon,
  SparklesIcon,
  PlusIcon,
  ChartBarIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  ticketsSold: number;
  totalRevenue: number;
}

interface RecentOrder {
  id: string;
  eventTitle: string;
  customerName: string;
  total: number;
  createdAt: string;
  status: string;
}

export default function OrganizerDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, ordersRes] = await Promise.all([
          api.get('/organizer/stats'),
          api.get('/organizer/orders/recent'),
        ]);
        setStats(statsRes.data);
        setRecentOrders(ordersRes.data || []);
      } catch {
        setStats({ totalEvents: 0, activeEvents: 0, ticketsSold: 0, totalRevenue: 0 });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner className="py-20" />;

  const statCards = [
    {
      label: t('organizer.dashboard.totalEvents'),
      value: stats?.totalEvents || 0,
      icon: CalendarIcon,
      iconColor: 'text-blue-400',
    },
    {
      label: t('organizer.dashboard.activeEvents'),
      value: stats?.activeEvents || 0,
      icon: SparklesIcon,
      iconColor: 'text-green-400',
    },
    {
      label: t('organizer.dashboard.ticketsSold'),
      value: stats?.ticketsSold || 0,
      icon: TicketIcon,
      iconColor: 'text-purple-400',
    },
    {
      label: t('organizer.dashboard.totalRevenue'),
      value: formatCurrency(stats?.totalRevenue || 0, locale),
      icon: CurrencyDollarIcon,
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('organizer.dashboard.title')}</h1>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg bg-white/5 p-2 ${card.iconColor}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="text-xl font-bold text-white">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-100">
          {t('organizer.dashboard.quickActions')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Link
            href="/organizer/events/new"
            className="glass-card glass-card-hover flex items-center gap-3 p-4"
          >
            <PlusIcon className="h-8 w-8 text-purple-400" />
            <span className="font-medium text-gray-100">
              {t('organizer.dashboard.createEvent')}
            </span>
          </Link>
          <Link
            href="/organizer/reports"
            className="glass-card glass-card-hover flex items-center gap-3 p-4"
          >
            <ChartBarIcon className="h-8 w-8 text-purple-400" />
            <span className="font-medium text-gray-100">
              {t('organizer.dashboard.viewReports')}
            </span>
          </Link>
          <Link
            href="/organizer/venues"
            className="glass-card glass-card-hover flex items-center gap-3 p-4"
          >
            <BuildingStorefrontIcon className="h-8 w-8 text-purple-400" />
            <span className="font-medium text-gray-100">
              {t('organizer.dashboard.manageVenues')}
            </span>
          </Link>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-100">
          {t('organizer.dashboard.recentOrders')}
        </h2>
        <div className="glass-card mt-4 overflow-hidden">
          {recentOrders.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">
              {t('common.states.empty')}
            </p>
          ) : (
            <table className="glass-table min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t('orders.details.orderNumber', { id: '' })}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">
                    {t('booking.checkout.event')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
                    {t('booking.checkout.total')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">
                    {t('orders.details.date')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-100">
                      {order.id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{order.eventTitle}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-100">
                      {formatCurrency(order.total, locale)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-400">
                      {formatShortDate(order.createdAt, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
