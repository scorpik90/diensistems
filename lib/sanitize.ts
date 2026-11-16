/**
 * Серверная санитизация HTML из CMS — защита в глубину (defense in depth).
 *
 * Контент `bodyHtml` пишут доверенные редакторы в Strapi, но перед рендером
 * через dangerouslySetInnerHTML HTML прогоняется через allowlist: остаются
 * только разрешённые теги и атрибуты. Это страхует от stored XSS, если
 * аккаунт менеджера скомпрометирован или при будущих импортах стороннего
 * HTML в CMS.
 *
 * Подход: регэксповая нормализация без внешних зависимостей.
 *
 *   1) вырезаются комментарии и «исполняемые» контейнеры целиком:
 *      script, style, iframe, object, embed, svg, form, button, textarea,
 *      noscript — вместе с содержимым;
 *   2) одиночные опасные теги (input, meta, link, base, frame) вырезаются;
 *   3) у оставшихся тегов остаются только атрибуты из allowlist
 *      (href, src, alt, title, colspan/rowspan, class, id, размеры, align/valign);
 *   4) URL в href/src пропускаются только со схемами http(s), mailto, tel
 *      либо относительные — javascript:, data:, vbscript: отбрасываются;
 *   5) инлайн-обработчики on* не входят в allowlist и удаляются всегда.
 *
 * Разметка, на которой держится вёрстка migrated-страниц (colspan/rowspan
 * таблиц прайса, классы legacy-контента), полностью сохраняется.
 */

const DROP_CONTAINERS =
  /<\s*(script|style|iframe|object|embed|svg|form|button|textarea|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;

const DROP_VOID =
  /<\s*(input|meta|link|base|frame)\b[^>]*\/?>/gi;

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)(\/?)>/g;

const ATTR_RE = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g;

const ALLOWED_TAGS = new Set([
  'a', 'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'span', 'div',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
  'caption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'figcaption',
  'blockquote', 'small', 'sup', 'sub', 'hr', 'center', 'font', 'nobr',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'colspan', 'rowspan',
  'class', 'id', 'width', 'height', 'align', 'valign',
]);

/** Разрешённые схемы и относительные пути в URL-атрибутах. */
function safeUrl(value: string): boolean {
  const t = value.trim().toLowerCase();
  if (!t || t.startsWith('#')) return true;
  if (/^(https?:)?\/\//.test(t)) return true; // http(s): и протокол-относительный //host
  if (t.startsWith('mailto:') || t.startsWith('tel:')) return true;
  /* Нет схемы (или начинается с /, ./, ?) — это относительный путь */
  if (!/^[a-z][a-z0-9+.-]*:/.test(t)) return true;
  return false; // javascript:, data:, vbscript: и прочие схемы
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  let out = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(DROP_CONTAINERS, '')
    .replace(DROP_VOID, '');

  /* Пересобираем оставшиеся теги: имя по allowlist, атрибуты по allowlist */
  out = out.replace(TAG_RE, (_m, close: string, name: string, attrs: string, self: string) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return ''; // незнакомые теги убираем, их текст остаётся

    if (close) return `</${tag}>`;

    const kept: string[] = [];
    for (const a of attrs.matchAll(ATTR_RE)) {
      const an = a[1].toLowerCase();
      if (!ALLOWED_ATTRS.has(an)) continue;
      const value = (a[3] ?? a[4] ?? a[5] ?? '').trim();
      if ((an === 'href' || an === 'src') && !safeUrl(value)) continue;
      kept.push(`${an}="${value.replace(/"/g, '&quot;')}"`);
    }

    return `<${tag}${kept.length ? ' ' + kept.join(' ') : ''}${self ? ' /' : ''}>`;
  });

  return out;
}
