import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import LeadForm from '@/components/LeadForm';
import { IconClock, IconMail, IconPhone, IconPin } from '@/components/icons';
import type { SiteSettings, StaticPage } from '@/lib/types';

/**
 * Страница контактов.
 *
 * Раньше здесь выводился legacy-блок вида «Телефон: … e-mail: … адрес: …».
 * Те же данные уже есть в шапке и в подвале — страница выглядела
 * перегруженной дублиями. Здесь они собраны в один аккуратный блок
 * и поданы как карточки, а не как строки текста.
 */
export default async function ContactsView({
  page,
  settings,
}: {
  page: StaticPage;
  settings: SiteSettings;
}) {
  const departments = await getCMS().getEquipmentByCategory('generator');

  return (
    <>
      <SiteHeader settings={settings} active="/contacts" />

      <main id="main">
        <section className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">Главная</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{page.title}</li>
              </ul>
            </nav>

            <div className="head">
              <span className="head__eyebrow">Контакты</span>
              <h1>{page.title}</h1>
              <p>
                Ответим в течение 15 минут в рабочее время. Технические вопросы
                по конкретной модели — по телефону, сразу с инженером.
              </p>
            </div>

            {/* Полный фирменный логотип — визитка компании */}
            <div className="contacts-brand">
              <picture>
                <source type="image/avif" srcSet="/images/brand/logo.avif" />
                <source type="image/webp" srcSet="/images/brand/logo.webp" />
                <img
                  src="/images/brand/logo.png"
                  alt="ДИЭН-Системс"
                  width={211}
                  height={305}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <div className="contacts-brand__text">
                <p className="contacts-brand__name">ООО «ДИЭН-Системс»</p>
                <p className="contacts-brand__note">
                  Собственный парк дизельных электростанций {settings.fleetMW} МВт.
                  Аренда, доставка, ТО и круглосуточная поддержка по Москве
                  и Московской области.
                </p>
              </div>
            </div>

            <div className="contacts-grid">
              <a className="contact-card" href={`tel:${settings.phoneRaw}`}>
                <span className="contact-card__icon"><IconPhone /></span>
                <span className="contact-card__label">Телефон</span>
                <span className="contact-card__value">{settings.phone}</span>
                <span className="contact-card__note">Звонок по России бесплатный</span>
              </a>

              <a className="contact-card" href={`mailto:${settings.email}`}>
                <span className="contact-card__icon"><IconMail /></span>
                <span className="contact-card__label">E-mail</span>
                <span className="contact-card__value">{settings.email}</span>
                <span className="contact-card__note">Отвечаем в течение часа</span>
              </a>

              <div className="contact-card">
                <span className="contact-card__icon"><IconPin /></span>
                <span className="contact-card__label">Адрес</span>
                <span className="contact-card__value">{settings.address}</span>
                <span className="contact-card__note">База и склад техники</span>
              </div>

              <div className="contact-card">
                <span className="contact-card__icon"><IconClock /></span>
                <span className="contact-card__label">Режим работы</span>
                <span className="contact-card__value">{settings.workingHours}</span>
                <span className="contact-card__note">
                  Приём заявок — круглосуточно, дежурный инженер на связи
                </span>
              </div>
            </div>

            {page.bodyHtml && (
              <div
                className="prose legacy-content"
                dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
              />
            )}
          </div>
        </section>

        <section className="section section--dark" id="lead">
          <div className="container lead">
            <div>
              <span className="head__eyebrow">Заявка</span>
              <h2>Рассчитаем стоимость за 10 минут</h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                Инженер уточнит нагрузку и режим работы и пришлёт коммерческое
                предложение с фиксированной ценой. В парке {departments.length} моделей
                дизельных генераторов — подберём ближайшую к вашей задаче.
              </p>
            </div>
            <LeadForm defaultTopic="Контакты" />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} />
    </>
  );
}
