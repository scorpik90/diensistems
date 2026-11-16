/** Форматирование чисел и склонений. Общий модуль для сервера и клиента. */

export function money(v: number) {
  return new Intl.NumberFormat('ru-RU').format(v);
}

/** Правильные русские склонения: 1 модель, 2 модели, 5 моделей */
export function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

export function modelsLabel(n: number) {
  return `${n} ${plural(n, 'модель', 'модели', 'моделей')}`;
}
