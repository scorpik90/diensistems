'use client';

/**
 * Согласие на обработку cookie и иных технических данных.
 *
 * Требование ч. 1 ст. 18.1 Федерального закона № 152-ФЗ: оператор обязан
 * обеспечить пользователю возможность отказаться от обработки
 * технических данных, а также отозвать согласие.
 *
 * Принцип работы:
 *   • пока согласия нет — сторонние ресурсы (бейдж Яндекс.Карт)
 *     не загружаются вообще, cookie третьих лиц не ставятся;
 *   • «Только необходимые» — согласие на технические cookie, без них
 *     сайт работает полностью;
 *   • «Принять все» — согласие и на аналитические cookie;
 *   • выбор сохраняется на год и его можно изменить в подвале.
 */

const CONSENT_KEY = 'genorg-consent';
const CONSENT_TTL = 365 * 24 * 60 * 60 * 1000; /* год */

export type ConsentLevel = 'all' | 'necessary';

export interface Consent {
  level: ConsentLevel;
  /** Момент выбора (мс) */
  at: number;
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Consent;
    if (!parsed?.level) return null;
    /* Выбор устарел — спрашиваем заново */
    if (Date.now() - parsed.at > CONSENT_TTL) {
      window.localStorage.removeItem(CONSENT_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsent(level: ConsentLevel): Consent {
  const consent: Consent = { level, at: Date.now() };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
  return consent;
}

export function clearConsent() {
  try {
    window.localStorage.removeItem(CONSENT_KEY);
  } catch {
    /* игнорируем */
  }
}

/** Разрешено ли ставить аналитические cookie */
export function analyticsAllowed(): boolean {
  return readConsent()?.level === 'all';
}

/**
 * Разрешено ли показывать сторонние виджеты.
 *
 * Виджеты Яндекс.Карт ставят собственные cookie, поэтому при
 * варианте «Только необходимые» они не загружаются вовсе.
 */
export function thirdPartyAllowed(): boolean {
  return readConsent()?.level === 'all';
}
