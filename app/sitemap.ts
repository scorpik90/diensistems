import type { MetadataRoute } from 'next';
import { getCMS } from '@/lib/cms';
import { SITE_URL } from '@/lib/seo';

/**
 * Sitemap генерируется из CMS — новый URL появляется в карте
 * автоматически после публикации записи, без правки файла.
 *
 * Два важных правила:
 *   1) без дублей. Категории перечислены и вручную, и приходят
 *      из CMS как страницы с kind = catalog — раньше из-за этого
 *      каждая попадала в карту дважды, а поисковик видел
 *      «две разные версии» одной страницы;
 *   2) lastmod берётся из даты изменения записи, а не «сейчас»:
 *      иначе при каждой сборке все страницы выглядели бы
 *      обновлёнными сегодня и сигнал свежести терял смысл.
 */

/** Приоритет страницы по её типу */
function priorityFor(slug: string, kind?: string): number {
  if (kind === 'catalog') return 0.9;
  if (slug === 'tsenyinaarendu') return 0.9;
  if (slug.startsWith('arenda')) return 0.8;
  if (slug.startsWith('politika')) return 0.3;
  return 0.6;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cms = getCMS();
  const [equipment, cases, articles, pages] = await Promise.all([
    cms.getEquipment(),
    cms.getCases(),
    cms.getArticles(),
    cms.getPages(),
  ]);

  const now = new Date();

  /* Собираем в карту: ключ — URL, значение — запись.
     Повторный URL перезаписывает предыдущий, а не добавляется. */
  const map = new Map<string, MetadataRoute.Sitemap[number]>();

  const put = (url: string, entry: MetadataRoute.Sitemap[number]) => {
    map.set(url, entry);
  };

  /* 1. Главная */
  put(SITE_URL, { url: SITE_URL, lastModified: now, changeFrequency: 'daily', priority: 1 });

  /* 2. Страницы из CMS */
  for (const p of pages) {
    put(`${SITE_URL}/${p.slug}`, {
      url: `${SITE_URL}/${p.slug}`,
      lastModified: (p as { updatedAt?: string }).updatedAt ?? now,
      changeFrequency: 'weekly',
      priority: priorityFor(p.slug, p.kind),
    });
  }

  for (const e of equipment) {
    const url = `${SITE_URL}/${e.slug}`;
    put(url, {
      url,
      lastModified: (e as { updatedAt?: string }).updatedAt ?? now,
      changeFrequency: 'monthly',
      priority: 0.8,
    });
  }

  for (const c of cases) {
    const url = `${SITE_URL}/${c.slug}`;
    put(url, {
      url,
      lastModified: (c as { updatedAt?: string }).updatedAt ?? now,
      changeFrequency: 'yearly',
      priority: 0.4,
    });
  }

  for (const a of articles) {
    const url = `${SITE_URL}/${a.slug}`;
    put(url, {
      url,
      lastModified: (a as { updatedAt?: string }).updatedAt ?? now,
      changeFrequency: 'monthly',
      priority: 0.6,
    });
  }

  /* 3. Статические адреса, которых нет в CMS.
     Категории и прайс приходят из CMS — здесь только запасной список,
     и он не должен создавать дублей. */
  const staticOnly: { path: string; freq: 'daily' | 'weekly' | 'monthly' | 'yearly'; priority: number }[] = [
    { path: '/arendageneratorov', freq: 'weekly', priority: 0.9 },
    { path: '/mobilnyegeneratory', freq: 'weekly', priority: 0.8 },
    { path: '/arendakompressorov', freq: 'weekly', priority: 0.8 },
    { path: '/kompressornasmeny', freq: 'weekly', priority: 0.7 },
    { path: '/arendamanipulatora', freq: 'weekly', priority: 0.7 },
    { path: '/prodazhabu', freq: 'weekly', priority: 0.6 },
    { path: '/tsenyinaarendu', freq: 'weekly', priority: 0.9 },
    { path: '/nashiobekty', freq: 'monthly', priority: 0.7 },
    { path: '/poleznoe', freq: 'monthly', priority: 0.6 },
    { path: '/dostavka', freq: 'monthly', priority: 0.6 },
    { path: '/prodazhatopliva', freq: 'monthly', priority: 0.5 },
    { path: '/dopoborudovanie', freq: 'monthly', priority: 0.5 },
    { path: '/contacts', freq: 'yearly', priority: 0.5 },
  ];

  for (const s of staticOnly) {
    const url = `${SITE_URL}${s.path}`;
    if (map.has(url)) continue;
    put(url, {
      url,
      lastModified: now,
      changeFrequency: s.freq,
      priority: s.priority,
    });
  }

  return [...map.values()];
}
