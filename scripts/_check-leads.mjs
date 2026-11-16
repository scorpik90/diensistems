/** Проверка: куда реально уходят заявки с формы */
const BASE = 'http://127.0.0.1:3100';

console.log('=== 1. Легаси-эндпоинт /sendfeed/ доступен? ===');
try {
  const res = await fetch('https://genorg.ru/sendfeed/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      zakaz: 'тест',
      feed_name: 'Тест Тестов',
      phone: '+7 (999) 000-00-01',
      feed_text: 'Проверка канала доставки заявок',
      feed: '1',
    }).toString(),
    signal: AbortSignal.timeout(10000),
  });
  console.log(`  статус: ${res.status}`);
  console.log(`  тело: ${(await res.text()).slice(0, 300)}`);
} catch (e) {
  console.log(`  ОШИБКА: ${e.message}`);
}

console.log('\n=== 2. Что отвечает наш /api/leads ===');
try {
  const res = await fetch(`${BASE}/api/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Тест Проверки',
      phone: '+7 (999) 000-00-02',
      topic: 'Дизельный генератор',
      message: 'Проверка маршрута заявки',
      source: 'audit',
    }),
  });
  const body = await res.json();
  console.log(`  статус: ${res.status}`);
  console.log(`  ответ: ${JSON.stringify(body)}`);
} catch (e) {
  console.log(`  ОШИБКА: ${e.message}`);
}

console.log('\n=== 3. Есть ли в проекте хранилище заявок? ===');
const fs = await import('node:fs');
const route = fs.readFileSync('app/api/leads/route.ts', 'utf8');
console.log(`  запись в файл: ${/writeFile|appendFile|createWriteStream/.test(route) ? 'есть' : 'НЕТ'}`);
console.log(`  запись в БД:   ${/create|strapi.*POST|\/api\/leads/.test(route) ? 'есть' : 'НЕТ'}`);
console.log(`  отправка почты: ${/nodemailer|smtp|sendMail/.test(route) ? 'есть' : 'НЕТ'}`);
console.log(`  CRM webhook:    ${route.includes('CRM_WEBHOOK_URL') ? 'есть' : 'нет'}`);
console.log(`  legacy feed:    ${route.includes('/sendfeed/') ? 'есть' : 'нет'}`);
