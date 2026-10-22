'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import api from '@/lib/api';
import ErrorMessage from '@/components/common/ErrorMessage';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const tv = useTranslations('auth.validation');

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(tv('emailRequired'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
    } catch {
      // Don't reveal whether email exists
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('subtitle')}</p>

          {sent ? (
            <div className="mt-6">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-400">
                {t('success')}
              </div>
              <Link
                href="/auth/login"
                className="mt-4 inline-flex text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                &larr; {t('backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && <ErrorMessage message={error} />}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? '...' : t('submit')}
              </button>
              <Link
                href="/auth/login"
                className="inline-flex text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                &larr; {t('backToLogin')}
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
