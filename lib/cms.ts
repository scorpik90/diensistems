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
import seed from '@/content/seed.json';
import { equipmentImageDir } from '@/lib/media';
import type {
  Article,
  CaseStudy,
  Category,
  CategoryId,
  Equipment,
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
function decorate(raw: Equipment & { priceValue?: number; priceUnit?: string }, categories: Category[]): Equipment {
  const price =
    raw.price ??
    (raw.priceValue != null ? { value: raw.priceValue, unit: raw.priceUnit || '/сутки' } : null);

  const cat = categories.find((c) => c.id === raw.category);

  return {
    ...raw,
    price,
    categorySlug: cat?.slug,
    /* Папка с оптимизированной картинкой позиции.
       Логика одна на все страницы — в lib/media.ts. */
    imageDir: equipmentImageDir(raw as Equipment),
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
  async getReviews() {
    return (this.data().reviews ?? []).sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
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
      next: { revalidate: 300, tags: ['cms'] },
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

  async getSettings() {
    const s = await this.one<SiteSettings>('/site-settings?pagination[pageSize]=1');
    if (!s) throw new Error('Strapi: нет записи site-settings');
    return s;
  }

  async getCategories() {
    const list = await this.fetchList<Category>('/categories?sort=key:asc');
    /* В Strapi категория хранится с полем «key», а в модели id.
       Приводим к общему виду — иначе не работает связь
       «позиция → её категория» (и, как следствие, хлебные крошки). */
    return list.map((c) => ({ ...c, id: (c.key ?? c.id) as CategoryId }));
  }

  private async equipment(): Promise<Equipment[]> {
    const categories = await this.getCategories();
    const list = await this.fetchList<Equipment>('/equipment?pagination[pageSize]=200');
    return list.map((e) => decorate(e, categories));
  }

  async getEquipment() {
    return this.equipment();
  }

  async getEquipmentByCategory(category: CategoryId) {
    return (await this.equipment()).filter((e) => e.category === category);
  }

  async getEquipmentBySlug(slug: string) {
    const categories = await this.getCategories();
    const found = await this.one<Equipment>(
      `/equipment?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
    );
    return found ? decorate(found, categories) : null;
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
    return this.fetchList<CaseStudy>('/cases?sort=title:asc');
  }

  async getCase(slug: string) {
    return this.one<CaseStudy>(
      `/cases?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`
    );
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
}

/* ─── Фабрика ────────────────────────────────────────────────────────── */

let instance: CMSProvider | null = null;

export function getCMS(): CMSProvider {
  if (instance) return instance;

  const provider = process.env.CMS_PROVIDER ?? 'mock';

  if (provider === 'strapi') {
    instance = new StrapiCMS(
      process.env.STRAPI_URL ?? 'http://localhost:1337',
      process.env.STRAPI_TOKEN ?? ''
    );
  } else {
    instance = new MockCMS();
  }

  return instance;
}

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
