'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/components/common/Toast';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface RevenueData {
  totalRevenue: number;
  netRevenue: number;
  fees: number;
  refunds: number;
  byEvent: { eventTitle: string; revenue: number; ticketsSold: number }[];
}

export default function ReportsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await api.get('/organizer/reports/revenue', { params });
      const d = res.data;
      setData({
        totalRevenue: d.totalRevenue || 0,
        netRevenue: d.netRevenue || 0,
        fees: d.totalFees || d.fees || 0,
        refunds: d.totalRefunds || d.refunds || 0,
        byEvent: (d.events || d.byEvent || []).map((e: any) => ({
          eventTitle: e.title || e.eventTitle || '',
          revenue: e.revenue || 0,
          ticketsSold: e.ticketsSold || 0,
        })),
      });
    } catch {
      setData({ totalRevenue: 0, netRevenue: 0, fees: 0, refunds: 0, byEvent: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  const exportCsv = async () => {
    try {
      const params: Record<string, string> = {};
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const res = await api.get('/organizer/reports/revenue/export', { params });
      const csvContent = res.data?.csv || res.data;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'revenue-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  if (loading) return <LoadingSpinner className="py-20" />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-gradient">{t('organizer.reports.title')}</h1>

      {/* Date filters */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm text-gray-400">{t('reports.exports.dateRange')}</label>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field" />
          </div>
        </div>
        <button onClick={fetchReport} className="btn-primary">{t('common.buttons.apply')}</button>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2">
          <ArrowDownTrayIcon className="h-4 w-4" />
          {t('organizer.reports.exportCsv')}
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="stat-card">
              <p className="text-sm text-gray-400">{t('reports.revenue.totalRevenue')}</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(data.totalRevenue, locale)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-400">{t('reports.revenue.netRevenue')}</p>
              <p className="text-2xl font-bold text-green-400">{formatCurrency(data.netRevenue, locale)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-400">{t('reports.revenue.fees')}</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(data.fees, locale)}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-400">{t('reports.revenue.refunds')}</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(data.refunds, locale)}</p>
            </div>
          </div>

          {/* By Event Table */}
          <div className="glass-card mt-8 overflow-hidden">
            <div className="border-b border-white/10 px-4 py-3">
              <h2 className="font-semibold text-gray-100">{t('reports.revenue.byEvent')}</h2>
            </div>
            {data.byEvent.length === 0 ? (
              <p className="p-6 text-center text-sm text-gray-400">{t('common.states.empty')}</p>
            ) : (
              <table className="glass-table min-w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('booking.checkout.event')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">{t('organizer.dashboard.ticketsSold')}</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">{t('reports.revenue.totalRevenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.byEvent.map((row, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-100">{row.eventTitle}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-300">{row.ticketsSold}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-100">{formatCurrency(row.revenue, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
