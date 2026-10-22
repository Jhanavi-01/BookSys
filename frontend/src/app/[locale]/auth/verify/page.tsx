'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function VerifyPage() {
  const t = useTranslations('auth.verify');
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [resendEmail, setResendEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('failed');
      return;
    }
    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        setStatus('success');
      } catch {
        setStatus('failed');
      }
    };
    verify();
  }, [token]);

  const handleResend = async () => {
    if (!resendEmail) return;
    try {
      await api.post('/auth/resend-verification', { email: resendEmail });
      setResendSent(true);
    } catch {
      // still show success to not reveal email existence
      setResendSent(true);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center px-4 py-12">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-accent-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white">{t('title')}</h1>

          {status === 'verifying' && (
            <div className="mt-6">
              <LoadingSpinner />
              <p className="mt-4 text-gray-400">{t('verifying')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="mt-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-300">{t('success')}</p>
              <Link href="/auth/login" className="btn-primary mt-6 inline-flex">
                {t('title')}
              </Link>
            </div>
          )}

          {status === 'failed' && (
            <div className="mt-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
                <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-gray-400">{t('failed')}</p>

              {!resendSent ? (
                <div className="mt-6 space-y-3">
                  <input
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Email"
                    className="input-field"
                  />
                  <button onClick={handleResend} className="btn-primary w-full">
                    {t('resend')}
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-emerald-400">{t('resendSuccess')}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
