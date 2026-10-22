'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { useSearchParams } from 'next/navigation';
import { TicketIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import ErrorMessage from '@/components/common/ErrorMessage';
import api from '@/lib/api';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLocked, setIsLocked] = useState(false);

  // Consent re-agreement state
  const [consentRequired, setConsentRequired] = useState(false);
  const [consentUserId, setConsentUserId] = useState('');
  const [consentVersion, setConsentVersion] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [consentLoading, setConsentLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') || '/';

  const validate = (): boolean => {
    if (!email) {
      setError(t('auth.validation.emailRequired'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t('auth.validation.emailInvalid'));
      return false;
    }
    if (!password) {
      setError(t('auth.validation.passwordRequired'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLocked(false);

    if (!validate()) return;

    try {
      await login(email, password);
      router.push(redirectTo);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.code;
      const data = err?.response?.data;

      // Check if the login response indicates consent is required
      if (data?.consentRequired) {
        setConsentRequired(true);
        setConsentUserId(data.userId);
        setConsentVersion(data.requiredVersion);
        return;
      }

      if (status === 423 || code === 'ACCOUNT_LOCKED') {
        setIsLocked(true);
      } else if (status === 401) {
        setError(t('auth.login.invalid'));
      } else {
        setError(t('errors.server.generic'));
      }
    }
  };

  const handleAcceptConsent = async () => {
    setConsentLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/accept-consent', {
        userId: consentUserId,
        consentVersion,
      });
      const { token, user } = res.data;
      useAuthStore.setState({ token, user });
      router.push(redirectTo);
    } catch {
      setError(t('errors.server.generic'));
    } finally {
      setConsentLoading(false);
    }
  };

  if (consentRequired) {
    return (
      <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md">
          <div className="glass-card p-8">
            <h2 className="text-xl font-bold text-white">{t('auth.consent.title')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('auth.consent.policyUpdated')}</p>

            {error && <ErrorMessage message={error} className="mt-4" />}

            <label className="mt-6 flex items-start gap-2">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => setConsentAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-white/5 text-primary-500 focus:ring-primary-500/50"
              />
              <span className="text-sm text-gray-400">
                {t('auth.register.agreePrefix')}{' '}
                <Link href="/terms" className="text-primary-400 hover:text-primary-300 underline">
                  {t('auth.register.termsLink')}
                </Link>{' '}
                {t('auth.register.and')}{' '}
                <Link href="/privacy" className="text-primary-400 hover:text-primary-300 underline">
                  {t('auth.register.privacyLink')}
                </Link>
              </span>
            </label>

            <button
              onClick={handleAcceptConsent}
              disabled={!consentAccepted || consentLoading}
              className="btn-primary mt-6 w-full"
            >
              {consentLoading ? t('common.states.loading') : t('auth.consent.accept')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/25">
            <TicketIcon className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-white">{t('auth.login.title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('auth.login.subtitle')}</p>
        </div>

        <div className="glass-card p-8">
          {isLocked && (
            <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
              {t('auth.login.locked')}
            </div>
          )}

          {error && <ErrorMessage message={error} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-300">
                {t('auth.login.email')}
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                autoComplete="email"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-300">
                {t('auth.login.password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-white/5 text-primary-500 focus:ring-primary-500/50"
                />
                <span className="text-sm text-gray-400">{t('auth.login.rememberMe')}</span>
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
              >
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full"
            >
              {isLoading ? t('common.states.loading') : t('auth.login.submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            {t('auth.login.noAccount')}{' '}
            <Link
              href="/auth/register"
              className="font-semibold text-primary-400 hover:text-primary-300 transition-colors"
            >
              {t('auth.login.signUp')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
