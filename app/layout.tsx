import type { Metadata } from 'next';
import './globals.css';
import { getCMS, getContent } from '@/lib/cms';
import { render } from '@/lib/content';
import { organizationJsonLd, SITE_URL, jsonLd } from '@/lib/seo';
import { homeTokens } from '@/lib/tokens';
import CookieNotice from '@/components/CookieNotice';

export async function generateMetadata(): Promise<Metadata> {
  const cms = getCMS();
  const [settings, content, generators] = await Promise.all([
    cms.getSettings(),
    getContent(),
    cms.getEquipmentByCategory('generator'),
  ]);

  const tokens = homeTokens(generators, settings);
  const seo = content.o('seo.main', tokens);

  /* Поля настроек сайта — шаблоны: в них тоже работают подстановки */
  const defaultTitle = render(
    settings.seoTitle || seo.defaultTitle || `Аренда дизельных генераторов — ${settings.company}, Москва`,
    tokens
  );
  const defaultDescription = render(
    settings.seoDescription ||
      seo.defaultDescription ||
      'Аренда дизельных генераторов в Москве и Московской области.',
    tokens
  );
  const ogTitle = render(settings.ogTitle || seo.ogTitle || defaultTitle, tokens);
  const ogDescription = render(settings.ogDescription || seo.ogDescription || defaultDescription, tokens);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: defaultTitle,
      template: (seo.titleTemplate || '%s — {company}').replace('{company}', settings.company),
    },
    description: defaultDescription,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      locale: 'ru_RU',
      siteName: settings.company,
      url: SITE_URL,
      title: ogTitle,
      description: ogDescription,
      images: settings.heroImage?.url ? [settings.heroImage.url] : undefined,
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
  const [settings, content] = await Promise.all([cms.getSettings(), getContent()]);

  const skipLink = content.s('global.skipLink', 'text') || 'Перейти к основному содержанию';

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
          {skipLink}
        </a>
        {children}
        {/* Уведомление о cookie — показывается, пока нет согласия */}
        <CookieNotice
          labels={content.o('cookie.main')}
          policyUrl={settings.legalPolicyUrl}
        />
      </body>
    </html>
  );
}
