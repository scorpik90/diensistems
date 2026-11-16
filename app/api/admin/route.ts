import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Запись контента — локальный «редактор» для mock-режима.
 *
 * ВАЖНО: точка записи на файловую систему. Поэтому она закрыта токеном
 * ADMIN_TOKEN. Если переменная не задана — запись запрещена полностью
 * (безопасное поведение по умолчанию: открытый эндпоинт записи на
 * публичном сайте — это уязвимость).
 *
 * В проде этот маршрут не нужен: контент пишется через Strapi.
 */
export const runtime = 'nodejs';

const SEED_PATH = path.join(process.cwd(), 'content', 'seed.json');

interface Update {
  settings?: Record<string, unknown>;
  equipment?: { slug: string; price?: number | null; title?: string; model?: string; power?: number | null }[];
}

function authorized(request: Request, bodyToken?: string) {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;

  const header = request.headers.get('x-admin-token') ?? '';
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const given = header || bearer || bodyToken || '';
  return given === expected;
}

export async function POST(request: Request) {
  let body: Update;
  try {
    body = (await request.json()) as Update;
  } catch {
    return NextResponse.json({ success: false, message: 'Некорректный JSON' }, { status: 400 });
  }

  if (!authorized(request, (body as { token?: string }).token)) {
    return NextResponse.json(
      {
        success: false,
        message:
          'Отказано в доступе. Задайте ADMIN_TOKEN в .env и передавайте его в заголовке X-Admin-Token.',
      },
      { status: 401 }
    );
  }

  const raw = await fs.readFile(SEED_PATH, 'utf8');
  const seed = JSON.parse(raw);

  /* Настройки */
  if (body.settings) {
    for (const [k, v] of Object.entries(body.settings)) {
      if (k in seed.settings) seed.settings[k] = v;
    }
  }

  /* Позиции каталога: цена, название, модель, мощность */
  let changed = 0;
  if (body.equipment?.length) {
    for (const upd of body.equipment) {
      const item = seed.equipment.find((e: { slug: string }) => e.slug === upd.slug);
      if (!item) continue;
      if (upd.price !== undefined) {
        item.price = upd.price === null ? null : { value: upd.price, unit: item.price?.unit || '/сутки' };
      }
      if (upd.title !== undefined) item.title = upd.title;
      if (upd.model !== undefined) item.model = upd.model;
      if (upd.power !== undefined) item.power = upd.power;
      changed++;
    }
  }

  await fs.writeFile(SEED_PATH, JSON.stringify(seed, null, 2), 'utf8');

  return NextResponse.json({
    success: true,
    message: `Сохранено. Изменено позиций: ${changed}. Изменения появятся на сайте в течение минуты (ISR) или сразу после перезапуска сервера.`,
    changed,
  });
}
