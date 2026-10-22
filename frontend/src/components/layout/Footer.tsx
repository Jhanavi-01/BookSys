'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { TicketIcon } from '@heroicons/react/24/outline';

export default function Footer() {
  const t = useTranslations();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/[0.06] bg-dark-950">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-5">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-lg shadow-fuchsia-500/20">
                <TicketIcon className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="text-lg font-bold text-gradient">bookSys</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {t('footer.tagline')}
            </p>
            {/* Social Icons */}
            <div className="mt-5 flex gap-3">
              <a
                href="#"
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-gray-500 transition-all duration-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:shadow-lg hover:shadow-fuchsia-500/10"
                aria-label={t('footer.social.facebook')}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
              </a>
              <a
                href="#"
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-gray-500 transition-all duration-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:shadow-lg hover:shadow-fuchsia-500/10"
                aria-label={t('footer.social.twitter')}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a
                href="#"
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-gray-500 transition-all duration-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:shadow-lg hover:shadow-fuchsia-500/10"
                aria-label={t('footer.social.instagram')}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                </svg>
              </a>
              <a
                href="#"
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-gray-500 transition-all duration-300 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/10 hover:text-fuchsia-400 hover:shadow-lg hover:shadow-fuchsia-500/10"
                aria-label={t('footer.social.youtube')}
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              {t('footer.company.title')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.company.about')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.company.careers')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.company.press')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.company.blog')}
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              {t('footer.support.title')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.support.helpCenter')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.support.contactUs')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.support.faq')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.support.accessibility')}
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-300">
              {t('footer.legal.title')}
            </h3>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.legal.terms')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.legal.privacy')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.legal.cookies')}
                </a>
              </li>
              <li>
                <a href="#" className="text-sm text-gray-500 transition-colors duration-200 hover:text-fuchsia-400">
                  {t('footer.legal.refunds')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="glass-divider mt-10 pt-8 text-center text-sm text-gray-600">
          &copy; {year} <span className="text-gray-500">bookSys</span>. {t('footer.copyright')}
        </div>
      </div>
    </footer>
  );
}
