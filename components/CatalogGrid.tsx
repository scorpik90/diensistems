'use client';

/**
 * Каталог с фильтрами.
 *
 * Один компонент обслуживает и витрину на главной, и полный каталог.
 *
 * Фильтр по бренду приходит из адресной строки (?brand=Airman) —
 * ссылки на бренды в шапке и в полосе логотипов ведут сюда.
 *
 * Фильтр по мощности — свой для каждой категории:
 *   • электростанции → кВт;
 *   • компрессоры    → м³/мин (производительность);
 *   • манипуляторы   → т (грузоподъёмность).
 *
 * Порядок вывода:
 *   1) позиции с меткой «Хит аренды»
 *   2) позиции с меткой «Новинка»
 *   3) остальные — по возрастанию мощности
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { money, modelsLabel } from '@/lib/format';
import { equipmentImageDir } from '@/lib/media';
import MediaPlaceholder from '@/components/MediaPlaceholder';
import { sortByPriority } from '@/lib/sort';
import {
  buildAxis,
  headlineMetric,
  inRange,
  pickSpecs,
  type FilterRange,
} from '@/lib/filters';
import type { CategoryId, Equipment } from '@/lib/types';

export function Card({ item }: { item: Equipment }) {
  const dir = equipmentImageDir(item);
  const isHit = item.power === 60 || item.power === 100;
  const metric = headlineMetric(item);
  /* Продажа б/у — это не аренда: заказать и рассчитать тут нечего */
  const isUsed = item.category === 'used';
  /* Три ключевые характеристики — из ТТХ позиции, а не из заглушек */
  const specs = pickSpecs(item);

  return (
    <article className="card">
      {/* Вся карточка — ссылка на страницу позиции.
          Кнопки вынесены из ссылки: вложенные <a> недопустимы,
          а так клик по фото, заголовку и характеристикам
          открывает товар, и кнопки продолжают работать. */}
      <Link className="card__cover" href={`/${item.slug}`}>
        <div className="card__media">
          {!isUsed && (
            <span
              className={`card__tag${isHit ? ' card__tag--hot' : ''}${item.isNew && !isHit ? ' card__tag--new' : ''}`}
            >
              {isHit
                ? 'Хит аренды'
                : item.isNew
                  ? 'Новинка'
                  : metric
                    ? `${metric.value} ${metric.unit}`
                    : item.categoryLabel}
            </span>
          )}
          {dir ? (
            <picture>
              <source type="image/avif" srcSet={`/images/${dir}/400.avif`} />
              <source type="image/webp" srcSet={`/images/${dir}/400.webp`} />
              <img
                src={`/images/${dir}/400.jpg`}
                alt={`${item.title} — аренда`}
                width={400}
                height={300}
                loading="lazy"
                decoding="async"
              />
            </picture>
          ) : (
            <MediaPlaceholder kind="product" title={item.model} subtitle={item.categoryLabel} />
          )}
        </div>

        <div className="card__info">
          <h3 className="card__title">{item.title}</h3>
          <p className="card__model">{item.model}</p>

          <ul className="card__specs">
            {specs.map((s) => (
              <li key={s.label}>
                <span>{s.label}</span>
                <b>{s.value}</b>
              </li>
            ))}
          </ul>
        </div>
      </Link>

      <div className="card__body">
        {item.price && item.price.value > 0 && (
          <div className="card__price">
            <span className="card__price-val">
              {money(item.price.value)} ₽
              {/* Продажа — цена разовая, а не за сутки */}
              {!isUsed && <small>{item.price.unit || '/сутки'}</small>}
              {isUsed && <small>/шт.</small>}
            </span>
          </div>
        )}

        <div className="card__actions">
          {!isUsed && (
            <Link
              className="btn btn--sm"
              href={`/#lead?model=${encodeURIComponent(item.model)}&kw=${item.power ?? ''}`}
            >
              Заказать
            </Link>
          )}
          <Link className="btn btn--outline btn--sm" href={`/${item.slug}`}>
            Подробнее
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function CatalogGrid({
  equipment,
  limit,
  showFilters = true,
  category,
}: {
  equipment: Equipment[];
  /** Сколько карточек показать (витрина на главной) */
  limit?: number;
  showFilters?: boolean;
  /** Категория каталога — от неё зависит ось фильтра */
  category?: CategoryId;
}) {
  const [rangeId, setRangeId] = useState<string | null>(null);
  const [brand, setBrand] = useState<string | null>(null);

  /* Фильтр по бренду — из адресной строки */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const b = q.get('brand');
    if (b) setBrand(b);
  }, []);

  const brands = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of equipment) if (e.brand) m.set(e.brand, (m.get(e.brand) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [equipment]);

  /* Ось фильтра — своя для каждой категории */
  const axis = useMemo(() => buildAxis(category, equipment), [category, equipment]);

  /* Если выбранный диапазон исчез (сменилась категория) — сбрасываем */
  useEffect(() => {
    if (rangeId && axis && !axis.ranges.some((r) => r.id === rangeId)) setRangeId(null);
  }, [axis, rangeId]);

  const shown = useMemo(() => {
    let list = sortByPriority(equipment);
    if (brand) list = list.filter((e) => e.brand === brand);

    const range: FilterRange | null =
      axis && rangeId ? axis.ranges.find((r) => r.id === rangeId) ?? null : null;

    if (axis) {
      list = list.filter((e) => {
        if (!range) return true;
        return inRange(axis.value(e), range);
      });
    }

    return limit ? list.slice(0, limit) : list;
  }, [equipment, rangeId, brand, limit, axis]);

  return (
    <>
      {showFilters && (
        <div className="filterbar">
          {axis && axis.ranges.length > 0 && (
            <div className="filterbar__chips" role="group" aria-label={`Фильтр: ${axis.title}`}>
              <button
                type="button"
                className="chip"
                aria-pressed={rangeId === null}
                onClick={() => setRangeId(null)}
              >
                {axis.allLabel}
              </button>
              {axis.ranges.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="chip"
                  aria-pressed={rangeId === r.id}
                  onClick={() => setRangeId(rangeId === r.id ? null : r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {brands.length > 0 && (
            <div className="filterbar__chips" role="group" aria-label="Фильтр по бренду">
              <button
                type="button"
                className="chip"
                aria-pressed={brand === null}
                onClick={() => setBrand(null)}
              >
                Все бренды
              </button>
              {brands.map(([b, n]) => (
                <button
                  key={b}
                  type="button"
                  className="chip"
                  aria-pressed={brand === b}
                  onClick={() => setBrand(brand === b ? null : b)}
                >
                  {b} <span className="chip__count">{n}</span>
                </button>
              ))}
            </div>
          )}

          <p className="filterbar__count">{modelsLabel(shown.length)}</p>
        </div>
      )}

      <div className="cards">
        {shown.map((e) => (
          <Card item={e} key={e.slug} />
        ))}
      </div>

      {shown.length === 0 && (
        <div className="empty">
          <p className="empty__title">По этим условиям ничего не нашлось</p>
          <p className="empty__text">
            Попробуйте снять фильтр по бренду или выбрать другой диапазон.
          </p>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => {
              setBrand(null);
              setRangeId(null);
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      )}
    </>
  );
}
