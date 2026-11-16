'use client';

import { useMemo, useState } from 'react';

export interface AdminEquipment {
  slug: string;
  category: string;
  title: string;
  model: string;
  power: number | null;
  price: number | null;
  priceUnit: string;
}

export interface AdminSettings {
  company: string;
  phone: string;
  phoneRaw: string;
  email: string;
  address: string;
  workingHours: string;
  foundedYear: number;
  fleetMW: number;
  deliveryHours: number;
  rating: number;
  ratingCount: number;
  discountFromDays: number;
  discountPercent: number;
}

/**
 * Минимальный редактор контента для mock-режима.
 * Заменяет админку CMS на этапе прототипа: правим значения →
 * пишем content/seed.json → сайт обновляется.
 */
export default function AdminEditor({
  equipment,
  settings,
  tokenRequired,
}: {
  equipment: AdminEquipment[];
  settings: AdminSettings;
  tokenRequired: boolean;
}) {
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<'equipment' | 'settings'>('equipment');
  const [rows, setRows] = useState<Record<string, { price: string; title: string; model: string; power: string }>>(
    () =>
      Object.fromEntries(
        equipment.map((e) => [
          e.slug,
          {
            price: e.price === null ? '' : String(e.price),
            title: e.title,
            model: e.model,
            power: e.power === null ? '' : String(e.power),
          },
        ])
      )
  );
  const [form, setForm] = useState(settings);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of equipment) m.set(e.category, (m.get(e.category) ?? 0) + 1);
    return [...m.entries()];
  }, [equipment]);

  const dirtyCount = useMemo(() => {
    let n = 0;
    for (const e of equipment) {
      const r = rows[e.slug];
      if (!r) continue;
      const price = r.price.trim() === '' ? null : Number(r.price.replace(/\s/g, ''));
      if (price !== e.price) n++;
      if (r.title !== e.title) n++;
      if (r.model !== e.model) n++;
      if ((r.power.trim() === '' ? null : Number(r.power)) !== e.power) n++;
    }
    return n;
  }, [equipment, rows]);

  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const payload: Record<string, unknown> = { token };
      if (tab === 'settings') {
        payload.settings = form;
      } else {
        payload.equipment = equipment.map((e) => {
          const r = rows[e.slug];
          return {
            slug: e.slug,
            price: r.price.trim() === '' ? null : Number(r.price.replace(/\s/g, '')),
            title: r.title,
            model: r.model,
            power: r.power.trim() === '' ? null : Number(r.power),
          };
        });
      }

      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      setStatus({ kind: json.success ? 'ok' : 'err', text: json.message });
    } catch (e) {
      setStatus({ kind: 'err', text: e instanceof Error ? e.message : 'Ошибка сети' });
    } finally {
      setBusy(false);
    }
  }

  function setField(slug: string, key: 'price' | 'title' | 'model' | 'power', value: string) {
    setRows((prev) => ({ ...prev, [slug]: { ...prev[slug], [key]: value } }));
  }

  return (
    <div className="adm">
      <header className="adm__head">
        <div>
          <h1>Редактор контента</h1>
          <p>
            Локальная замена админки CMS на этапе прототипа. Правки пишутся в
            <code> content/seed.json</code>; сайт подхватывает их при следующем
            обновлении (ISR, до 60 секунд).
          </p>
        </div>
        <div className="adm__token">
          <label className="field__label" htmlFor="adm-token">Токен доступа</label>
          <input
            className="form__control"
            id="adm-token"
            type="password"
            value={token}
            placeholder={tokenRequired ? 'введите токен из .env' : 'ADMIN_TOKEN не задан — запись запрещена'}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>
      </header>

      {tokenRequired && !token && (
        <p className="adm__warn">
          Задайте <code>ADMIN_TOKEN</code> в файле <code>variant-c/.env</code> и
          перезапустите сервер — без него сохранение работать не будет.
        </p>
      )}

      <nav className="adm__tabs">
        <button className="adm__tab" data-active={tab === 'equipment'} onClick={() => setTab('equipment')}>
          Техника <span>{equipment.length}</span>
        </button>
        <button className="adm__tab" data-active={tab === 'settings'} onClick={() => setTab('settings')}>
          Настройки
        </button>
      </nav>

      {tab === 'equipment' ? (
        <>
          <div className="adm__meta">
            {categories.map(([c, n]) => (
              <span className="badge badge--info" key={c}>
                {c} — {n}
              </span>
            ))}
          </div>

          <div className="adm__table-wrap">
            <table className="adm__table">
              <thead>
                <tr>
                  <th>Категория</th>
                  <th>Мощность</th>
                  <th>Модель</th>
                  <th>Название</th>
                  <th>Цена, ₽</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map((e) => {
                  const r = rows[e.slug] ?? { price: '', title: '', model: '', power: '' };
                  return (
                    <tr key={e.slug}>
                      <td className="adm__cat">{e.category}</td>
                      <td>
                        <input
                          className="adm__input adm__input--num"
                          value={r.power}
                          onChange={(ev) => setField(e.slug, 'power', ev.target.value)}
                          inputMode="numeric"
                        />
                      </td>
                      <td>
                        <input
                          className="adm__input"
                          value={r.model}
                          onChange={(ev) => setField(e.slug, 'model', ev.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="adm__input"
                          value={r.title}
                          onChange={(ev) => setField(e.slug, 'title', ev.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="adm__input adm__input--num"
                          value={r.price}
                          placeholder={e.priceUnit}
                          onChange={(ev) => setField(e.slug, 'price', ev.target.value)}
                          inputMode="numeric"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="adm__settings">
          {(
            [
              ['company', 'Компания', 'text'],
              ['phone', 'Телефон (текст)', 'text'],
              ['phoneRaw', 'Телефон (для tel:)', 'text'],
              ['email', 'E-mail', 'text'],
              ['address', 'Адрес', 'text'],
              ['workingHours', 'График работы', 'text'],
              ['foundedYear', 'Год основания', 'number'],
              ['fleetMW', 'Мощность парка, МВт', 'number'],
              ['deliveryHours', 'Доставка, часов', 'number'],
              ['rating', 'Рейтинг', 'number'],
              ['ratingCount', 'Отзывов', 'number'],
              ['discountFromDays', 'Скидка с дня аренды', 'number'],
              ['discountPercent', 'Скидка, %', 'number'],
            ] as const
          ).map(([key, label, type]) => (
            <div className="adm__field" key={key}>
              <label className="field__label" htmlFor={`adm-${key}`}>
                {label}
              </label>
              <input
                className="form__control"
                id={`adm-${key}`}
                type={type}
                value={String(form[key] ?? '')}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [key]: type === 'number' ? Number(e.target.value) : e.target.value,
                  }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="adm__foot">
        <button className="btn" onClick={save} disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить в seed.json'}
        </button>
        <a className="btn btn--outline" href="/" target="_blank" rel="noopener noreferrer">
          Открыть сайт
        </a>
        {tab === 'equipment' && dirtyCount > 0 && (
          <span className="adm__dirty">несохранённых изменений: {dirtyCount}</span>
        )}
      </div>

      {status && (
        <p className={`adm__status adm__status--${status.kind}`} role="status">
          {status.text}
        </p>
      )}
    </div>
  );
}
