'use client';

import { useState, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/store/auth';
import { TicketIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import ErrorMessage from '@/components/common/ErrorMessage';

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const { register, isLoading } = useAuthStore();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const update = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = (): boolean => {
    if (!form.firstName.trim()) {
      setError(t('auth.validation.firstNameRequired'));
      return false;
    }
    if (!form.lastName.trim()) {
      setError(t('auth.validation.lastNameRequired'));
      return false;
    }
    if (!form.email) {
      setError(t('auth.validation.emailRequired'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t('auth.validation.emailInvalid'));
      return false;
    }
    if (!form.password) {
      setError(t('auth.validation.passwordRequired'));
      return false;
    }
    if (form.password.length < 8) {
      setError(t('auth.validation.passwordMin'));
      return false;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      setError(t('auth.validation.passwordWeak'));
      return false;
    }
    if (form.password !== form.confirmPassword) {
      setError(t('auth.validation.passwordMismatch'));
      return false;
    }
    if (!form.agreeTerms) {
      setError(t('auth.validation.termsRequired'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validate()) return;

    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        consentAccepted: true,
      });
      setSuccess(true);
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 409) {
        setError(t('auth.register.duplicateEmail'));
      } else {
        setError(t('errors.server.generic'));
      }
    }
  };

  if (success) {
    return (
      <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
        </div>
        <div className="relative w-full max-w-md text-center">
          <div className="glass-card p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">{t('common.states.success')}</h2>
            <p className="mt-2 text-sm text-gray-400">{t('auth.register.success')}</p>
            <Link href="/auth/login" className="btn-primary mt-6 inline-flex">
              {t('auth.register.signIn')}
            </Link>
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
          <h1 className="mt-4 text-2xl font-bold text-white">{t('auth.register.title')}</h1>
          <p className="mt-1 text-sm text-gray-400">{t('auth.register.subtitle')}</p>
        </div>

        <div className="glass-card p-8">
          {error && <ErrorMessage message={error} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  {t('auth.register.firstName')}
                </label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  className="input-field"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  {t('auth.register.lastName')}
                </label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  className="input-field"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t('auth.register.email')}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="input-field"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t('auth.register.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  className="input-field pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-1.5 flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full ${
                        form.password.length >= level * 3 &&
                        (level <= 2 || /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
                          ? level <= 1
                            ? 'bg-red-400'
                            : level <= 2
                            ? 'bg-yellow-400'
                            : level <= 3
                            ? 'bg-emerald-400'
                            : 'bg-emerald-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">
                {t('auth.register.confirmPassword')}
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                className="input-field"
                autoComplete="new-password"
              />
            </div>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={form.agreeTerms}
                onChange={(e) => update('agreeTerms', e.target.checked)}
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

            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? t('common.states.loading') : t('auth.register.submit')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            {t('auth.register.hasAccount')}{' '}
            <Link href="/auth/login" className="font-semibold text-primary-400 hover:text-primary-300 transition-colors">
              {t('auth.register.signIn')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
