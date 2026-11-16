/* Проверка логики маски — та же, что в LeadForm.tsx */
function formatNational(d) {
  let out = '+7';
  if (d.length) out += ' (' + d.slice(0, 3);
  if (d.length >= 3) out += ')';
  if (d.length > 3) out += ' ' + d.slice(3, 6);
  if (d.length > 6) out += '-' + d.slice(6, 8);
  if (d.length > 8) out += '-' + d.slice(8, 10);
  return out;
}

function apply(raw, caret = raw.length) {
  const allDigits = raw.replace(/\D/g, '');
  const ours = allDigits.startsWith('7');

  let national;
  if (ours) national = allDigits.slice(1);
  else if (allDigits.startsWith('8')) {
    national = allDigits.length === 11 ? allDigits.slice(1) : '7' + allDigits.slice(1);
  } else national = allDigits;
  national = national.slice(0, 10);

  const beforeDigits = raw.slice(0, caret).replace(/\D/g, '');
  const nationalBefore = ours
    ? Math.max(0, beforeDigits.length - (beforeDigits.startsWith('7') ? 1 : 0))
    : beforeDigits.length;

  const formatted = formatNational(national);
  /* Курсор считаем по цифрам после нашего «+7» */
  const nationalPart = formatted.slice(2);
  let seen = 0, pos = formatted.length;
  for (let i = 0; i < nationalPart.length; i++) {
    if (/\d/.test(nationalPart[i])) {
      seen++;
      if (seen === nationalBefore) { pos = 2 + i + 1; break; }
    }
  }
  return { value: formatted, pos };
}

/* Посимвольный набор: символ дописывается в позицию курсора,
   как при реальном вводе. В браузере после нажатия клавиши
   значение уже содержит символ, а курсор стоит ПОСЛЕ него. */
function typeSequence(seq) {
  let value = '';
  for (const ch of seq) {
    const caret = value.length;
    const raw = value.slice(0, caret) + ch + value.slice(caret);
    const r = apply(raw, caret + 1);   // курсор после введённого символа
    value = r.value;
  }
  return value;
}

const cases = [
  ['набор 9999816209', typeSequence('9999816209'), '+7 (999) 981-62-09'],
  ['вставка 9999816209', apply('9999816209').value, '+7 (999) 981-62-09'],
  ['вставка 89161234567', apply('89161234567').value, '+7 (916) 123-45-67'],
  ['вставка +79161234567', apply('+79161234567').value, '+7 (916) 123-45-67'],
  ['набор 9161234567', typeSequence('9161234567'), '+7 (916) 123-45-67'],
  ['набор 8', typeSequence('8'), '+7 (7'],
  ['набор 916', typeSequence('916'), '+7 (916)'],
  ['набор 916123', typeSequence('916123'), '+7 (916) 123'],
];

let bad = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) bad++;
  console.log(`  ${ok ? '✓' : '✗'} ${name.padEnd(26)} → "${got}"${ok ? '' : `  (ожидали "${want}")`}`);
}
console.log(bad === 0 ? '\nВсе сценарии маски верны.' : `\nОшибок: ${bad}`);
