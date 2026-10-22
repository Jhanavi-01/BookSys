'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function PaymentRedirectPage() {
  const t = useTranslations('payment.processing');
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  useEffect(() => {
    const initPayment = async () => {
      try {
        const returnUrl = `${window.location.origin}/booking/${orderId}/result`;
        const res = await api.post('/payments/create', {
          orderId,
          returnUrl,
          cancelUrl: returnUrl,
        });
        const payUrl = res.data.paymentUrl || res.data.redirectUrl;
        if (payUrl) {
          window.location.href = payUrl;
        } else {
          router.push(`/booking/${orderId}/result`);
        }
      } catch {
        router.push(`/booking/${orderId}/result`);
      }
    };
    initPayment();
  }, [orderId, router]);

  return (
    <div className="relative flex min-h-[calc(100vh-200px)] flex-col items-center justify-center bg-dark-950 px-4">
      {/* Gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-primary-600/15 blur-3xl" />
      </div>

      <div className="relative">
        <LoadingSpinner size="lg" />
        <h2 className="mt-6 text-gradient text-xl font-semibold">{t('title')}</h2>
        <p className="mt-2 text-gray-400">{t('redirecting')}</p>
        <p className="mt-1 text-sm text-red-400">{t('doNotClose')}</p>
      </div>
    </div>
  );
}
