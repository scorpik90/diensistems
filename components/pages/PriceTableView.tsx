import type { PriceTable } from '@/lib/types';

/**
 * Таблица прайс-листа.
 *
 * Разметка повторяет боевой сайт один в один, включая объединение
 * ячеек (colspan / rowspan). Это важно: в таблице кранов-манипуляторов
 * заголовок «Грузоподъемность тонн» объединяет две колонки —
 * грузоподъёмность шасси и грузоподъёмность крана, а подшапка
 * «ШАССИ | КРАН» стоит ровно под ними. Без colspan подшапка
 * съезжала на колонку влево.
 *
 * Данные приходят из content/seed.json → scripts/migrate-price-tables.mjs,
 * который парсит исходный HTML боевого сайта.
 */

type Row = PriceTable['rows'][number];
type Cell = Row[number];

/** Ячейка с объединением — признак строки заголовка */
function isSpanning(row: Row) {
  return row.some((c) => (c.colspan ?? 1) > 1 || (c.rowspan ?? 1) > 1);
}

/**
 * Строка с данными.
 *
 * Данные — это строка, где есть ссылка на позицию каталога
 * либо строка из одних значений. Всё, что до неё, — шапка:
 * строки с объединениями, подзаголовки и пояснения вроде
 * «- 10% при оплате от 30 дней» (в legacy это вторая строка шапки —
 * подпись под колонкой «Скидка от срока»).
 */
function isDataRow(row: Row) {
  if (row.some((c) => c.link)) return true;
  if (isSpanning(row)) return false;
  return row.some((c) => /^\s*\d/.test(c.text));
}

/**
 * Что показать в ячейке.
 *
 * В legacy выделенное значение оборачивалось в <b>, но иногда это
 * только часть текста: «<b>17</b> КВт», «<b>10</b> 000 + 120 руб./км».
 * Если показывать только <b>, теряется единица измерения и часть
 * суммы. Поэтому берём полный текст, когда он начинается с выделенного.
 */
function cellText(cell: Cell): string {
  if (!cell.strong) return cell.text;
  if (cell.text === cell.strong) return cell.strong;
  if (cell.text.startsWith(cell.strong)) return cell.text;
  return cell.strong;
}

export default function PriceTableView({ table }: { table: PriceTable }) {
  const rows = table.rows ?? [];
  if (!rows.length) return null;

  const firstData = rows.findIndex(isDataRow);
  const headRows = firstData === -1 ? rows : rows.slice(0, firstData);
  const bodyRows = firstData === -1 ? [] : rows.slice(firstData);

  return (
    <div className="price-table-block">
      <div className="price-table-wrap">
        <table className="price-table">
          {headRows.length > 0 && (
            <thead>
              {headRows.map((row, ri) => (
                <tr key={`h${ri}`} className={ri === 0 ? 'price-table__head' : undefined}>
                  {row.map((cell, ci) => (
                    <th
                      key={ci}
                      scope="col"
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                      className={ci === 0 ? 'is-first' : undefined}
                    >
                      {cellText(cell)}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
          )}

          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={`b${ri}`}>
                {row.map((cell, ci) =>
                  cell.link ? (
                    <td key={ci} colSpan={cell.colspan} rowSpan={cell.rowspan} className="price-table__name">
                      <a href={cell.link}>{cell.text}</a>
                    </td>
                  ) : (
                    <td
                      key={ci}
                      colSpan={cell.colspan}
                      rowSpan={cell.rowspan}
                      className={cell.strong ? 'is-strong' : undefined}
                    >
                      {cellText(cell)}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
