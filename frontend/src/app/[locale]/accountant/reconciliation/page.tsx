'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';
import { toast } from '@/components/common/Toast';

interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  providerRef: string;
  status: 'matched' | 'unmatched' | 'pending';
  createdAt: string;
  eventTitle: string;
}

export default function ReconciliationPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 20 };
      if (filter) params.status = filter;
      const res = await api.get('/accountant/reconciliation', { params });
      setTransactions(res.data?.content || res.data?.items || res.data || []);
      setTotalPages(res.data?.totalPages || 1);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [page, filter]);

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/accountant/reconciliation/${id}/approve`);
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'matched' as const } : t))
      );
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  const handleFlag = async (id: string) => {
    try {
      await api.post(`/accountant/reconciliation/${id}/flag`);
      toast('info', 'Flagged for review');
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  const statusStyle: Record<string, string> = {
    matched: 'badge-success',
    unmatched: 'badge-danger',
    pending: 'badge-accent',
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('reports.reconciliation.title')}</h1>

      {/* Filter */}
      <div className="mt-6 flex gap-2">
        {['', 'matched', 'unmatched', 'pending'].map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f ? 'btn-primary' : 'btn-ghost'
            )}
          >
            {f === '' ? t('reports.reconciliation.total') : t(`reports.reconciliation.${f}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : transactions.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">{t('common.states.empty')}</p>
      ) : (
        <>
          <div className="glass-card mt-6 overflow-x-auto">
            <table className="glass-table min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Order</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('booking.checkout.event')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">{t('booking.checkout.total')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">Provider Ref</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-400">{t('admin.users.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('orders.details.date')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-100">{tx.orderId?.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{tx.eventTitle}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-100">{formatCurrency(tx.amount, locale)}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{tx.providerRef}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', statusStyle[tx.status] || '')}>
                        {t(`reports.reconciliation.${tx.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatDate(tx.createdAt, locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {tx.status !== 'matched' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleApprove(tx.id)} className="rounded bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400 hover:bg-green-500/20">
                            {t('reports.reconciliation.approve')}
                          </button>
                          <button onClick={() => handleFlag(tx.id)} className="rounded bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/20">
                            {t('reports.reconciliation.flag')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="mt-6" />
        </>
      )}
    </div>
  );
}
