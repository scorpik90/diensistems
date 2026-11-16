import type { Equipment } from './types';

/**
 * Поиск значения характеристики по названию строки.
 *
 * У разной техники группы ТТХ устроены по-разному: у ДГУ расход топлива
 * лежит в группе «Расход топлива», у компрессоров — в другой. Искать по
 * индексу нельзя, ищем по названию строки.
 */
export function findSpec(
  item: Pick<Equipment, 'specGroups'>,
  labels: RegExp
): string | null {
  for (const group of item.specGroups ?? []) {
    for (const row of group.rows ?? []) {
      if (labels.test(row.label)) return row.value;
    }
  }
  return null;
}
