'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

export default function AccountantDashboard() {
  const t = useTranslations();
  const locale = useLocale();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/accountant/stats')
      .then((res) => setStats(res.data))
      .catch(() => setStats({
        totalRevenue: 0,
        matchedTransactions: 0,
        unmatchedTransactions: 0,
        pendingTransactions: 0,
      }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('meta.accountant.title')}</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2 text-green-400">
              <CurrencyDollarIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('reports.revenue.totalRevenue')}</p>
              <p className="text-xl font-bold text-white">
                {formatCurrency(stats?.totalRevenue || 0, locale)}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-green-500/10 p-2 text-green-400">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('reports.reconciliation.matched')}</p>
              <p className="text-xl font-bold text-green-400">{stats?.matchedTransactions || 0}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-red-500/10 p-2 text-red-400">
              <ExclamationCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('reports.reconciliation.unmatched')}</p>
              <p className="text-xl font-bold text-red-400">{stats?.unmatchedTransactions || 0}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <ClockIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-400">{t('reports.reconciliation.pending')}</p>
              <p className="text-xl font-bold text-amber-400">{stats?.pendingTransactions || 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <Link href="/accountant/reconciliation" className="btn-primary">
          {t('reports.reconciliation.title')}
        </Link>
      </div>
    </div>
  );
}
