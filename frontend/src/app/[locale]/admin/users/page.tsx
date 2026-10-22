'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { formatShortDate, cn } from '@/lib/utils';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';
import { toast } from '@/components/common/Toast';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface UserItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

const ROLES = ['CUSTOMER', 'ORGANIZER', 'ENTRY_STAFF', 'ACCOUNTANT', 'ADMIN'];

export default function AdminUsersPage() {
  const t = useTranslations();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { search, page, limit: 20 } });
      const rawUsers = res.data?.content || res.data?.items || res.data || [];
      setUsers(rawUsers.map((u: any) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        active: u.isActive !== undefined ? u.isActive : u.active,
        createdAt: u.createdAt,
      })));
      setTotalPages(res.data?.totalPages || 1);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const changeRole = async (userId: string, newRole: string) => {
    try {
      await api.patch(`/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  const toggleActive = async (userId: string, currentActive: boolean) => {
    try {
      const endpoint = currentActive ? `/users/${userId}/deactivate` : `/users/${userId}/reactivate`;
      await api.patch(endpoint);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !currentActive } : u)));
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gradient">{t('admin.users.title')}</h1>

      {/* Search */}
      <form onSubmit={handleSearch} className="mt-6 flex gap-3">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('admin.users.search')}
            className="input-field pl-10"
          />
        </div>
        <button type="submit" className="btn-primary">{t('common.buttons.search')}</button>
      </form>

      {loading ? (
        <LoadingSpinner className="py-12" />
      ) : users.length === 0 ? (
        <p className="mt-8 text-center text-gray-400">{t('admin.users.noUsers')}</p>
      ) : (
        <>
          <div className="glass-card mt-6 overflow-x-auto">
            <table className="glass-table min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('admin.users.name')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('admin.users.email')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('admin.users.role')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-400">{t('admin.users.status')}</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-400">{t('admin.users.joined')}</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-400">{t('admin.users.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-100">
                      {user.firstName} {user.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => changeRole(user.id, e.target.value)}
                        className="rounded border border-white/10 bg-dark-900 px-2 py-1 text-xs text-gray-200 [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          user.active ? 'badge-success' : 'badge-danger'
                        )}
                      >
                        {user.active ? t('common.states.active') : t('common.states.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatShortDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleActive(user.id, user.active)}
                        className={cn(
                          'rounded px-3 py-1 text-xs font-medium',
                          user.active
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                        )}
                      >
                        {user.active ? t('admin.users.suspend') : t('admin.users.activate')}
                      </button>
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
