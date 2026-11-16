'use client';

/**
 * Форма заявки — «островок» (client component).
 *
 * Отправляет на /api/leads — серверный Route Handler, который:
 *   1) валидирует вход,
 *   2) пишет заявку в CMS (и дублирует в боевой эндпоинт и CRM),
 *   3) отдаёт текст ответа, который показывается под формой.
 *
 * Все подписи — из CMS (блок «form.main»), телефон — из настроек сайта.
 */
import { useEffect, useRef, useState } from 'react';
import { IconCheck } from './icons';

export interface FormLabels {
  title?: string;
  lead?: string;
  nameLabel?: string;
  namePlaceholder?: string;
  phoneLabel?: string;
  phonePlaceholder?: string;
  topicLabel?: string;
  topics?: string[];
  defaultTopic?: string;
  commentLabel?: string;
  commentHint?: string;
  commentPlaceholder?: string;
  btn?: string;
  btnSending?: string;
  consentBefore?: string;
  consentLink?: string;
  errorText?: string;
  errorFallback?: string;
  sendFallback?: string;
  successFallback?: string;
  autoText?: string;
}

/**
 * Тема заявки по категории техники.
 *
 * В каталоге у позиции хранится категория, а в форме — понятные
 * посетителю варианты. Сопоставление живёт здесь, чтобы ссылка
 * «Заказать» приносила уже выбранную тему.
 */
const TOPIC_BY_CATEGORY: Record<string, string> = {
  generator: 'Дизельный генератор',
  pes: 'Мобильная станция (ПЭС)',
  compressor: 'Компрессор',
  'compressor-shift': 'Компрессор',
  manipulator: 'Кран-манипулятор',
};

export default function LeadForm({
  defaultTopic,
  labels = {},
  phone = '',
  policyUrl = '/politika-obrabotki-personalnyh-dannyh',
}: {
  defaultTopic?: string;
  labels?: FormLabels;
  /** Телефон для подсказки при ошибке */
  phone?: string;
  policyUrl?: string;
}) {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [topic, setTopic] = useState(defaultTopic || labels.defaultTopic || '');

  const topics = labels.topics ?? [
    'Дизельный генератор',
    'Мобильная станция (ПЭС)',
    'Компрессор',
    'Кран-манипулятор',
    'Резервное электроснабжение',
  ];

  const t = (key: keyof FormLabels, fallback: string) =>
    (labels[key] as string | undefined) || fallback;

  /* Предзаполнение из каталога и карточки товара.
     Ссылка «Заказать» ведёт на главную к форме заявки:
     /?model=…&kw=…&cat=…#lead
     — параметры в строке запроса, якорь после них, чтобы страница
     прокрутилась к форме, а не осталась наверху.

     Эффект без зависимостей: форма не перемонтируется при переходе
     внутри главной, но перерисовывается — тогда и применяем новые
     параметры. Повторно те же параметры не трогаем, чтобы не
     затирать то, что пользователь напечатал сам. */
  const appliedUrl = useRef('');
  useEffect(() => {
    const query = window.location.search;
    const hash = window.location.hash.split('?')[1] ?? '';
    const params = new URLSearchParams(query || hash);
    const signature = params.toString();
    if (signature === appliedUrl.current) return;
    appliedUrl.current = signature;

    const model = params.get('model');
    const kw = params.get('kw');
    const days = params.get('days');
    const cat = params.get('cat');

    /* Тема заявки — по категории техники */
    if (cat && TOPIC_BY_CATEGORY[cat]) {
      setTopic(TOPIC_BY_CATEGORY[cat]);
    }

    if (!model) return;
    const ta = document.getElementById('lf-msg') as HTMLTextAreaElement | null;
    if (ta) {
      ta.value = (labels.autoText ?? 'Интересует {model}{kw}{days}. Расчёт с сайта.')
        .replace('{model}', model)
        .replace('{kw}', kw ? ` (${kw} кВт)` : '')
        .replace('{days}', days ? `, срок аренды ${days} дн.` : '');
    }
  });

  /* ── Маска телефона ──
     Форматируем по мере ввода и ставим курсор после того же количества
     цифр, что было до него. Иначе символы вставляются в середину строки
     и номера перемешиваются.

     Логика: маска всегда начинается с «+7», поэтому набираемое
     «национальное» число — это все цифры, кроме нашей кодовой.
     Если пользователь сам начал с 8 — заменяем на 7. */
  function formatNational(d: string): string {
    let out = '+7';
    if (d.length) out += ' (' + d.slice(0, 3);
    if (d.length >= 3) out += ')';
    if (d.length > 3) out += ' ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }

  function onPhoneInput(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;

    const allDigits = raw.replace(/\D/g, '');
    const ours = allDigits.startsWith('7');

    /* Национальное число: всё, кроме добавленной нами семёрки */
    let national: string;
    if (ours) {
      national = allDigits.slice(1);
    } else if (allDigits.startsWith('8')) {
      /* Пользователь начал с 8 — это код страны:
         11 цифр → 8 меняем на 7, остальные 10 — национальный номер;
         меньше 11 → набираем 8 как первую цифру номера. */
      national =
        allDigits.length === 11 ? allDigits.slice(1) : '7' + allDigits.slice(1);
    } else {
      national = allDigits;
    }
    national = national.slice(0, 10);

    /* Сколько цифр было набрано до курсора (тоже без нашей семёрки) */
    const beforeDigits = raw.slice(0, caret).replace(/\D/g, '');
    const nationalBefore = ours
      ? Math.max(0, beforeDigits.length - (beforeDigits.startsWith('7') ? 1 : 0))
      : beforeDigits.length;

    const formatted = formatNational(national);
    el.value = formatted;

    /* Курсор — после nationalBefore цифр в новой строке.
       Считаем только цифры после нашего «+7», иначе курсор встаёт
       на позицию служебной семёрки и цифры начинают перемешиваться. */
    const nationalPart = formatted.slice(2);
    let seen = 0;
    let pos = formatted.length;
    for (let i = 0; i < nationalPart.length; i++) {
      if (/\d/.test(nationalPart[i])) {
        seen++;
        if (seen === nationalBefore) {
          pos = 2 + i + 1;
          break;
        }
      }
    }
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      /* тип не поддерживает selection */
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    setState('sending');
    setError('');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? t('sendFallback', 'Не удалось отправить заявку'));
      }
      setState('ok');
      setMessage(json.message ?? t('successFallback', 'Заявка отправлена. Мы перезвоним в течение 10 минут.'));
      form.reset();
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : t('errorFallback', 'Ошибка отправки'));
    }
  }

  return (
    <form className="form" id="lead-form" onSubmit={onSubmit} noValidate>
      <h3 className="form__title">{t('title', 'Заказать звонок')}</h3>
      <p className="form__sub">{t('lead', 'Перезвоним, уточним детали и подготовим предложение')}</p>
      <div className="form__grid">
        <div className="form__row">
          <div>
            <label className="field__label" htmlFor="lf-name">
              {t('nameLabel', 'Имя')}
            </label>
            <input
              className="form__control"
              id="lf-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={t('namePlaceholder', 'Как к вам обращаться')}
              required
            />
          </div>
          <div>
            <label className="field__label" htmlFor="lf-phone">
              {t('phoneLabel', 'Телефон')}
            </label>
            <input
              className="form__control"
              id="lf-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder={t('phonePlaceholder', '+7 (___) ___-__-__')}
              onChange={onPhoneInput}
              required
            />
          </div>
        </div>

        <div>
          <label className="field__label" htmlFor="lf-topic">
            {t('topicLabel', 'Что требуется')}
          </label>
          <select
            className="select"
            id="lf-topic"
            name="topic"
            value={topic || topics[0]}
            onChange={(e) => setTopic(e.target.value)}
          >
            {topics.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="field__label" htmlFor="lf-msg">
            {t('commentLabel', 'Комментарий')}{' '}
            <span className="field__hint">{t('commentHint', '(необязательно)')}</span>
          </label>
          <textarea
            className="form__control"
            id="lf-msg"
            name="message"
            placeholder={t('commentPlaceholder', 'Мощность, срок аренды, адрес объекта')}
          />
        </div>

        {/* honeypot: поле скрыто от человека, но боты его заполняют.
            /api/leads молча отбрасывает такие заявки (отвечает об успехе). */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, opacity: 0 }}
        />

        <button className="btn btn--block btn--lg" type="submit" disabled={state === 'sending'}>
          {state === 'sending' ? t('btnSending', 'Отправляем…') : t('btn', 'Отправить заявку')}
        </button>

        <p className="form__agree">
          {t('consentBefore', 'Нажимая кнопку, вы соглашаетесь с')}{' '}
          <a href={policyUrl} target="_blank" rel="noopener noreferrer">
            {t('consentLink', 'политикой обработки персональных данных')}
          </a>
          .
        </p>

        <p className="form__note" id="lf-note" data-show={String(state === 'ok')} role="status">
          <IconCheck />
          {message}
        </p>

        {state === 'error' && (
          <p className="form__note" data-show="true" role="alert" style={{ background: 'var(--signal-bg)', color: 'var(--signal)' }}>
            {error}.{' '}
            {(labels.errorText ?? 'Заполните форму или позвоните нам: {phone}').replace(
              '{phone}',
              phone
            )}
          </p>
        )}
      </div>
    </form>
  );
}
