'use client';

/**
 * Калькулятор аренды — «островок» (client component).
 *
 * Данные о моделях и правила скидок приходят с сервера (props),
 * чтобы клиентский JS не содержал дубликат бизнес-логики и цен.
 * Правило скидки — из настроек CMS, цена — из карточки товара.
 */
import { useMemo, useState } from 'react';
import { money } from '@/lib/format';

export interface CalcModel {
  kW: number;
  model: string;
  pricePerDay: number;
}

export default function CalcWidget({
  models,
  discountFromDays,
  discountPercent,
  deliveryHours,
}: {
  models: CalcModel[];
  discountFromDays: number;
  discountPercent: number;
  deliveryHours: number;
}) {
  const [task, setTask] = useState<'build' | 'reserve' | 'event'>('build');
  const [idx, setIdx] = useState(2);
  const [days, setDays] = useState(30);

  const scale = useMemo(() => models.map((m) => m.kW), [models]);

  const result = useMemo(() => {
    const kW = scale[idx];
    /* Запас мощности: стройка +20 %, мероприятие +50 %, резерв без запаса */
    const headroom = task === 'event' ? 1.5 : task === 'build' ? 1.2 : 1.0;
    const need = kW * headroom;
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
  }, [idx, days, task, models, scale, discountFromDays, discountPercent]);

  const fill = (idx / (scale.length - 1)) * 100;

  /**
   * «Зафиксировать цену»: переносит расчёт в форму заявки —
   * подставляет модель, срок и цену, прокручивает к форме
   * и ставит фокус в поле имени.
   */
  const lockPrice = () => {
    const msg = document.getElementById('lf-msg') as HTMLTextAreaElement | null;
    if (msg) {
      msg.value =
        `Интересует ${result.model.model} (${result.model.kW} кВт), ` +
        `срок аренды ${days} дн. Расчёт с сайта: ${result.perDay} ₽/сутки.`;
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

  return (
    <form className="calc" id="calc" onSubmit={(e) => e.preventDefault()}>
      <div className="calc__head">
        <h2>Калькулятор аренды</h2>
        <p>Укажите задачу — покажем модель и стоимость</p>
      </div>

      <div className="calc__body">
        <div className="field">
          <span className="field__label" id="lbl-task">
            Сценарий использования
          </span>
          <div className="seg" role="group" aria-labelledby="lbl-task">
            {(
              [
                ['build', 'Стройка'],
                ['reserve', 'Резерв'],
                ['event', 'Мероприятие'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="seg__btn"
                aria-pressed={task === value}
                onClick={() => setTask(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="calc-power">
            Потребность, кВт{' '}
            <span className="field__hint">
              (запас +{task === 'event' ? '50' : task === 'build' ? '20' : '0'}% под нагрузку)
            </span>
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
            Срок аренды
          </label>
          <select
            className="select"
            id="calc-days"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={1}>1–2 дня</option>
            <option value={7}>3–7 дней</option>
            <option value={14}>2 недели</option>
            <option value={30}>1 месяц</option>
            <option value={90}>3 месяца</option>
          </select>
        </div>

        <div className="calc__result" aria-live="polite">
          <div className="calc__result-top">
            <p className="calc__model">
              {result.model.model}
              <span>
                {result.model.kW} кВт · 3 фазы · 380 В
              </span>
            </p>
            <p className="calc__price">
              {money(result.perDay)} ₽<small>/сутки</small>
            </p>
          </div>
          <div className="calc__meta">
            {result.discount ? (
              <span>
                Скидка <b>−{discountPercent}%</b> за аренду от {discountFromDays} дней
              </span>
            ) : (
              <span>
                Срок: <b>{days === 1 ? '1–2 дня' : `${days} дн.`}</b>
              </span>
            )}
            <span>
              Итого за период: <b>{money(result.total)} ₽</b>
            </span>
            <span className="badge badge--ok">Доставка от {deliveryHours} ч</span>
          </div>
        </div>

        <div className="calc__actions">
          <button className="btn btn--block" type="button" onClick={lockPrice}>
            Зафиксировать цену
          </button>
          <a className="btn btn--outline btn--block" href="tel:+74955405292">
            Связаться с инженером
          </a>
        </div>
        <p className="calc__legal">
          Расчёт предварительный. Итоговую стоимость подтвердит инженер.
        </p>
      </div>
    </form>
  );
}
