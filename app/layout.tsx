import type { Metadata } from 'next';
import './globals.css';
import { getCMS } from '@/lib/cms';
import { jsonLd, organizationJsonLd, SITE_URL } from '@/lib/seo';
import CookieNotice from '@/components/CookieNotice';

export async function generateMetadata(): Promise<Metadata> {
  const cms = getCMS();
  const settings = await cms.getSettings();

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: `Аренда дизельных генераторов от 2 000 ₽/сутки — ${settings.company}, Москва`,
      template: `%s — ${settings.company}`,
    },
    description:
      'Аренда дизельных генераторов AIRMAN, DENYO и Cummins от 2 000 ₽/сутки. Собственный парк 64 МВт, доставка от 2 часов, ТО и выездная поддержка 24/7. Москва и МО.',
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: settings.company,
      url: SITE_URL,
      title: 'Аренда дизельных генераторов от 2 000 ₽/сутки',
      description:
        'Собственный парк 64 МВт. Доставка от 2 часов по Москве и МО. ТО, ГРЩ, кабель и оператор включены в тарифы.',
      images: ['/images/hero-2/1280.jpg'],
    },
    twitter: { card: 'summary_large_image' },
    icons: {
      icon: [
        { url: '/icon.png', type: 'image/png', sizes: '512x512' },
        { url: '/favicon.ico', sizes: '32x32' },
      ],
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.webmanifest',
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cms = getCMS();
  const settings = await cms.getSettings();

  return (
    <html lang="ru">
      <head>
        {/* Микроразметка — рендерится на сервере, поисковик видит её без JS */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationJsonLd(settings)) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Перейти к основному содержанию
        </a>
        {children}
        {/* Уведомление о cookie — показывается, пока нет согласия */}
        <CookieNotice />
      </body>
    </html>
  );
}
