import type { Article, CaseStudy, Equipment } from './types';
import { clip, stripHtml } from './seo-meta';

/**
 * Сниппеты для карточек товаров, объектов и статей.
 *
 * В legacy заголовки длинные («Аренда генератора 400 квт в Московская
 * обл, Лениниский район, д. Бутово…»), а описания короткие или обрываются.
 * Поисковик обрезает заголовок примерно на 60 символах, поэтому
 * длинный текст в выдаче выглядит обрубленным.
 *
 * Здесь заголовок собирается заново — по модели, мощности и цене,
 * а description получает конкретные характеристики. Одновременно это
 * то, что цитируют ИИ-поисковики: конкретные числа и параметры.
 */

/** ТТХ, которые полезно показать в сниппете */
const SNIPPET_SPECS: { re: RegExp; label: string }[] = [
  { re: /напряжен/i, label: 'напряжение' },
  { re: /частот/i, label: 'частота' },
  { re: /производительн/i, label: 'производительность' },
  { re: /давлени/i, label: 'рабочее давление' },
  { re: /грузоподъемност|грузоподъёмност/i, label: 'грузоподъёмность' },
];

/** Собирает краткие характеристики позиции для описания */
function briefSpecs(e: Equipment): string {
  const out: string[] = [];
  for (const s of SNIPPET_SPECS) {
    for (const g of e.specGroups ?? []) {
      for (const r of g.rows ?? []) {
        if (!s.re.test(r.label)) continue;
        const v = r.value.trim();
        if (!v || out.some((o) => o.includes(v))) continue;
        out.push(`${s.label} ${v}`);
        break;
      }
    }
    if (out.length >= 2) break;
  }
  return out.join(', ');
}

/** Заголовок карточки товара */
export function productTitle(e: Equipment): string {
  const model = e.model.replace(/^(Дизель-генератор|Дизельный генератор)\s*/i, '').trim();
  const power = e.power != null ? ` ${e.power} ${e.powerUnit}` : '';
  const price = e.price?.value ? ` от ${e.price.value.toLocaleString('ru-RU')} ₽` : '';

  const base = `${e.category === 'used' ? 'Продажа' : 'Аренда'} ${model}${power}`;
  return clip(`${base}${price}`, 55);
}

/** Описание карточки товара */
export function productDescription(e: Equipment): string {
  const model = e.model.replace(/^(Дизель-генератор|Дизельный генератор)\s*/i, '').trim();
  const power = e.power != null ? ` мощностью ${e.power} ${e.powerUnit}` : '';
  const price = e.price?.value
    ? ` от ${e.price.value.toLocaleString('ru-RU')} ₽${e.price.unit || '/сутки'}`
    : '';

  const specs = briefSpecs(e);
  const delivery = e.category === 'used' ? 'Документы и осмотр на базе в Химках.' : 'Доставка от 2 часов, ТО и подмена включены.';

  const text =
    `${model}${power}. ${e.category === 'used' ? 'Продажа' : 'Аренда'}${price}. ` +
    (specs ? `${specs}. ` : '') +
    delivery;

  return clip(text, 160);
}

/** Заголовок объекта */
export function caseTitle(c: CaseStudy): string {
  return clip(c.title, 55);
}

/** Описание объекта */
export function caseDescription(c: CaseStudy): string {
  const text = stripHtml(c.bodyHtml ?? '');
  const withObj = c.kW ? ` Объект с генератором ${c.kW} кВт.` : '';
  return clip(text + withObj, 160);
}

/** Заголовок статьи */
export function articleTitle(a: Article): string {
  return clip(a.title, 55);
}

/** Описание статьи */
export function articleDescription(a: Article): string {
  const excerpt = stripHtml(a.excerpt ?? '');
  if (excerpt.length >= 90) return clip(excerpt, 160);
  const text = stripHtml(a.bodyHtml ?? '');
  return clip(text, 160);
}
