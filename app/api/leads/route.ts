import { NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Приём заявок.
 *
 * ГЛАВНЫЙ КАНАЛ — CMS. Заявка всегда сохраняется в коллекции
 * «Заявки» (Strapi), поэтому она не теряется, даже если почта
 * или сторонние сервисы недоступны. Менеджер видит её в админке
 * и может взять в работу.
 *
 * ДОПОЛНИТЕЛЬНЫЕ КАНАЛЫ (не обязательные):
 *   • /sendfeed/ на боевом сайте — пока он жив, заявки идут
 *     в существующую почтовую цепочку без переделки бэкенда;
 *   • CRM_WEBHOOK_URL — если CRM настроена.
 *
 * В режиме mock (CMS отключена) заявки пишутся в data/leads.ndjson —
 * чтобы ничего не потерялось при разработке.
 *
 * Форма на клиенте не знает ни про /sendfeed/, ни про CRM:
 * она просто шлёт JSON на /api/leads.
 */

export const runtime = 'nodejs';

interface Lead {
  name?: string;
  phone?: string;
  topic?: string;
  message?: string;
  order_item?: string;
  source?: string;
}

const PHONE_RE = /^[+()\-\s\d]{10,20}$/;

/* ─── Сохранение в CMS ─────────────────────────────────────────── */

async function saveToCms(data: {
  name: string;
  phone: string;
  topic: string;
  message: string;
  orderItem: string;
  source: string;
}): Promise<boolean> {
  const base = process.env.STRAPI_URL;
  const token = process.env.STRAPI_WRITE_TOKEN ?? process.env.STRAPI_TOKEN;
  if (!base || !token) return false;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        data: {
          name: data.name,
          phone: data.phone,
          topic: data.topic || null,
          message: data.message || null,
          orderItem: data.orderItem || null,
          source: data.source || null,
          status: 'new',
        },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[leads] CMS отклонила заявку:', res.status, (await res.text()).slice(0, 200));
      return false;
    }
    return true;
  } catch (e) {
    console.error('[leads] не удалось сохранить в CMS:', e);
    return false;
  }
}

/* ─── Резервная запись в файл (режим mock) ─────────────────────── */

async function saveToFile(line: string): Promise<boolean> {
  try {
    const dir = path.join(process.cwd(), 'data');
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, 'leads.ndjson'), line + '\n', 'utf8');
    return true;
  } catch (e) {
    console.error('[leads] не удалось записать в файл:', e);
    return false;
  }
}

/* ─── Обработчик ───────────────────────────────────────────────── */

export async function POST(request: Request) {
  let data: Lead;
  try {
    data = (await request.json()) as Lead;
  } catch {
    return NextResponse.json(
      { success: false, message: 'Некорректный формат запроса' },
      { status: 400 }
    );
  }

  const name = (data.name ?? '').trim();
  const phone = (data.phone ?? '').trim();

  if (name.length < 2) {
    return NextResponse.json(
      { success: false, message: 'Укажите имя' },
      { status: 422 }
    );
  }
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json(
      { success: false, message: 'Укажите корректный номер телефона' },
      { status: 422 }
    );
  }

  const lead = {
    name,
    phone,
    topic: (data.topic ?? '').trim(),
    message: (data.message ?? '').trim(),
    orderItem: (data.order_item ?? '').trim(),
    source: (data.source ?? '').trim(),
  };

  const delivered = { cms: false, legacy: false, crm: false, file: false };

  /* 1) CMS — основное хранилище */
  delivered.cms = await saveToCms(lead);

  /* 2) Боевой эндпоинт — пока он жив, заявка идёт в старую почту */
  const legacyUrl = process.env.LEGACY_FEED_URL ?? 'https://genorg.ru/sendfeed/';
  try {
    const res = await fetch(legacyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        zakaz: lead.orderItem,
        feed_name: lead.name,
        phone: lead.phone,
        feed_text: [lead.topic, lead.message].filter(Boolean).join('. '),
        feed: '1',
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    delivered.legacy = res.ok;
  } catch (e) {
    console.error('[leads] legacy feed недоступен:', e);
  }

  /* 3) CRM — если настроена */
  const crmUrl = process.env.CRM_WEBHOOK_URL;
  if (crmUrl) {
    try {
      const res = await fetch(crmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Заявка с сайта: ${lead.topic || 'Генератор'}`,
          name: lead.name,
          phone: lead.phone,
          message: lead.message,
          source: lead.source || 'genorg.ru',
          createdAt: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(8000),
      });
      delivered.crm = res.ok;
    } catch (e) {
      console.error('[leads] CRM webhook недоступен:', e);
    }
  }

  /* 4) Если CMS недоступна (режим mock) — пишем в файл, чтобы не потерять */
  if (!delivered.cms) {
    delivered.file = await saveToFile(
      JSON.stringify({ ...lead, createdAt: new Date().toISOString() })
    );
  }

  const saved = delivered.cms || delivered.legacy || delivered.crm || delivered.file;

  if (!saved) {
    return NextResponse.json(
      {
        success: false,
        message: 'Не удалось отправить заявку. Позвоните нам: +7 (495) 540-52-92',
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Заявка отправлена. Мы перезвоним в течение 10 минут.',
    delivered,
  });
}

/* OPTIONS — для CORS-префлайта, если фронт на другом домене */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN ?? '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
