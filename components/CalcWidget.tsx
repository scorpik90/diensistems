'use client';

/**
 * Калькулятор аренды — «островок» (client component).
 *
 * Данные о моделях и правила скидок приходят с сервера (props),
 * чтобы клиентский JS не содержал дубликат бизнес-логики и цен.
 * Правило скидки — из настроек CMS, цена — из карточки товара.
 * Все подписи — из CMS (блок «calc.main»).
 */
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';

export interface CalcModel {
  kW: number;
  model: string;
  pricePerDay: number;
}

/** Подписи калькулятора из CMS */
export interface CalcLabels {
  title?: string;
  lead?: string;
  taskLabel?: string;
  tasks?: { value: string; label: string; headroom: number; hint?: string }[];
  powerLabel?: string;
  powerHint?: string;
  daysLabel?: string;
  daysOptions?: { value: number; label: string }[];
  phases?: string;
  unit?: string;
  discountText?: string;
  totalText?: string;
  deliveryText?: string;
  btnLock?: string;
  btnCall?: string;
  legal?: string;
  autoText?: string;
}

export default function CalcWidget({
  models,
  discountFromDays,
  discountPercent,
  deliveryHours,
  phoneRaw,
  labels = {},
}: {
  models: CalcModel[];
  discountFromDays: number;
  discountPercent: number;
  deliveryHours: number;
  phoneRaw?: string;
  labels?: CalcLabels;
}) {
  const tasks = labels.tasks ?? [
    { value: 'build', label: 'Стройка', headroom: 20 },
    { value: 'reserve', label: 'Резерв', headroom: 0 },
    { value: 'event', label: 'Мероприятие', headroom: 50 },
  ];
  const daysOptions = labels.daysOptions ?? [
    { value: 1, label: '1–2 дня' },
    { value: 7, label: '3–7 дней' },
    { value: 14, label: '2 недели' },
    { value: 30, label: '1 месяц' },
    { value: 90, label: '3 месяца' },
  ];

  const [task, setTask] = useState<'build' | 'reserve' | 'event'>('build');
  const [idx, setIdx] = useState(2);
  const [days, setDays] = useState(30);

  const scale = useMemo(() => models.map((m) => m.kW), [models]);

  const headroom = tasks.find((t) => t.value === task)?.headroom ?? 0;
  /* Подсказка о запасе — своя у каждого сценария */
  const taskHint = tasks.find((t) => t.value === task)?.hint;
  const powerHint =
    taskHint ?? (labels.powerHint ?? '(запас +{headroom}% под нагрузку)').replace(
      '{headroom}',
      String(headroom)
    );

  const result = useMemo(() => {
    const kW = scale[idx];
    /* Запас мощности: из настроек сценария (стройка +20 %, мероприятие +50 %) */
    const need = kW * (1 + headroom / 100);
    let found = models[models.length - 1];
    for (const m of models) {
      if (m.kW >= need) {
        found = m;
        break;
      }
    }
    const discount = days >= discountFromDays ? discountPercent / 100 : 0;
    const perDay = Math.round(found.pricePerDay * (1 - discount));
    return { model: found, perDay, total: perDay * days, discount: discount > 0 };
  }, [idx, days, task, models, scale, discountFromDays, discountPercent, headroom]);

  const fill = (idx / (scale.length - 1)) * 100;

  /**
   * «Зафиксировать цену»: переносит расчёт в форму заявки —
   * подставляет модель, срок и цену, прокручивает к форме
   * и ставит фокус в поле имени.
   */
  const lockPrice = () => {
    const msg = document.getElementById('lf-msg') as HTMLTextAreaElement | null;
    if (msg) {
      const tpl = labels.autoText ?? '';
      msg.value = tpl
        .replace('{model}', result.model.model)
        .replace('{kW}', String(result.model.kW))
        .replace('{days}', String(days))
        .replace('{price}', money(result.perDay));
    }

    const lead = document.getElementById('lead');
    if (lead) {
      lead.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const name = document.getElementById('lf-name') as HTMLInputElement | null;
        name?.focus({ preventScroll: true });
      }, 700);
    }
  };

  const t = (key: keyof CalcLabels, fallback: string) =>
    (labels[key] as string | undefined) || fallback;

  return (
    <form className="calc" id="calc" onSubmit={(e) => e.preventDefault()}>
      <div className="calc__head">
        <h2>{t('title', 'Калькулятор аренды')}</h2>
        <p>{t('lead', 'Укажите задачу — покажем модель и стоимость')}</p>
      </div>

      <div className="calc__body">
        <div className="field">
          <span className="field__label" id="lbl-task">
            {t('taskLabel', 'Сценарий использования')}
          </span>
          <div className="seg" role="group" aria-labelledby="lbl-task">
            {tasks.map((s) => (
              <button
                key={s.value}
                type="button"
                className="seg__btn"
                aria-pressed={task === s.value}
                onClick={() => setTask(s.value as 'build' | 'reserve' | 'event')}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="calc-power">
            {t('powerLabel', 'Потребность, кВт')}{' '}
            <span className="field__hint">{powerHint}</span>
          </label>
          <input
            className="range"
            type="range"
            id="calc-power"
            min={0}
            max={scale.length - 1}
            value={idx}
            step={1}
            style={{ ['--fill' as string]: `${fill}%` }}
            onChange={(e) => setIdx(Number(e.target.value))}
          />
          <div className="range__scale">
            <span>{scale[0]}</span>
            <span>{scale[Math.floor(scale.length / 2)]}</span>
            <span>{scale[scale.length - 1]}</span>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="calc-days">
            {t('daysLabel', 'Срок аренды')}
          </label>
          <select
            className="select"
            id="calc-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {daysOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="calc__result" aria-live="polite">
          <div className="calc__result-top">
            <p className="calc__model">
              {result.model.model}
              <span>
                {result.model.kW} кВт · {t('phases', '3 фазы · 380 В')}
              </span>
            </p>
            <p className="calc__price">
              {money(result.perDay)} ₽<small>{t('unit', '/сутки')}</small>
            </p>
          </div>
          <div className="calc__meta">
            {result.discount ? (
              <span>
                {(labels.discountText ?? 'Скидка −{discountPercent}% за аренду от {discountFromDays} дней')
                  .replace('{discountPercent}', String(discountPercent))
                  .replace('{discountFromDays}', String(discountFromDays))}
              </span>
            ) : (
              <span>
                Срок: <b>{days === 1 ? '1–2 дня' : `${days} дн.`}</b>
              </span>
            )}
            <span>
              {t('totalText', 'Итого за период')}: <b>{money(result.total)} ₽</b>
            </span>
            <span className="badge badge--ok">
              {(labels.deliveryText ?? 'Доставка от {deliveryHours} ч').replace(
                '{deliveryHours}',
                String(deliveryHours)
              )}
            </span>
          </div>
        </div>

        <div className="calc__actions">
          <button className="btn btn--block" type="button" onClick={lockPrice}>
            {t('btnLock', 'Зафиксировать цену')}
          </button>
          <a className="btn btn--outline btn--block" href={`tel:${phoneRaw ?? ''}`}>
            {t('btnCall', 'Связаться с инженером')}
          </a>
        </div>
        <p className="calc__legal">
          {t('legal', 'Расчёт предварительный. Итоговую стоимость подтвердит инженер.')}
        </p>
      </div>
    </form>
  );
}
