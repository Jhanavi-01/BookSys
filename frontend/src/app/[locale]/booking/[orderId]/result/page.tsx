'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline';

type ResultStatus = 'confirming' | 'paid' | 'failed' | 'timeout';

export default function PaymentResultPage() {
  const t = useTranslations('payment');
  const params = useParams();
  const orderId = params.orderId as string;

  const [status, setStatus] = useState<ResultStatus>('confirming');
  const [pollCount, setPollCount] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Never trust URL parameters for status - always poll server
    const pollStatus = async () => {
      try {
        const res = await api.get(`/orders/${orderId}`);
        const orderStatus = res.data.status;
        if (orderStatus === 'PAID' || orderStatus === 'CONFIRMED') {
          setStatus('paid');
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (orderStatus === 'FAILED' || orderStatus === 'CANCELLED') {
          setStatus('failed');
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch {
        // Keep polling
      }
      setPollCount((c) => c + 1);
    };

    pollStatus();
    intervalRef.current = setInterval(pollStatus, 2000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderId]);

  // Timeout after 60 seconds of polling
  useEffect(() => {
    if (pollCount >= 30 && status === 'confirming') {
      setStatus('timeout');
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [pollCount, status]);

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] items-center justify-center bg-dark-950 px-4 py-12">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary-600/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md text-center">
        <div className="glass-card rounded-2xl p-8">
          {status === 'confirming' && (
            <>
              <LoadingSpinner size="lg" className="mb-4" />
              <h2 className="text-xl font-semibold text-gray-100">{t('pending.title')}</h2>
              <p className="mt-2 text-gray-400">{t('pending.message')}</p>
              <p className="mt-1 animate-pulse text-sm text-gray-500">{t('pending.checking')}</p>
            </>
          )}

          {status === 'paid' && (
            <>
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                <CheckCircleIcon className="h-10 w-10 text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-green-400">{t('success.title')}</h2>
              <p className="mt-2 text-gray-400">{t('success.message')}</p>
              <p className="mt-1 text-sm text-gray-500">
                {t('success.orderNumber', { id: orderId.slice(0, 8) })}
              </p>
              <Link href="/tickets" className="btn-primary mt-6 inline-flex">
                {t('success.viewTickets')}
              </Link>
            </>
          )}

          {status === 'failed' && (
            <>
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <XCircleIcon className="h-10 w-10 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-red-400">{t('failure.title')}</h2>
              <p className="mt-2 text-gray-400">{t('failure.message')}</p>
              <div className="mt-6 flex flex-col gap-3">
                <Link href={`/booking/${orderId}`} className="btn-primary">
                  {t('failure.tryAgain')}
                </Link>
                <p className="text-xs text-gray-500">{t('failure.contactSupport')}</p>
              </div>
            </>
          )}

          {status === 'timeout' && (
            <>
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-accent-500/10 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <ClockIcon className="h-10 w-10 text-accent-400" />
              </div>
              <h2 className="text-xl font-semibold text-accent-400">{t('pending.title')}</h2>
              <p className="mt-2 text-gray-400">{t('pending.message')}</p>
              <Link href="/orders" className="btn-secondary mt-6 inline-flex">
                View Orders
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
