/**
 * Генерация llms.txt — карта сайта для генеративных поисковиков.
 *
 *   node scripts/make-llms-txt.mjs
 *
 * llms.txt — неофициальный, но быстро набирающий popularity стандарт
 * (llmstxt.org): текстовый файл с описанием сайта для ИИ-агентов.
 * Его читают YandexGPT, Алиса, ChatGPT, Perplexity, Claude и другие
 * краулеры, чтобы понять структуру ресурса и взять точные факты.
 *
 * Файл кладётся в public/llms.txt — отдаётся как обычный статический файл.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'seed.json'), 'utf8'));

const settings = seed.settings;
const byCat = new Map();
for (const e of seed.equipment) {
  const list = byCat.get(e.category) ?? [];
  list.push(e);
  byCat.set(e.category, list);
}

const prices = seed.equipment
  .map((e) => e.price?.value)
  .filter((v) => typeof v === 'number' && v > 0);
const minPrice = Math.min(...prices);

const lines = [];

lines.push(`# ${settings.legalName}`);
lines.push('');
lines.push(
  `> ${settings.company} — аренда дизельных генераторов, передвижных электростанций, ` +
    `компрессоров и кранов-манипуляторов в Москве и Московской области. ` +
    `Собственный парк ${settings.fleetMW} МВт, аренда от ${minPrice.toLocaleString('ru-RU')} ₽/сутки, ` +
    `доставка на объект от ${settings.deliveryHours} часов.`
);
lines.push('');
lines.push(
  `Контакты: ${settings.phone}, ${settings.email}, ${settings.address}. ` +
    `Приём заявок — ${settings.workingHours}.`
);
lines.push('');
lines.push('Основные разделы:');
lines.push('');

const sections = [
  {
    slug: 'arendageneratorov',
    title: 'Дизельные генераторы',
    note: 'Каталог моделей, цены и технические характеристики',
  },
  {
    slug: 'mobilnyegeneratory',
    title: 'Передвижные электростанции (ПЭС)',
    note: 'Мобильные станции для временных и удалённых объектов',
  },
  {
    slug: 'arendakompressorov',
    title: 'Компрессоры',
    note: 'Винтовые компрессоры для стройки и производства',
  },
  {
    slug: 'kompressornasmeny',
    title: 'Компрессоры на смену',
    note: 'Посменная аренда 8 часов: продувка, опрессовка, пескоструй',
  },
  {
    slug: 'arendamanipulatora',
    title: 'Краны-манипуляторы',
    note: 'Манипуляторы 3–9 тонн с оператором',
  },
  {
    slug: 'tsenyinaarendu',
    title: 'Прайс-лист',
    note: 'Полные цены по всем категориям техники',
  },
  {
    slug: 'prodazhabu',
    title: 'Продажа техники б/у',
    note: 'Дизельные генераторы с гарантией и документами',
  },
  {
    slug: 'nashiobekty',
    title: 'Наши объекты',
    note: 'Реальные площадки, где работали наши станции',
  },
  {
    slug: 'dostavka',
    title: 'Доставка',
    note: 'Свои манипуляторы, цена от 7 000 ₽',
  },
  {
    slug: 'prodazhatopliva',
    title: 'Дизельное топливо',
    note: 'Поставка топлива с доставкой на объект',
  },
  {
    slug: 'dopoborudovanie',
    title: 'Дополнительное оборудование',
    note: 'Шумозащитное ограждение для дизельных генераторов',
  },
  {
    slug: 'poleznoe',
    title: 'Полезные статьи',
    note: 'Как выбрать мощность, обслуживание, резервное питание',
  },
  {
    slug: 'contacts',
    title: 'Контакты',
    note: 'Телефон, почта, адрес базы, режим работы',
  },
  {
    slug: 'politika-obrabotki-personalnyh-dannyh',
    title: 'Политика обработки персональных данных',
    note: 'Реквизиты оператора и порядок работы с данными',
  },
];

for (const s of sections) {
  lines.push(`- [${s.title}](https://${settings.city === 'Москва' ? 'genorg.ru' : 'genorg.ru'}/${s.slug}): ${s.note}`);
}

lines.push('');
lines.push('Каталог моделей:');
lines.push('');

for (const [cat, items] of byCat) {
  const label =
    seed.categories.find((c) => c.id === cat)?.label ?? cat;
  lines.push(`## ${label} (${items.length})`);
  for (const e of items) {
    const price = e.price?.value
      ? ` — от ${e.price.value.toLocaleString('ru-RU')} ₽${e.price.unit || '/сутки'}`
      : '';
    const kw = e.power != null ? `, ${e.power} ${e.powerUnit}` : '';
    lines.push(`- [${e.title}](https://genorg.ru/${e.slug}): ${e.model}${kw}${price}`);
  }
  lines.push('');
}

lines.push('## Optional');
lines.push('');
lines.push(
  '- [Полный прайс с ТТХ всех позиций](https://genorg.ru/tsenyinaarendu): ' +
    'таблицы с ценами по всем категориям'
);
lines.push(
  '- [Отзывы на Яндекс.Картах](https://yandex.ru/maps/org/dien_sistems/1088163471/reviews/): ' +
    'реальные отзывы клиентов'
);
lines.push('');
lines.push('## Notes');
lines.push('');
lines.push(
  `- Цены указаны за сутки аренды, если не указано иное. ` +
    `Скидка 10% при оплате от ${settings.discountFromDays} дней.`
);
lines.push(
  '- В стоимость входят ТО, подмена неисправной единицы и выездная поддержка 24/7.'
);
lines.push(
  '- Данные актуальны на ' +
    new Date().toISOString().slice(0, 10) +
    '. При расхождении с прайс-листом на сайте приоритет у прайс-листа.'
);
lines.push('');

fs.writeFileSync(path.join(ROOT, 'public', 'llms.txt'), lines.join('\n'), 'utf8');
console.log(`  ✓ public/llms.txt (${lines.length} строк, ${(lines.join('\n').length / 1024).toFixed(1)} КБ)`);
