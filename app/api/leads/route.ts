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
  /* honeypot: люди не видят и не заполняют, боты — заполняют */
  website?: string;
}

const PHONE_RE = /^[+()\-\s\d]{10,20}$/;

/* ─── Rate limit ─────────────────────────────────────────────────
   Каждая заявка уходит сразу в три канала: запись в CMS, проксирование
   на боевой /sendfeed/ (почтовая цепочка) и CRM-webhook. Без лимита
   сайт превращается в открытый релей спама. Лимит фиксированный
   по окнам в памяти процесса — для одного контейнера web этого
   достаточно; за несколькими репликами поставьте лимитер на прокси. */
const RATE_LIMIT = Number(process.env.LEADS_RATE_LIMIT ?? '5'); /* заявок за окно с одного IP */
const RATE_WINDOW_MS = 60 * 60 * 1000;
const hits = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + RATE_WINDOW_MS });
    /* периодическая уборка просроченных ключей */
    if (hits.size > 500) {
      for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/* CORS выдаётся только при явно заданном ALLOWED_ORIGIN. Форма ходит
   со своего домена — preflight и заголовки ей не нужны, а открытый
   «*» позволял бы посторонним сайтам дёргать эндпоинт из браузера. */
function corsHeaders(): Record<string, string> {
  const origin = process.env.ALLOWED_ORIGIN;
  if (!origin) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

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
      { status: 400, headers: corsHeaders() }
    );
  }

  if ((data.website ?? '').trim()) {
    return NextResponse.json(
      { success: true, message: 'Заявка отправлена. Мы перезвоним в течение 10 минут.' },
      { headers: corsHeaders() }
    );
  }

  if (rateLimited(clientIp(request))) {
    return NextResponse.json(
      {
        success: false,
        message: 'Слишком много заявок с этого адреса. Позвоните нам: +7 (495) 540-52-92',
      },
      { status: 429, headers: corsHeaders() }
    );
  }

  const name = (data.name ?? '').trim();
  const phone = (data.phone ?? '').trim();

  if (name.length < 2) {
    return NextResponse.json(
      { success: false, message: 'Укажите имя' },
      { status: 422, headers: corsHeaders() }
    );
  }
  if (!PHONE_RE.test(phone) || phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json(
      { success: false, message: 'Укажите корректный номер телефона' },
      { status: 422, headers: corsHeaders() }
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
      { status: 502, headers: corsHeaders() }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Заявка отправлена. Мы перезвоним в течение 10 минут.',
    delivered,
  }, { headers: corsHeaders() });
}

/* OPTIONS — только если задан ALLOWED_ORIGIN (форма с другого домена).
   Same-origin форме preflight не нужен, а ответ без CORS-заголовков
   не позволяет посторонним сайтам дёргать эндпоинт из браузера. */
export async function OPTIONS() {
  const headers = corsHeaders();
  if (!headers['Access-Control-Allow-Origin']) return new NextResponse(null, { status: 204 });
  return new NextResponse(null, { status: 204, headers });
}
