'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';

export default function PrivacyPage() {
  const t = useTranslations();

  return (
    <div className="relative min-h-screen bg-dark-950 px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-gradient text-3xl font-bold">{t('consent.privacy.title')}</h1>
        <div className="glass-card mt-6 rounded-xl p-8">
          <p className="text-sm text-gray-400">
            {t('consent.privacy.placeholder')}
          </p>
        </div>
        <Link href="/auth/register" className="mt-6 inline-block text-sm text-primary-400 hover:text-primary-300">
          &larr; {t('common.buttons.back')}
        </Link>
      </div>
    </div>
  );
}
