'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Link, useRouter, usePathname } from '@/i18n/routing';
import { useAuthStore, UserRole } from '@/store/auth';
import {
  Bars3Icon,
  XMarkIcon,
  GlobeAltIcon,
  UserCircleIcon,
  ChevronDownIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

function getNavItems(role: UserRole | undefined, t: (key: string) => string) {
  const base = [
    { href: '/' as const, label: t('common.nav.home') },
    { href: '/events' as const, label: t('common.nav.events') },
  ];

  if (!role) return base;

  switch (role) {
    case 'CUSTOMER':
      return [
        ...base,
        { href: '/tickets' as const, label: t('common.nav.myTickets') },
        { href: '/orders' as const, label: t('common.nav.orders') },
      ];
    case 'ORGANIZER':
      return [
        ...base,
        { href: '/organizer' as const, label: t('common.nav.dashboard') },
        { href: '/organizer/events' as const, label: t('common.nav.manageEvents') },
        { href: '/organizer/venues' as const, label: t('common.nav.venues') },
        { href: '/organizer/reports' as const, label: t('common.nav.reports') },
      ];
    case 'ENTRY_STAFF':
      return [
        ...base,
        { href: '/scanner' as const, label: t('common.nav.scanner') },
      ];
    case 'ACCOUNTANT':
      return [
        ...base,
        { href: '/accountant' as const, label: t('common.nav.dashboard') },
        { href: '/accountant/reconciliation' as const, label: t('common.nav.reconciliation') },
      ];
    case 'ADMIN':
      return [
        ...base,
        { href: '/admin' as const, label: t('common.nav.dashboard') },
        { href: '/admin/users' as const, label: t('common.nav.users') },
        { href: '/admin/audit' as const, label: t('common.nav.auditLog') },
      ];
    default:
      return base;
  }
}

export default function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isHydrated, logout } = useAuthStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = getNavItems(user?.role, t);

  const toggleLocale = () => {
    const newLocale = locale === 'en' ? 'vi' : 'en';
    router.replace(pathname, { locale: newLocale });
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferred-locale', newLocale);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-dark-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-500/20 transition-shadow duration-300 group-hover:shadow-orange-500/40">
              <TicketIcon className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gradient">bookSys</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
                  pathname === item.href
                    ? 'bg-white/[0.08] text-white shadow-sm shadow-white/[0.04]'
                    : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                )}
              >
                {pathname === item.href && (
                  <span className="absolute inset-x-3 -bottom-[13px] h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent" />
                )}
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm font-medium text-gray-400 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.08] hover:text-gray-200"
              aria-label={t('common.language.switchTo')}
            >
              <GlobeAltIcon className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                {locale === 'en' ? 'EN' : 'VI'}
              </span>
            </button>

            {/* User Menu / Auth */}
            {isHydrated && user ? (
              <div className="relative" ref={userRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-gray-300 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.08] hover:text-white"
                >
                  <UserCircleIcon className="h-5 w-5" />
                  <span className="hidden max-w-[100px] truncate text-sm font-medium sm:inline">
                    {user.firstName}
                  </span>
                  <ChevronDownIcon className={cn(
                    'hidden h-4 w-4 transition-transform duration-200 sm:block',
                    userMenuOpen && 'rotate-180'
                  )} />
                </button>
                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-white/[0.08] bg-dark-900/95 py-1 shadow-xl shadow-black/40 backdrop-blur-xl">
                    <div className="border-b border-white/[0.06] px-4 py-3">
                      <p className="text-sm font-semibold text-gray-100">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <Link
                      href="/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                    >
                      {t('common.nav.profile')}
                    </Link>
                    {user.role === 'CUSTOMER' && (
                      <>
                        <Link
                          href="/tickets"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                        >
                          {t('common.nav.myTickets')}
                        </Link>
                        <Link
                          href="/orders"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex w-full px-4 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/[0.05] hover:text-white"
                        >
                          {t('common.nav.orders')}
                        </Link>
                      </>
                    )}
                    <div className="border-t border-white/[0.06]">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          logout();
                        }}
                        className="flex w-full px-4 py-2.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                      >
                        {t('common.nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : isHydrated ? (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/auth/login" className="btn-ghost text-sm">
                  {t('common.nav.login')}
                </Link>
                <Link href="/auth/register" className="btn-primary text-sm">
                  {t('common.nav.register')}
                </Link>
              </div>
            ) : null}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="rounded-lg border border-white/[0.06] bg-white/[0.04] p-2 text-gray-400 transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.08] hover:text-gray-200 md:hidden"
            >
              {mobileOpen ? (
                <XMarkIcon className="h-5 w-5" />
              ) : (
                <Bars3Icon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="border-t border-white/[0.06] py-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                    pathname === item.href
                      ? 'bg-white/[0.08] text-white'
                      : 'text-gray-400 hover:bg-white/[0.05] hover:text-gray-200'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {isHydrated && !user && (
                <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="btn-secondary text-center text-sm"
                  >
                    {t('common.nav.login')}
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileOpen(false)}
                    className="btn-primary text-center text-sm"
                  >
                    {t('common.nav.register')}
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
