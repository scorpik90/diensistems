/**
 * Слой доступа к CMS.
 *
 * ГЛАВНАЯ ИДЕЯ ВАРИАНТА C1: страницы не знают, откуда пришли данные.
 * Они спрашивают getCMS() и получают типизированные сущности.
 *
 *   CMS_PROVIDER=mock    → content/seed.json      (прототип, работает офлайн)
 *   CMS_PROVIDER=strapi  → http://cms:1337/api    (прод, реальная CMS)
 *
 * Переключение — одна переменная окружения, ноль правок в компонентах.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';
import seed from '@/content/seed.json';
import { Content } from '@/lib/content';
import type {
  Article,
  CaseStudy,
  Category,
  CategoryId,
  CmsImage,
  ContentBlock,
  Equipment,
  MenuItem,
  PriceTable,
  Review,
  Seed,
  SiteSettings,
  StaticPage,
} from './types';

export interface CMSProvider {
  name: string;
  getSettings(): Promise<SiteSettings>;
  getCategories(): Promise<Category[]>;
  getEquipment(): Promise<Equipment[]>;
  getEquipmentByCategory(category: CategoryId): Promise<Equipment[]>;
  getEquipmentBySlug(slug: string): Promise<Equipment | null>;
  getArticles(): Promise<Article[]>;
  getReviews(): Promise<Review[]>;
  getArticle(slug: string): Promise<Article | null>;
  getCases(): Promise<CaseStudy[]>;
  getCase(slug: string): Promise<CaseStudy | null>;
  getPages(): Promise<StaticPage[]>;
  getPage(slug: string): Promise<StaticPage | null>;
  getPriceTables(): Promise<PriceTable[]>;
  getRedirects(): Promise<Record<string, string>>;
  /** Редактируемые текстовые блоки */
  getContentBlocks(): Promise<ContentBlock[]>;
  /** Пункты меню */
  getMenuItems(): Promise<MenuItem[]>;
  /** Готовый объект доступа к контенту (CMS + запасной снимок) */
  getContent(): Promise<Content>;
}

/**
 * Приведение медиатеки Strapi к общей модели изображения.
 *
 * В Strapi 5 поле media — это массив объектов; url относительный
 * («/uploads/x.jpg»), поэтому к нему подставляется адрес CMS.
 *
 * Фотографии лежат только в CMS. Если CMS недоступна, изображений
 * просто нет — компонент рисует аккуратную заглушку, а не битую
 * картинку со ссылкой на несуществующий файл.
 */
export function toImage(raw: unknown, baseUrl = ''): CmsImage | null {
  if (!raw) return null;

  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || typeof first !== 'object') return null;
  const m = first as Record<string, unknown>;
  const url = typeof m.url === 'string' ? m.url : null;
  if (!url) return null;

  /* В Strapi url относительный («/uploads/x.jpg») — добавляем адрес CMS.
     То же и для производных размеров, иначе браузер ищет их
     на домене сайта, а не CMS. */
  const abs = (u: string) => (u.startsWith('http') ? u : `${baseUrl}${u}`);
  const rawFormats = (m.formats ?? {}) as Record<string, { url?: string; width?: number; height?: number }>;
  const formats: CmsImage['formats'] = {};
  for (const [key, f] of Object.entries(rawFormats)) {
    if (f?.url) {
      formats[key] = { url: abs(f.url), width: Number(f.width ?? 0), height: Number(f.height ?? 0) };
    }
  }

  return {
    url: abs(url),
    width: Number(m.width ?? 0),
    height: Number(m.height ?? 0),
    alternativeText: (m.alternativeText as string | null) ?? null,
    formats,
  };
}

/**
 * Приведение записи к общей модели.
 *
 * В mock-режиме цена лежит в price.{value,unit}, в Strapi — в плоских
 * полях priceValue/priceUnit. Здесь обе схемы приводятся к одному виду,
 * чтобы компоненты не знали, откуда пришли данные.
 *
 * Также вычисляются производные поля: URL категории и папка с картинками.
 */
function decorate(
  raw: Equipment & { priceValue?: number; priceUnit?: string },
  categories: Category[],
  mediaBase = ''
): Equipment {
  const price =
    raw.price ??
    (raw.priceValue != null ? { value: raw.priceValue, unit: raw.priceUnit || '/сутки' } : null);

  const cat = categories.find((c) => c.id === raw.category);

  return {
    ...raw,
    price,
    categorySlug: cat?.slug,
    /* Фото — из медиатеки Strapi */
    image: toImage(raw.image, mediaBase),
  };
}

/* ─── Мок-адаптер ───────────────────────────────────────────────────── */

const SEED_PATH = path.join(process.cwd(), 'content', 'seed.json');

class MockCMS implements CMSProvider {
  name = 'mock';

  /** Данные, зашитые в сборку (используются, если файла нет на диске) */
  private bundled: Seed = seed as unknown as Seed;

  /** Кэш прочитанного с диска файла — перечитывается при изменении mtime */
  private disk: { data: Seed; mtime: number } | null = null;

  /**
   * В mock-режиме данные читаются с диска, а не из бандла.
   * Правка content/seed.json подхватывается при следующем запросе
   * (после истечения ISR-окна) — без пересборки приложения.
   * Это то, чем заменяется редактор CMS на этапе прототипа.
   */
  private data(): Seed {
    try {
      const stat = fs.statSync(SEED_PATH);
      if (!this.disk || this.disk.mtime !== stat.mtimeMs) {
        const raw = fs.readFileSync(SEED_PATH, 'utf8');
        this.disk = { data: JSON.parse(raw) as Seed, mtime: stat.mtimeMs };
      }
      return this.disk.data;
    } catch {
      return this.bundled;
    }
  }

  private decorate(e: Equipment): Equipment {
    return decorate(e, this.data().categories);
  }

  async getSettings() {
    return this.data().settings;
  }
  async getCategories() {
    return this.data().categories;
  }
  async getEquipment() {
    return this.data().equipment.map((e) => this.decorate(e));
  }
  async getEquipmentByCategory(category: CategoryId) {
    return this.data().equipment.filter((e) => e.category === category).map((e) => this.decorate(e));
  }
  async getEquipmentBySlug(slug: string) {
    const found = this.data().equipment.find((e) => e.slug === slug);
    return found ? this.decorate(found) : null;
  }
  async getArticles() {
    return this.data().articles;
  }
  /** Кэш content/reviews.json (по mtime — как и seed.json) */
  private reviewsFile: { data: Review[]; mtime: number } | null = null;

  async getReviews() {
    /* В seed.json поле reviews пустое — реальные отзывы с Яндекс.Карт
       пишет в content/reviews.json скрипт fetch-yandex-reviews.mjs
       (формат: { all: Review[] }). Читаем оттуда, seed — как запасной
       источник. */
    return this.reviewsData().sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
  }

  private reviewsData(): Review[] {
    const fromSeed = this.data().reviews ?? [];
    if (fromSeed.length) return fromSeed;
    try {
      const p = path.join(process.cwd(), 'content', 'reviews.json');
      const stat = fs.statSync(p);
      if (!this.reviewsFile || this.reviewsFile.mtime !== stat.mtimeMs) {
        const json = JSON.parse(fs.readFileSync(p, 'utf8')) as { all?: Review[] };
        this.reviewsFile = { data: json.all ?? [], mtime: stat.mtimeMs };
      }
      return this.reviewsFile.data;
    } catch {
      return [];
    }
  }
  async getArticle(slug: string) {
    return this.data().articles.find((a) => a.slug === slug) ?? null;
  }
  async getCases() {
    return this.data().cases;
  }
  async getCase(slug: string) {
    return this.data().cases.find((c) => c.slug === slug) ?? null;
  }
  async getPages() {
    return this.data().pages;
  }
  async getPage(slug: string) {
    return this.data().pages.find((p) => p.slug === slug) ?? null;
  }
  async getPriceTables() {
    return this.data().priceTables;
  }
  async getRedirects() {
    return this.data().redirects;
  }

  /** В mock-режиме блоков в CMS нет — берём из запасного снимка */
  async getContentBlocks(): Promise<ContentBlock[]> {
    return [];
  }

  async getMenuItems(): Promise<MenuItem[]> {
    return [];
  }

  async getContent(): Promise<Content> {
    const c = new Content([], []);
    const cats: Record<string, Record<string, unknown>> = {};
    for (const cat of this.data().categories) {
      cats[cat.id] = {
        answer: null,
        facts: null,
        includes: null,
        includesNote: null,
        faq: null,
        seoDescription: null,
        heroTitle: null,
      };
    }
    c.setCategories(cats);
    return c;
  }
}

/* ─── Strapi-адаптер ────────────────────────────────────────────────── */

interface StrapiEntity<T> {
  id: number;
  documentId: string;
  /** Strapi 5 отдаёт атрибуты плоско, без вложенного .attributes */
  [K: string]: T | number | string | undefined;
}

class StrapiCMS implements CMSProvider {
  name = 'strapi';
  private base: string;
  private token: string;

  constructor(base: string, token: string) {
    /* Базовый URL Strapi включает префикс /api — так пути в адаптере
       выглядят как /equipment, /articles и т.п. */
    this.base = base.replace(/\/$/, '') + '/api';
    this.token = token;
  }

  private async fetchList<T>(path: string): Promise<T[]> {
    const res = await fetch(`${this.base}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
      /* TTL fetch'ей = revalidate страниц (60 с). Раньше здесь стояло 300:
         после правки цены данные сайта отставали от CMS до 5 минут
         даже внутри ISR-обновления. */
      next: { revalidate: 60, tags: ['cms'] },
    });
    if (!res.ok) throw new Error(`Strapi ${path} → HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    /* В Strapi 5 атрибуты лежат прямо в объекте записи */
    return (json.data ?? []) as T[];
  }

  private async one<T>(path: string): Promise<T | null> {
    const list = await this.fetchList<T>(path);
    return list[0] ?? null;
  }

  /**
   * Адрес CMS без /api — к нему приклеиваются относительные url медиатеки.
   *
   * Для ссылок в вёрстке нужен ПУБЛИЧНЫЙ адрес (CMS_PUBLIC_URL):
   * внутри контейнеров CMS доступна по http://strapi:1337, а браузер
   * посетителя такой адрес не откроет.
   */
  private get mediaBase(): string {
    const pub = process.env.CMS_PUBLIC_URL;
    if (pub) return pub.replace(/\/$/, '');
    return this.base.replace(/\/api$/, '');
  }

  async getSettings() {
    const s = await this.one<SiteSettings>('/site-settings?pagination[pageSize]=1&populate=*');
    if (!s) throw new Error('Strapi: нет записи site-settings');
    return {
      ...s,
      logo: toImage(s.logo, this.mediaBase),
      logoMark: toImage(s.logoMark, this.mediaBase),
      heroImage: toImage(s.heroImage, this.mediaBase),
    };
  }

  async getCategories() {
    const list = await this.fetchList<Category>('/categories?sort=key:asc&populate=*');
    /* В Strapi категория хранится с полем «key», а в модели id.
       Приводим к общему виду — иначе не работает связь
       «позиция → её категория» (и, как следствие, хлебные крошки). */
    return list.map((c) => ({
      ...c,
      id: (c.key ?? c.id) as CategoryId,
      image: toImage(c.image, this.mediaBase),
    }));
  }

  private async equipment(): Promise<Equipment[]> {
    const categories = await this.getCategories();
    const list = await this.fetchList<Equipment>('/equipment?pagination[pageSize]=200&populate=*');
    return list.map((e) => decorate(e, categories, this.mediaBase));
  }

  async getEquipment() {
    return this.equipment();
  }

  async getEquipmentByCategory(category: CategoryId) {
    return (await this.equipment()).filter((e) => e.category === category);
  }

  async getEquipmentBySlug(slug: string) {
    const categories = await this.getCategories();
    /* populate обязателен: без него медиатека не приходит и
       позиция остаётся без фотографии. */
    const found = await this.one<Equipment>(
      `/equipment?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1&populate=*`
    );
    return found ? decorate(found, categories, this.mediaBase) : null;
  }

  async getArticles() {
    return this.fetchList<Article>('/articles?sort=title:asc');
  }

  async getReviews() {
    const list = await this.fetchList<Review>('/reviews?sort=order:asc');
    return list.sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
  }

  async getArticle(slug: string) {
    return this.one<Article>(
      `/articles?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
    );
  }

  async getCases() {
    const list = await this.fetchList<CaseStudy>('/cases?sort=title:asc&populate=*');
    return list.map((c) => ({ ...c, image: toImage(c.image, this.mediaBase) }));
  }

  async getCase(slug: string) {
    const found = await this.one<CaseStudy>(
      `/cases?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1&populate=*`
    );
    return found ? { ...found, image: toImage(found.image, this.mediaBase) } : null;
  }

  async getPages() {
    return this.fetchList<StaticPage>('/pages?sort=slug:asc');
  }

  async getPage(slug: string) {
    return this.one<StaticPage>(
      `/pages?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
    );
  }

  async getPriceTables() {
    return this.fetchList<PriceTable>('/price-tables?sort=index:asc');
  }

  async getRedirects() {
    const list = await this.fetchList<{ from: string; to: string }>('/redirects');
    return Object.fromEntries(list.map((e) => [e.from, e.to]));
  }

  /* ── Редактируемый контент ────────────────────────────────────────── */

  async getContentBlocks(): Promise<ContentBlock[]> {
    const list = await this.fetchList<ContentBlock>('/content-blocks?sort=order:asc');
    return list.filter((b) => b.isActive !== false);
  }

  async getMenuItems(): Promise<MenuItem[]> {
    const list = await this.fetchList<MenuItem>('/menu-items?sort=order:asc');
    return list.filter((m) => m.isActive !== false);
  }

  async getContent(): Promise<Content> {
    const [blocks, menu, categories] = await Promise.all([
      this.getContentBlocks(),
      this.getMenuItems(),
      this.getCategories(),
    ]);
    const content = new Content(blocks, menu);
    const cats: Record<string, Record<string, unknown>> = {};
    for (const c of categories) {
      cats[c.id] = {
        answer: c.answer ?? null,
        facts: c.facts ?? null,
        includes: c.includes ?? null,
        includesNote: c.includesNote ?? null,
        faq: c.faq ?? null,
        seoDescription: c.seoDescription ?? null,
        heroTitle: c.heroTitle ?? null,
      };
    }
    content.setCategories(cats);
    return content;
  }
}

/* ─── Аварийное переключение ────────────────────────────────────────── */

/**
 * CMS с запасным вариантом.
 *
 * Если Strapi недоступна (нет сети, CMS перезапускается, миграция),
 * сайт продолжает работать на локальном снимке content/seed.json
 * и content/cms-content.json. Это не «источник правды» — он нужен,
 * чтобы страница не отдавала 500 из-за недоступности CMS.
 */
class ResilientCMS implements CMSProvider {
  name = 'strapi+fallback';

  constructor(
    private primary: CMSProvider,
    private backup: CMSProvider
  ) {}

  private async pick<T>(name: string, fn: (c: CMSProvider) => Promise<T>): Promise<T> {
    try {
      return await fn(this.primary);
    } catch (e) {
      console.error(
        `[cms] ${name}: Strapi недоступна (${(e as Error).message}) — работает запасной снимок`
      );
      return fn(this.backup);
    }
  }

  getSettings() {
    return this.pick('getSettings', (c) => c.getSettings());
  }
  getCategories() {
    return this.pick('getCategories', (c) => c.getCategories());
  }
  getEquipment() {
    return this.pick('getEquipment', (c) => c.getEquipment());
  }
  getEquipmentByCategory(category: CategoryId) {
    return this.pick('getEquipmentByCategory', (c) => c.getEquipmentByCategory(category));
  }
  getEquipmentBySlug(slug: string) {
    return this.pick('getEquipmentBySlug', (c) => c.getEquipmentBySlug(slug));
  }
  getArticles() {
    return this.pick('getArticles', (c) => c.getArticles());
  }
  getReviews() {
    return this.pick('getReviews', (c) => c.getReviews());
  }
  getArticle(slug: string) {
    return this.pick('getArticle', (c) => c.getArticle(slug));
  }
  getCases() {
    return this.pick('getCases', (c) => c.getCases());
  }
  getCase(slug: string) {
    return this.pick('getCase', (c) => c.getCase(slug));
  }
  getPages() {
    return this.pick('getPages', (c) => c.getPages());
  }
  getPage(slug: string) {
    return this.pick('getPage', (c) => c.getPage(slug));
  }
  getPriceTables() {
    return this.pick('getPriceTables', (c) => c.getPriceTables());
  }
  getRedirects() {
    return this.pick('getRedirects', (c) => c.getRedirects());
  }
  getContentBlocks() {
    return this.pick('getContentBlocks', (c) => c.getContentBlocks());
  }
  getMenuItems() {
    return this.pick('getMenuItems', (c) => c.getMenuItems());
  }
  async getContent(): Promise<Content> {
    return this.pick('getContent', (c) => c.getContent());
  }
}

/* ─── Фабрика ────────────────────────────────────────────────────────── */

/**
 * Оборачивает методы провайдера в React cache().
 *
 * Один рендер страницы вызывает getCMS() из layout, generateMetadata
 * и самого компонента — без мемоизации каждая точка ходила бы в CMS
 * отдельно (2–4 лишних HTTP-запроса к Strapi на каждый рендер).
 * cache() мемоизирует вызовы в рамках одного запроса; между запросами
 * кэш не переживает — свежесть данных регулируют revalidate страницы
 * и fetch'ей (60 с, значения согласованы).
 */
function withRequestCache(provider: CMSProvider): CMSProvider {
  return {
    name: provider.name,
    getSettings: cache(() => provider.getSettings()),
    getCategories: cache(() => provider.getCategories()),
    getEquipment: cache(() => provider.getEquipment()),
    getEquipmentByCategory: cache((category: CategoryId) =>
      provider.getEquipmentByCategory(category)
    ),
    getEquipmentBySlug: cache((slug: string) => provider.getEquipmentBySlug(slug)),
    getArticles: cache(() => provider.getArticles()),
    getReviews: cache(() => provider.getReviews()),
    getArticle: cache((slug: string) => provider.getArticle(slug)),
    getCases: cache(() => provider.getCases()),
    getCase: cache((slug: string) => provider.getCase(slug)),
    getPages: cache(() => provider.getPages()),
    getPage: cache((slug: string) => provider.getPage(slug)),
    getPriceTables: cache(() => provider.getPriceTables()),
    getRedirects: cache(() => provider.getRedirects()),
    getContentBlocks: cache(() => provider.getContentBlocks()),
    getMenuItems: cache(() => provider.getMenuItems()),
    getContent: cache(() => provider.getContent()),
  };
}

let instance: CMSProvider | null = null;

export function getCMS(): CMSProvider {
  if (instance) return instance;

  const provider = process.env.CMS_PROVIDER ?? 'mock';

  if (provider === 'strapi') {
    instance = withRequestCache(
      new ResilientCMS(
        new StrapiCMS(
          process.env.STRAPI_URL ?? 'http://127.0.0.1:1337',
          process.env.STRAPI_TOKEN ?? ''
        ),
        new MockCMS()
      )
    );
  } else {
    instance = withRequestCache(new MockCMS());
  }

  return instance;
}

/**
 * Редактируемый контент (текстовые блоки и меню).
 *
 * React.cache убирает повторные запросы к CMS в рамках одного рендера:
 * и страница, и layout получают один и тот же объект.
 */
export const getContent = cache(async () => getCMS().getContent());

/* ─── Производные выборки ───────────────────────────────────────────── */

/** Скидка и итоговая цена — считаются в одном месте */
export function calcPrice(
  pricePerDay: number,
  days: number,
  settings: SiteSettings
) {
  const discount = days >= settings.discountFromDays ? settings.discountPercent / 100 : 0;
  const perDay = Math.round(pricePerDay * (1 - discount));
  return { perDay, total: perDay * days, discount };
}
