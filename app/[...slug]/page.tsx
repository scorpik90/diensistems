import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCMS } from '@/lib/cms';
import { categoryContent } from '@/lib/category-content';
import { pageDescription, pageTitle } from '@/lib/seo-meta';
import {
  articleDescription,
  articleTitle,
  caseDescription,
  caseTitle,
  productDescription,
  productTitle,
} from '@/lib/product-meta';
import EquipmentView from '@/components/pages/EquipmentView';
import ArticleView from '@/components/pages/ArticleView';
import CaseView from '@/components/pages/CaseView';
import PageView from '@/components/pages/PageView';
import ContactsView from '@/components/pages/ContactsView';

/**
 * Catch-all маршрут для ПЛОСКИХ legacy-URL.
 *
 * Боевой сайт использует односегментные адреса:
 *   /arendadizelnogogeneratora100kvt
 *   /arendacompressoraairmanpds185s
 *   /arendapes60kvt
 *   /vidy-tipy-elektrostancij-plyusy-i-minusy-chast-tretya-dizelnaya
 *
 * В App Router плоский URL на верхнем уровне возможен только через
 * catch-all. Статические маршруты (/arendageneratorov, /contacts, ...)
 * имеют приоритет над catch-all — конфликтов нет.
 *
 * ПРИНЦИП: slug'и наследуются от боевого сайта один в один.
 * Меняем движок, не меняем адреса → риск падения позиций ≈ 0.
 */
export const dynamicParams = false;

/**
 * ISR: карточки пересобираются раз в минуту, поэтому правка цены
 * в редакторе (/admin) попадает на сайт без перезапуска.
 */
export const revalidate = 60;

export async function generateStaticParams() {
  const cms = getCMS();
  const [equipment, articles, cases, pages, redirects] = await Promise.all([
    cms.getEquipment(),
    cms.getArticles(),
    cms.getCases(),
    cms.getPages(),
    cms.getRedirects(),
  ]);

  /* Устаревшие адреса → permanentRedirect на канонический */
  const redirectParams = Object.entries(redirects).map(([from]) => ({ slug: [from] }));

  return [
    ...equipment.map((e) => ({ slug: [e.slug] })),
    ...articles.map((a) => ({ slug: [a.slug] })),
    ...cases.map((c) => ({ slug: [c.slug] })),
    ...pages.map((p) => ({ slug: [p.slug] })),
    ...redirectParams,
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (slug.length !== 1) return {};

  const cms = getCMS();
  const key = slug[0];

  const equipment = await cms.getEquipmentBySlug(key);
  if (equipment) {
    return {
      title: productTitle(equipment),
      description: productDescription(equipment),
      alternates: { canonical: `/${equipment.slug}` },
      openGraph: { type: 'article', title: equipment.title },
    };
  }

  const article = await cms.getArticle(key);
  if (article) {
    return {
      title: articleTitle(article),
      description: articleDescription(article),
      alternates: { canonical: `/${article.slug}` },
      openGraph: { type: 'article', title: article.title },
    };
  }

  const caseStudy = await cms.getCase(key);
  if (caseStudy) {
    return {
      title: caseTitle(caseStudy),
      description: caseDescription(caseStudy),
      alternates: { canonical: `/${caseStudy.slug}` },
      openGraph: { type: 'article', title: caseStudy.title },
    };
  }

  const page = await cms.getPage(key);
  if (page) {
    /* Для каталогов сниппет собирается из данных каталога:
       актуальные цены, количество моделей и диапазон мощностей */
    let description = pageDescription(page);
    if (page.kind === 'catalog' && page.category) {
      const items = await cms.getEquipmentByCategory(page.category);
      const cat = categoryContent(page.kind, page.slug, page.category, items);
      if (cat?.description) description = cat.description;
    }

    return {
      title: pageTitle(page),
      description,
      alternates: { canonical: `/${page.slug}` },
    };
  }

  return {};
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const cms = getCMS();
  const settings = await cms.getSettings();

  if (slug.length !== 1) notFound();
  const key = slug[0];

  /* 1) Устаревший адрес → 301 на канонический */
  const redirects = await cms.getRedirects();
  if (redirects[key]) {
    permanentRedirect(`/${redirects[key]}`);
  }

  /* 2) Позиция каталога */
  const equipment = await cms.getEquipmentBySlug(key);
  if (equipment) return <EquipmentView item={equipment} settings={settings} />;

  /* 3) Статья */
  const article = await cms.getArticle(key);
  if (article) return <ArticleView article={article} settings={settings} />;

  /* 4) Кейс */
  const caseStudy = await cms.getCase(key);
  if (caseStudy) return <CaseView item={caseStudy} settings={settings} />;

  /* 5) Статическая страница */
  const page = await cms.getPage(key);
  if (page) {
    if (page.kind === 'contacts') return <ContactsView page={page} settings={settings} />;
    return <PageView page={page} settings={settings} />;
  }

  notFound();
}
