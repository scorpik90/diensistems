import type { Equipment, PageKind } from './types';

/**
 * Контент для страниц категорий: сниппет, «краткий ответ», вопросы.
 *
 * Зачем это нужно:
 *
 * SEO. Поисковик берёт сниппет из title и description, а структуру
 * страницы — из заголовков. Без h2 внутри страницы её нечем
 * различать в выдаче, а без нормального description сниппет
 * обрезается по границе слова.
 *
 * GEO (генеративная выдача: YandexGPT, ChatGPT, Perplexity, Алиса)
 * такие страницы цитируют чаще всего, если на них есть:
 *   • прямой ответ на вопрос в первых строках — «краткий ответ»;
 *   • конкретные числа (цены, диапазоны, сроки) — их любят выносить
 *     в AI-сводку;
 *   • разметка FAQPage — из неё собираются быстрые ответы;
 *   • таблицы характеристик — самый цитируемый формат (у нас
 *     они уже есть в карточках товаров).
 *
 * Все числа берутся из каталога, а не пишутся руками: при изменении
 * цен и парка текст обновится сам.
 */

export interface CategoryFact {
  /** Значение для блока с фактами */
  label: string;
  value: string;
}

export interface CategoryContent {
  /** description для сниппета */
  description: string;
  /** Короткий ответ — абзац перед каталогом */
  answer: string;
  /** Факты списком — их любят ИИ-поисковики */
  facts: CategoryFact[];
  /** Вопросы и ответы для блока FAQ и разметки FAQPage */
  faq: { q: string; a: string }[];
}

/** Человекочитаемое число: 12345 → «12 345» */
const num = (n: number) => n.toLocaleString('ru-RU');

/** Диапазон: [8, 800] → «от 8 до 800 кВт» */
function range(values: number[], unit: string): string {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return `${num(min)} ${unit}`;
  return `от ${num(min)} до ${num(max)} ${unit}`;
}

/** Единица измерения по категории */
function unitFor(category: string): string {
  switch (category) {
    case 'compressor':
    case 'compressor-shift':
      return 'м³/мин';
    case 'manipulator':
      return 'т';
    default:
      return 'кВт';
  }
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

export function categoryContent(
  kind: PageKind,
  slug: string,
  category: string | undefined,
  items: Equipment[]
): CategoryContent | null {
  if (kind !== 'catalog' || !category) return null;

  const subject = SUBJECT[category] ?? 'Аренда техники';
  const plural = PLURAL[category] ?? 'техники';
  const unit = unitFor(category);

  const powers = items.map((i) => i.power).filter((v): v is number => v != null);
  const prices = items
    .map((i) => i.price?.value)
    .filter((v): v is number => typeof v === 'number' && v > 0);
  const minPrice = prices.length ? Math.min(...prices) : null;

  const models = items.length;
  const brandList = [...new Set(items.map((i) => i.brand).filter(Boolean))] as string[];

  /* ── Продажа б/у: логика другая ── */
  if (category === 'used') {
    const facts: CategoryFact[] = [
      { label: 'Позиций в продаже', value: num(models) },
    ];
    if (powers.length) facts.push({ label: 'Диапазон мощности', value: range(powers, unit) });
    if (minPrice) {
      facts.push({ label: 'Цена за единицу', value: `от ${num(minPrice)} ₽` });
    }
    facts.push({ label: 'Осмотр и выдача', value: 'база в Химках' });
    facts.push({ label: 'Документы и гарантия', value: 'предоставляются' });

    const answer =
      `Продажа дизельных генераторов б/у от компании ДИЭН-Системс: ${models} ` +
      (models === 1 ? 'единица' : 'единицы') +
      (powers.length ? `, ${range(powers, unit)}` : '') +
      (minPrice ? `, цена от ${num(minPrice)} ₽ за единицу` : '') +
      '. Техника с документами и гарантией, осмотр — на базе в Химках. ' +
      'Доставка по России обсуждается отдельно, помогаем с подбором.';

    const faq: { q: string; a: string }[] = [
      {
        q: 'Какая техника есть в продаже?',
        a: `В продаже ${models} ${plural}${powers.length ? ` мощностью ${range(powers, unit)}` : ''}. ` +
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
      `Продажа дизельных генераторов б/у: ${models} ${plural}` +
      (powers.length ? `, ${range(powers, unit)}` : '') +
      (minPrice ? `, от ${num(minPrice)} ₽ за единицу` : '') +
      '. Осмотр на базе в Химках, документы и гарантия, вывоз по Москве и МО.';

    return { description, answer, facts, faq };
  }

  /* ── Факты ── */
  const facts: CategoryFact[] = [
    { label: 'Моделей в парке', value: num(models) },
  ];
  if (powers.length) {
    facts.push({ label: 'Диапазон мощности', value: range(powers, unit) });
  }
  if (minPrice) {
    facts.push({
      label: 'Цена аренды',
      value: `от ${num(minPrice)} ₽${category === 'manipulator' || category === 'compressor-shift' ? ' за смену' : '/сутки'}`,
    });
  }
  facts.push({ label: 'Доставка по Москве и МО', value: 'от 2 часов' });
  facts.push({ label: 'ТО, замена, выездная поддержка', value: 'включены в аренду' });

  /* ── Краткий ответ ── */
  const answer =
    `${subject} от компании ДИЭН-Системс: ${models} ${plural} в собственном парке` +
    (powers.length ? `, ${range(powers, unit)}` : '') +
    (minPrice
      ? `, аренда от ${num(minPrice)} ₽${category === 'manipulator' || category === 'compressor-shift' ? ' за смену 8 часов' : ' в сутки'}`
      : '') +
    '. Доставка на объект — от 2 часов по Москве и Московской области, ТО, ' +
    'подмена неисправной единицы и выездная поддержка 24/7 включены в стоимость. ' +
    (brandList.length ? `Работаем с ${brandList.join(', ')}.` : '');

  /* ── Вопросы и ответы ── */
  const faq: { q: string; a: string }[] = [
    {
      q: `Сколько стоит ${plural} в аренду?`,
      a: minPrice
        ? `Аренда ${plural} начинается от ${num(minPrice)} ₽${category === 'manipulator' || category === 'compressor-shift' ? ' за смену 8 часов' : ' в сутки'}. ` +
          `Точная цена зависит от модели, мощности, тарифа (сухая аренда или с оператором и топливом) и срока: при оплате от 30 дней даём скидку 10%, доставка и вывоз по Москве в пределах МКАД бесплатны.`
        : `Цену рассчитываем по модели, мощности и сроку аренды — инженер вышлёт расчёт в течение 10 минут после заявки.`,
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

  /* ── Description для сниппета ── */
  const description =
    `${subject} от собственника: ${models} ${plural}` +
    (powers.length ? `, ${range(powers, unit)}` : '') +
    (minPrice
      ? `, от ${num(minPrice)} ₽${category === 'manipulator' || category === 'compressor-shift' ? ' за смену' : '/сутки'}`
      : '') +
    '. Доставка от 2 часов, ТО и подмена включены. Москва и МО.';

  return { description, answer, facts, faq };
}
