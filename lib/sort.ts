import type { Equipment } from './types';

/**
 * Порядок вывода позиций каталога.
 *
 * 1) «Хит аренды» (60 и 100 кВт) — их чаще всего берут;
 * 2) «Новинка» — метку ставит менеджер в CMS;
 * 3) остальные — по возрастанию мощности.
 *
 * Модуль общий для серверных и клиентских компонентов,
 * поэтому не помечаем его 'use client'.
 */
export function sortByPriority(items: Equipment[]): Equipment[] {
  const isHit = (e: Equipment) => e.power === 60 || e.power === 100;
  const rank = (e: Equipment) => (e.isNew ? 1 : 0);

  return [...items].sort((a, b) => {
    if (isHit(a) !== isHit(b)) return isHit(a) ? -1 : 1;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return (a.power ?? 0) - (b.power ?? 0);
  });
}
