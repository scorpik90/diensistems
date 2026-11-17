import { redirect } from 'next/navigation';

/**
 * /admin — короткая ссылка на админку CMS.
 *
 * Раньше здесь стоял локальный редактор контента (mock-режим):
 * он правил content/seed.json мимо CMS. С полноценной CMS такой
 * редактор не нужен — он только путал: две точки правки вместо одной.
 *
 * Теперь /admin просто отправляет в Strapi.
 */
export default function AdminRedirect() {
  const base = (process.env.CMS_PUBLIC_URL ?? process.env.STRAPI_URL ?? 'http://127.0.0.1:1337')
    .replace(/\/$/, '');
  redirect(`${base}/admin`);
}
