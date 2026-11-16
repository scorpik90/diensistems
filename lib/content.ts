/**
 * Доступ к редактируемому контенту.
 *
 * Источник текстов — CMS (коллекция «Текстовый блок»). Если блок в CMS
 * отсутствует или поле пустое, берётся значение из content/cms-content.json:
 * это аварийный запасной вариант, чтобы сайт не развалился, если CMS
 * недоступна. При нормальной работе CMS запасные значения не используются —
 * это проверяет scripts/_check-cms-coverage.mjs.
 *
 * В текстах поддерживаются подстановки вида {price}, {count}:
 * числа берутся из каталога и настроек, поэтому текст остаётся живым.
 */
import fallbackJson from '@/content/cms-content.json';
import type { ContentBlock, MenuItem } from './types';

/** Значения для подстановки в тексты */
export type Tokens = Record<string, string | number>;

/** Структура аварийного снимка контента */
export interface FallbackContent {
  blocks: { key: string; group: string; title?: string; items?: Record<string, unknown> }[];
  menu: MenuItem[];
  categories: Record<string, unknown>;
}

/**
 * Аварийный снимок контента.
 *
 * Подключается статическим импортом, чтобы попасть в сборку: файл
 * content/cms-content.json должен быть доступен и на сервере, где
 * рабочая папка может отличаться от исходной.
 */
let fallbackCache: FallbackContent | null = null;

export function fallbackContent(): FallbackContent {
  if (fallbackCache) return fallbackCache;
  const raw = fallbackJson as unknown as FallbackContent;
  fallbackCache = {
    blocks: raw.blocks ?? [],
    menu: raw.menu ?? [],
    categories: raw.categories ?? {},
  };
  return fallbackCache;
}

/**
 * Подстановки, которые заполняются в браузере.
 *
 * Их значения зависят от действий посетителя (выбранный сценарий
 * калькулятора, модель в форме), поэтому сервер их не знает.
 * Такие метки сервер не трогает — компонент подставит их сам.
 */
const CLIENT_TOKENS = new Set([
  'headroom', 'model', 'kW', 'kw', 'days', 'price', 'brand', 'brandCount', 'itemWord',
]);

/**
 * Подстановка значений в текст.
 *
 * Неизвестный placeholder заменяется пустой строкой, чтобы в выдачу
 * не попало «{price}». Исключение — метки, которые заполняются
 * на клиенте: они сохраняются как есть.
 */
export function render(text: string, tokens: Tokens = {}): string {
  if (!text) return '';
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = tokens[key];
    if (v !== undefined && v !== null && v !== '') return String(v);
    if (CLIENT_TOKENS.has(key)) return whole;
    return '';
  });
}

/** Значение блока целиком: items-объект или пустой */
export type BlockItems = Record<string, any>;

export class Content {
  private blocks: Map<string, ContentBlock>;
  private fbBlocks: Map<string, FallbackContent['blocks'][number]>;
  private menuItems: MenuItem[];
  private fbMenu: MenuItem[];

  constructor(blocks: ContentBlock[] = [], menu: MenuItem[] = []) {
    const fb = fallbackContent();
    this.blocks = new Map(blocks.map((b) => [b.key, b]));
    this.fbBlocks = new Map(fb.blocks.map((b) => [b.key, b]));
    this.menuItems = menu;
    this.fbMenu = fb.menu;
  }

  /** Есть ли блок в CMS */
  has(key: string): boolean {
    return this.blocks.has(key);
  }

  /** Сырые items блока: сначала CMS, при отсутствии — запасной снимок */
  private rawItems(key: string): BlockItems {
    const b = this.blocks.get(key);
    if (b?.items && typeof b.items === 'object') return b.items as BlockItems;
    const fb = this.fbBlocks.get(key);
    return fb?.items ?? {};
  }

  /** Сырое значение поля блока (без подстановок) */
  raw(key: string, path?: string): unknown {
    const items = this.rawItems(key);
    if (!path) return items;
    return path.split('.').reduce<unknown>(
      (acc, p) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[p] : undefined),
      items
    );
  }

  /**
   * Строка из блока с подстановками.
   * Пустое значение — если в CMS и в запасном снимке его нет.
   */
  s(key: string, path: string | undefined, tokens: Tokens = {}): string {
    const v = this.raw(key, path);
    if (typeof v !== 'string') return '';
    return render(v, tokens);
  }

  /** Число из блока */
  n(key: string, path: string | undefined, fallback = 0): number {
    const v = this.raw(key, path);
    const num = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(num) ? num : fallback;
  }

  /** Массив из блока; строки внутри получают подстановки */
  a<T = unknown>(key: string, path: string | undefined, tokens: Tokens = {}): T[] {
    const v = this.raw(key, path);
    if (!Array.isArray(v)) return [];
    return v.map((item) => {
      if (typeof item === 'string') return render(item, tokens) as unknown as T;
      if (item && typeof item === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(item as Record<string, unknown>)) {
          out[k] = typeof val === 'string' ? render(val, tokens) : val;
        }
        return out as unknown as T;
      }
      return item as T;
    });
  }

  /**
   * Объект из блока; строковые значения получают подстановки.
   *
   * Подстановки применяются на любой глубине: и к полям объекта,
   * и к строкам внутри вложенных массивов и объектов.
   */
  o(key: string, tokens: Tokens = {}): BlockItems {
    const v = this.raw(key);
    if (!v || typeof v !== 'object') return {};
    return this.renderDeep(v as BlockItems, tokens) as BlockItems;
  }

  /** Рекурсивная подстановка в структуру любой вложенности */
  private renderDeep(value: unknown, tokens: Tokens): unknown {
    if (typeof value === 'string') return render(value, tokens);
    if (Array.isArray(value)) return value.map((v) => this.renderDeep(v, tokens));
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(value as Record<string, unknown>)) {
        out[k] = this.renderDeep(val, tokens);
      }
      return out;
    }
    return value;
  }

  /** Пункты меню группы: сначала CMS, при отсутствии — запасной снимок */
  menu(group: MenuItem['group']): MenuItem[] {
    const src = this.menuItems.length ? this.menuItems : this.fbMenu;
    return src
      .filter((m) => m.group === group && m.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /**
   * Категория: поля из CMS, при отсутствии — из запасного снимка.
   * Возвращает null, если категории нет ни там, ни там.
   */
  category(key: string): Record<string, unknown> | null {
    const fromCms = this.categoriesFromCms.get(key);
    if (fromCms) return fromCms;
    return (fallbackContent().categories[key] as Record<string, unknown>) ?? null;
  }

  private categoriesFromCms = new Map<string, Record<string, unknown>>();

  /** Загрузить категории из CMS (вызывается адаптером CMS) */
  setCategories(cats: Record<string, Record<string, unknown>>): void {
    this.categoriesFromCms = new Map(Object.entries(cats));
  }
}
