/**
 * Контент страниц-каталогов.
 *
 * Источник текстов — CMS: у категории есть поля «краткий ответ»,
 * «блок фактов», «что входит в стоимость» и «вопросы и ответы».
 * В них живые шаблоны ({price}, {count}), числа подставляются из каталога.
 *
 * Этот модуль — запасной вариант на случай, если CMS недоступна или
 * поля не заполнены: тексты собираются из данных каталога. При штатной
 * работе сайта запасные значения не используются — это проверяет
 * scripts/_check-cms-coverage.mjs.
 */
import { render, type Tokens } from '@/lib/content';
import { catalogTokens, formatNumber, pluralize, powerRange, priceUnit, unitFor } from '@/lib/tokens';
import type { Category, Equipment, SiteSettings } from './types';

export interface CategoryFact {
  label: string;
  value: string;
}

export interface CategoryContent {
  description: string;
  answer: string;
  facts: CategoryFact[];
  faq: { q: string; a: string }[];
  includes: string[];
  includesNote: string;
}

/** Название категории во множественном числе — для текстов */
const PLURAL: Record<string, string> = {
  generator: 'дизельных генераторов',
  pes: 'передвижных электростанций',
  compressor: 'компрессоров',
  'compressor-shift': 'компрессоров на смену',
  manipulator: 'кранов-манипуляторов',
  used: 'техники',
};

/** Что арендуем/продаём — для ответов */
const SUBJECT: Record<string, string> = {
  generator: 'Аренда дизельных генераторов',
  pes: 'Аренда передвижных электростанций (ПЭС)',
  compressor: 'Аренда компрессоров',
  'compressor-shift': 'Аренда компрессоров на смену',
  manipulator: 'Аренда кранов-манипуляторов',
  used: 'Продажа техники б/у',
};

/** Тема строки в сниппете — без повторов внутри самой строки */
const DESCR_SUBJECT: Record<string, string> = {
  generator: 'Аренда дизельных генераторов',
  pes: 'Аренда передвижных электростанций',
  compressor: 'Аренда компрессоров',
  'compressor-shift': 'Аренда компрессоров по сменам',
  manipulator: 'Аренда кранов-манипуляторов',
  used: 'Продажа дизельных генераторов б/у',
};

/** Существительное после «N видов» — тоже без повторов */
const DESCR_NOUN: Record<string, string> = {
  generator: 'генераторов',
  pes: 'ПЭС',
  compressor: 'компрессоров',
  'compressor-shift': 'компрессоров',
  manipulator: 'манипуляторов',
  used: 'техники',
};

/** Единица измерения по категории */
function unitForCategory(category: string): string {
  return unitFor(category);
}

/**
 * Содержимое страницы категории.
 *
 * @param cms    запись категории из CMS (может быть null)
 * @param tokens подстановки из каталога
 */
export function categoryContent(
  kind: string,
  slug: string,
  category: string | undefined,
  items: Equipment[],
  cms: Category | null = null,
  settings?: SiteSettings,
  tokens?: Tokens
): CategoryContent | null {
  if (kind !== 'catalog' || !category) return null;

  const t: Tokens =
    tokens ?? (settings ? catalogTokens(items, category, settings) : ({} as Tokens));

  /* ── Данные каталога ── */
  const subject = SUBJECT[category] ?? 'Аренда техники';
  const plural = PLURAL[category] ?? 'техники';
  const unit = unitForCategory(category);
  const models = items.length;
  const word = pluralize(
    models,
    category === 'used'
      ? ['единица', 'единицы', 'единиц']
      : ['вид', 'вида', 'видов']
  );
  const range = powerRange(items, category);
  const pu = priceUnit(items);
  const minPrice = String(t.minPrice || '');
  const delivery = String(t.delivery || 'от 2 часов');
  const brands = String(t.brands || '').split(', ').filter(Boolean);
  const brandList = brands.length ? brands : [];

  /* ── Запасные тексты (если CMS недоступна) ── */
  const fallback = fallbackContent(category, {
    models,
    word,
    plural,
    range,
    unit,
    minPrice,
    pu,
    delivery,
    brandList,
  });

  /* ── Из CMS — приоритет ── */
  const answer = cms?.answer ? render(cms.answer, t) : fallback.answer;
  const facts: CategoryFact[] = cms?.facts?.length
    ? cms.facts.map((f) => ({ label: f.label, value: render(f.value, t) }))
    : fallback.facts;
  const faq = cms?.faq?.length
    ? cms.faq.map((f) => ({ q: f.q, a: render(f.a, t) }))
    : fallback.faq;
  const includes = cms?.includes?.length
    ? cms.includes.map((i) => render(typeof i === 'string' ? i : i.text, t))
    : fallback.includes;
  const includesNote = cms?.includesNote || fallback.includesNote;

  const description = cms?.seoDescription
    ? render(cms.seoDescription, t)
    : fallback.description;

  return { description, answer, facts, faq, includes, includesNote };
}

/** Запасной вариант: тексты собираются из данных каталога */
function fallbackContent(
  category: string,
  d: {
    models: number;
    word: string;
    plural: string;
    range: string;
    unit: string;
    minPrice: string;
    pu: { short: string; long: string };
    delivery: string;
    brandList: string[];
  }
) {
  const { models, word, plural, range, unit, minPrice, pu, delivery, brandList } = d;
  const priceSentence = minPrice ? `от ${minPrice} ₽ ${pu.long}` : 'по запросу';

  /* ── Продажа б/у: логика другая ── */
  if (category === 'used') {
    const facts: CategoryFact[] = [
      { label: 'Позиций в продаже', value: String(models) },
    ];
    if (range) facts.push({ label: 'Диапазон мощности', value: range });
    if (minPrice) facts.push({ label: 'Цена за единицу', value: `от ${minPrice} ₽` });
    facts.push({ label: 'Осмотр и выдача', value: 'база в Химках' });
    facts.push({ label: 'Документы и гарантия', value: 'предоставляются' });

    const answer =
      `${models} ${word} техники — ${range || 'мощность по запросу'}. ` +
      (minPrice ? `Цена от ${minPrice} ₽ за единицу. ` : '') +
      'Дизельные генераторы с отработанным ресурсом: состояние каждой единицы ' +
      'проверяет инженер перед выставлением на продажу. Осмотр — на базе в ' +
      'Химках, документы и гарантия в комплекте, доставка по России обсуждается ' +
      'отдельно.';

    const faq: { q: string; a: string }[] = [
      {
        q: 'Какая техника есть в продаже?',
        a: `В продаже ${models} ${word} техники${range ? ` мощностью ${range}` : ''}. ` +
          'Это дизельные генераторы с отработанным ресурсом: состояние каждой единицы ' +
          'проверяется инженером перед выставлением на продажу.',
      },
      {
        q: 'Можно ли посмотреть технику перед покупкой?',
        a: 'Да, осмотр организуем на базе в Химках в рабочее время. Позвоните или оставьте заявку — согласуем время.',
      },
      {
        q: 'Какие документы идёт с техникой?',
        a: 'Договор купли-продажи, акт приёма-передачи, паспорт и сервисная история станции. Гарантия на остаточный ресурс согласуется индивидуально.',
      },
      {
        q: 'Делаете ли вывоз техники?',
        a: 'Да, вывозим своим транспортом по Москве и области, в другие регионы — подбираем перевозчика. Стоимость обсуждается до сделки.',
      },
      {
        q: 'Можно ли арендовать технику вместо покупки?',
        a: 'Да. Если проект разовый или техника нужна на срок меньше года — дешевле взять в аренду, а при длительных проектах покупка обычно окупается. Разберём вашу задачу по телефону.',
      },
    ];

    const description =
      `Продажа дизельных генераторов б/у: ${models} ${word} техники` +
      (range ? `, ${range}` : '') +
      (minPrice ? `, от ${minPrice} ₽ за единицу` : '') +
      '. Осмотр на базе в Химках, документы и гарантия, вывоз по Москве и МО.';

    return {
      description,
      answer,
      facts,
      faq,
      includes: [
        'Договор купли-продажи и акт приёма-передачи',
        'Паспорт и сервисная история станции',
        'Гарантия на остаточный ресурс — по договорённости',
        'Осмотр техники на базе в Химках',
      ],
      includesNote: '* В зависимости от состояния конкретной единицы.',
    };
  }

  /* ── Аренда ── */
  const facts: CategoryFact[] = [{ label: 'Видов техники', value: String(models) }];
  if (range) facts.push({ label: 'Диапазон мощности', value: range });
  if (minPrice) {
    facts.push({ label: 'Цена аренды', value: `от ${minPrice} ₽${pu.short}` });
  }
  facts.push({ label: 'Доставка по Москве и МО', value: delivery });
  facts.push({
    label: 'ТО, замена, выездная поддержка',
    value: 'включены в аренду *',
  });

  const answer =
    `${models} ${word} ${plural} — ${range || 'мощность по запросу'}. ` +
    `Аренда ${priceSentence}. Доставка на объект — ${delivery} по Москве и ` +
    'Московской области, ТО, подмена неисправной единицы и выездная поддержка ' +
    `24/7 включены в стоимость*.${brandList.length ? ` Работаем с ${brandList.join(', ')}.` : ''}`;

  const faq: { q: string; a: string }[] = [
    {
      q: `Сколько стоит ${plural} в аренду?`,
      a: minPrice
        ? `Аренда ${plural} начинается от ${minPrice} ₽ ${pu.long}. ` +
          `Точная цена зависит от модели, мощности, тарифа (сухая аренда или с оператором и топливом) и срока: при оплате от 30 дней даём скидку 10%, доставка и вывоз по Москве в пределах МКАД бесплатны.`
        : 'Цену рассчитываем по модели, мощности и сроку аренды — инженер вышлёт расчёт в течение 10 минут после заявки.',
    },
    {
      q: 'Как быстро доставят технику?',
      a: 'По Москве и Московской области — от 2 часов, если машина свободна на базе. В сезон (апрель–июнь и сентябрь–октябрь) бронируйте заранее, минимум за сутки.',
    },
    {
      q: 'Что входит в стоимость аренды?',
      a: 'Сама станция, регламентное ТО, ёмкость для топлива, подключение к силовому кабелю, обучение персонала, резервная машина на базе и замена при нештатной ситуации. Оператор, топливо, бытовка и кабель с ГРЩ — по тарифу.',
    },
    {
      q: 'Подойдёт ли техника под мою нагрузку?',
      a: 'Да. Считаем по пусковым токам оборудования и коэффициенту одновременности. Пришлите перечень потребителей и режим работы — инженер рассчитает бесплатно и сразу предложит модель с запасом по мощности.',
    },
    {
      q: 'Есть ли скидки при длительной аренде?',
      a: 'Да: −10% при оплате от 30 дней, бесплатные доставка и вывоз при аренде от 3 месяцев. Для проектов от 6 месяцев условия обсуждаются индивидуально.',
    },
  ];

  const description =
    `${DESCR_SUBJECT[category] ?? SUBJECT[category] ?? 'Аренда техники'}: ${models} ${word} ${DESCR_NOUN[category] ?? plural}` +
    (range ? `, ${range}` : '') +
    (minPrice ? `, от ${minPrice} ₽${pu.short}` : '') +
    '. Доставка от 2 часов, ТО и подмена включены. Москва и МО.';

  return {
    description,
    answer,
    facts,
    faq,
    includes: [
      'Сама станция и регламентное ТО',
      'Ёмкость для топлива',
      'Подключение к силовому кабелю заказчика',
      'Обучение персонала',
      'Резервная машина на базе и подмена при нештатной ситуации',
      'Выездная поддержка 24/7',
    ],
    includesNote: '* В зависимости от тарифа.',
  };
}

export { formatNumber };
