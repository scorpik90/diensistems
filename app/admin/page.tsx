import { redirect } from 'next/navigation';
import { getCMS } from '@/lib/cms';
import AdminEditor from '@/components/AdminEditor';

/**
 * Локальный редактор контента (mock-режим).
 *
 *   http://127.0.0.1:3100/admin
 *
 * Когда подключена настоящая CMS (CMS_PROVIDER=strapi), этот маршрут
 * отдаёт ссылку на админку Strapi — отдельный редактор не нужен,
 * менеджеры работают в привычном интерфейсе с обычным логином.
 *
 * В mock-режиме редактор заменяет админку CMS на этапе прототипа:
 * меняем цены, названия и настройки без пересборки приложения.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Редактор контента', robots: { index: false, follow: false } };

export default async function AdminPage() {
  const cms = getCMS();

  /* Настоящая CMS — ведём в админку Strapi */
  if (cms.name === 'strapi') {
    const strapiUrl = process.env.STRAPI_URL ?? 'http://localhost:1337';
    const adminUrl = `${strapiUrl}/admin`;
    return (
      <main id="main" className="adm__page">
        <div className="container">
          <div className="adm__head">
            <div>
              <h1>Админка контента</h1>
              <p>
                CMS подключена. Контент правится в Strapi — с обычным входом по
                email и паролю, с ролями для нескольких менеджеров и историей
                изменений. Редактор ниже больше не используется.
              </p>
            </div>
            <div className="adm__token">
              <a className="btn btn--lg" href={adminUrl} target="_blank" rel="noopener noreferrer">
                Открыть админку Strapi
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* Mock-режим — локальный редактор */
  const [equipment, settings] = await Promise.all([
    cms.getEquipment(),
    cms.getSettings(),
  ]);

  return (
    <main id="main" className="adm__page">
      <div className="container">
        <AdminEditor
          tokenRequired={!process.env.ADMIN_TOKEN}
          settings={settings}
          equipment={equipment.map((e) => ({
            slug: e.slug,
            category: e.category,
            title: e.title,
            model: e.model,
            power: e.power,
            price: e.price?.value ?? null,
            priceUnit: e.price?.unit || '/сутки',
          }))}
        />
      </div>
    </main>
  );
}
