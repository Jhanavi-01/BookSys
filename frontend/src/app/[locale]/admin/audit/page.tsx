'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';

interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
}

export default function AuditLogPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 25 };
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/admin/audit', { params });
      setEntries(res.data?.content || res.data?.items || res.data || []);
      setTotalPages(res.data?.totalPages || 1);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [page]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('admin.audit.title')}</h1>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t('admin.audit.dateRange')}</label>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-400">{t('admin.audit.actionType')}</label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input-field text-sm"
            placeholder="LOGIN, CREATE, UPDATE..."
          />
        </div>
        <button onClick={() => { setPage(1); fetchLogs(); }} className="btn-primary text-sm">
          {t('admin.audit.filter')}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : entries.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">{t('admin.audit.noLogs')}</p>
      ) : (
        <>
          <div className="glass-card mt-6 overflow-x-auto">
            <table className="glass-table min-w-full">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.timestamp')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.user')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.action')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.resource')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.details')}</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">{t('admin.audit.ipAddress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/5 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-400">
                      {formatDate(entry.timestamp, locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-300">{entry.userName}</td>
                    <td className="px-3 py-2">
                      <span className="badge-primary rounded px-1.5 py-0.5 text-xs font-medium">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-300">{entry.resource}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-xs text-gray-400">{entry.details}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{entry.ipAddress}</td>
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
