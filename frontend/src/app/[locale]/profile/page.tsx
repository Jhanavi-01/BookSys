'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import ErrorMessage from '@/components/common/ErrorMessage';
import { toast } from '@/components/common/Toast';
import { getInitials } from '@/lib/utils';

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user, updateProfile, fetchMe } = useAuthStore();

  // Refresh user data on mount to get latest consent info
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Data deletion
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Consent
  const [marketing, setMarketing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [thirdParty, setThirdParty] = useState(false);
  const [withdrawingConsent, setWithdrawingConsent] = useState(false);
  const [marketingWithdrawn, setMarketingWithdrawn] = useState(!!user?.consentWithdrawnAt);

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile({ firstName, lastName } as any);
      toast('success', t('common.states.success'));
    } catch {
      setError(t('errors.server.generic'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError(t('auth.validation.passwordMin'));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError(t('auth.validation.passwordMismatch'));
      return;
    }

    setPasswordSaving(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast('success', t('profile.changePassword.success'));
    } catch {
      setPasswordError(t('errors.server.generic'));
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteRequest = async () => {
    if (deleteConfirm !== 'DELETE' || !user) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${user.id}/gdpr`);
      toast('success', t('profile.dataManagement.deleteSuccess') || 'Your data has been deleted.');
      // Log the user out since the account is now unusable
      const { logout } = useAuthStore.getState();
      logout();
    } catch {
      toast('error', t('errors.server.generic'));
      setDeleting(false);
    }
  };

  const handleConsentSave = async () => {
    try {
      await api.put('/users/profile', { marketing, analytics, thirdParty });
      toast('success', t('common.states.success'));
    } catch {
      toast('error', t('errors.server.generic'));
    }
  };

  if (!user) return null;

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-8 sm:px-6">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-primary-600/10 blur-3xl" />
        <div className="absolute bottom-20 right-1/3 h-56 w-56 rounded-full bg-accent-500/8 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <h1 className="text-gradient text-2xl font-bold">{t('profile.title')}</h1>

        {/* Avatar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600/20 text-xl font-bold text-primary-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            {getInitials(user.firstName, user.lastName)}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-100">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-gray-500">{user.email}</p>
            <p className="text-xs text-gray-600">
              {t('profile.role')}: {user.role}
            </p>
          </div>
        </div>

        {/* Edit Profile */}
        <div className="glass-card mt-8 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-100">{t('profile.editProfile')}</h2>
          {error && <ErrorMessage message={error} className="mt-3" />}
          <form onSubmit={handleProfileSave} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">
                  {t('profile.firstName')}
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="input-field"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-400">
                  {t('profile.lastName')}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                {t('profile.email')}
              </label>
              <input type="email" value={user.email} disabled className="input-field opacity-50" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                {t('profile.preferences.language')}
              </label>
              <select
                value={locale}
                onChange={(e) => {
                  router.replace('/profile', { locale: e.target.value as 'en' | 'vi' });
                }}
                className="input-field"
              >
                <option value="en">{t('common.language.en')}</option>
                <option value="vi">{t('common.language.vi')}</option>
              </select>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? t('common.states.saving') : t('common.buttons.save')}
            </button>
          </form>
        </div>

        {/* Change Password */}
        <div className="glass-card mt-6 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-100">{t('profile.changePassword.title')}</h2>
          {passwordError && <ErrorMessage message={passwordError} className="mt-3" />}
          <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                {t('profile.changePassword.currentPassword')}
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input-field"
                autoComplete="current-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                {t('profile.changePassword.newPassword')}
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-400">
                {t('profile.changePassword.confirmPassword')}
              </label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={passwordSaving} className="btn-primary">
              {passwordSaving ? t('common.states.saving') : t('profile.changePassword.submit')}
            </button>
          </form>
        </div>

        {/* Consent Management */}
        <div className="glass-card mt-6 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-100">{t('profile.consent.title')}</h2>

          {/* Consent version and date */}
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{t('profile.consent.version')}</span>
              <span className="text-sm font-medium text-gray-200">{user.consentVersion || '-'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{t('profile.consent.agreedAt')}</span>
              <span className="text-sm font-medium text-gray-200">
                {user.consentAt ? new Date(user.consentAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
              </span>
            </div>
            {marketingWithdrawn && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{t('profile.consent.marketingStatus')}</span>
                <span className="text-sm font-medium text-yellow-400">{t('profile.consent.withdrawn')}</span>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t('profile.consent.marketing')}</span>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t('profile.consent.analytics')}</span>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{t('profile.consent.thirdParty')}</span>
              <input
                type="checkbox"
                checked={thirdParty}
                onChange={(e) => setThirdParty(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 text-primary-500"
              />
            </label>
            <div className="flex gap-3 pt-2">
              <button onClick={handleConsentSave} className="btn-secondary">
                {t('common.buttons.save')}
              </button>
              {!marketingWithdrawn && (
                <button
                  onClick={async () => {
                    setWithdrawingConsent(true);
                    try {
                      await api.post('/auth/withdraw-marketing-consent');
                      setMarketingWithdrawn(true);
                      setMarketing(false);
                      toast('success', t('profile.consent.withdrawSuccess'));
                    } catch {
                      toast('error', t('errors.server.generic'));
                    } finally {
                      setWithdrawingConsent(false);
                    }
                  }}
                  disabled={withdrawingConsent}
                  className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/20 transition-colors"
                >
                  {withdrawingConsent ? t('common.states.processing') : t('profile.consent.withdrawMarketing')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Data Deletion */}
        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-semibold text-red-400">{t('profile.dataManagement.title')}</h2>
          <p className="mt-2 text-sm text-gray-400">{t('profile.dataManagement.deleteWarning')}</p>
          <div className="mt-4 space-y-3">
            <button
              onClick={async () => {
                try {
                  const res = await api.get('/users/me/export');
                  const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'my-data.json';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast('error', t('errors.server.generic'));
                }
              }}
              className="btn-secondary text-sm"
            >
              {t('profile.dataManagement.exportData')}
            </button>
            <div>
              <label className="mb-1 block text-sm text-gray-500">
                {t('profile.dataManagement.deleteConfirm')}
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                className="input-field"
                placeholder="DELETE"
              />
            </div>
            <button
              onClick={handleDeleteRequest}
              disabled={deleteConfirm !== 'DELETE' || deleting}
              className="btn-danger text-sm"
            >
              {t('profile.dataManagement.deleteRequest')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
