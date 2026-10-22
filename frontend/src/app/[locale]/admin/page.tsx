'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  UsersIcon,
  CalendarIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline';

export default function AdminDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then((res) => setStats(res.data))
      .catch(() => setStats({ totalUsers: 0, totalEvents: 0, totalOrders: 0, totalRevenue: 0 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="py-20" />;

  const cards = [
    { label: t('admin.dashboard.totalUsers'), value: stats?.totalUsers || 0, icon: UsersIcon, iconColor: 'text-blue-400', href: '/admin/users' },
    { label: t('admin.dashboard.totalEvents'), value: stats?.totalEvents || 0, icon: CalendarIcon, iconColor: 'text-green-400', href: '/events' },
    { label: t('admin.dashboard.totalOrders'), value: stats?.totalOrders || 0, icon: ShoppingCartIcon, iconColor: 'text-purple-400', href: '#' },
    { label: t('admin.dashboard.totalRevenue'), value: formatCurrency(stats?.totalRevenue || 0, locale), icon: CurrencyDollarIcon, iconColor: 'text-amber-400', href: '#' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('admin.dashboard.title')}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="stat-card glass-card-hover">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg bg-white/5 p-2 ${card.iconColor}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="text-xl font-bold text-white">{card.value}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="glass-card mt-8 p-6">
        <h2 className="text-lg font-semibold text-gray-100">{t('admin.dashboard.recentActivity')}</h2>
        <div className="mt-4 space-y-3">
          {(stats?.recentActivity || []).length === 0 ? (
            <p className="text-sm text-gray-400">{t('common.states.empty')}</p>
          ) : (
            (stats?.recentActivity || []).map((activity: any, i: number) => (
              <div key={i} className="flex items-center justify-between border-b border-white/5 py-2 last:border-0">
                <div>
                  <p className="text-sm text-gray-100">{activity.action}</p>
                  <p className="text-xs text-gray-400">{activity.user}</p>
                </div>
                <span className="text-xs text-gray-500">{activity.time}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Health */}
      <div className="glass-card mt-6 p-6">
        <h2 className="text-lg font-semibold text-gray-100">{t('admin.dashboard.systemHealth')}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
            <p className="text-sm text-green-300">API</p>
            <p className="font-bold text-green-400">{t('common.states.active')}</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
            <p className="text-sm text-green-300">Database</p>
            <p className="font-bold text-green-400">{t('common.states.active')}</p>
          </div>
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-center">
            <p className="text-sm text-green-300">Payment Gateway</p>
            <p className="font-bold text-green-400">{t('common.states.active')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
