import Link from 'next/link';
import { getCMS } from '@/lib/cms';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import LeadForm from '@/components/LeadForm';
import { IconClock, IconMail, IconPhone, IconPin } from '@/components/icons';
import CmsImage from '@/components/CmsImage';
import { sanitizeHtml } from '@/lib/sanitize';
import type { Content } from '@/lib/content';
import { baseTokens } from '@/lib/tokens';
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
  content,
}: {
  page: StaticPage;
  settings: SiteSettings;
  content: Content;
}) {
  const departments = await getCMS().getEquipmentByCategory('generator');

  const tokens = { ...baseTokens(settings), count: departments.length };
  const c = content.o('contacts.main', tokens);
  const crumbHome = content.s('global.breadcrumbHome', 'text', tokens) || 'Главная';

  return (
    <>
      <SiteHeader settings={settings} content={content} tokens={tokens} active="/contacts" />

      <main id="main">
        <section className="section section--tight">
          <div className="container">
            <nav aria-label="Хлебные крошки">
              <ul className="crumbs">
                <li><Link href="/">{crumbHome}</Link></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page">{page.title}</li>
              </ul>
            </nav>

            <div className="head">
              <span className="head__eyebrow">{c.eyebrow as string}</span>
              <h1>{page.title}</h1>
              <p>{c.lead as string}</p>
            </div>

            {/* Полный фирменный логотип — визитка компании */}
            <div className="contacts-brand">
              {settings.logo && (
                <CmsImage
                  image={settings.logo}
                  alt={(c.logoAlt as string) || settings.company}
                  width={211}
                  height={305}
                />
              )}
              <div className="contacts-brand__text">
                <p className="contacts-brand__name">{settings.legalName}</p>
                <p className="contacts-brand__note">{c.about as string}</p>
              </div>
            </div>

            <div className="contacts-grid">
              <a className="contact-card" href={`tel:${settings.phoneRaw}`}>
                <span className="contact-card__icon"><IconPhone /></span>
                <span className="contact-card__label">{c.labelPhone as string}</span>
                <span className="contact-card__value">{settings.phone}</span>
                <span className="contact-card__note">{c.notePhone as string}</span>
              </a>

              <a className="contact-card" href={`mailto:${settings.email}`}>
                <span className="contact-card__icon"><IconMail /></span>
                <span className="contact-card__label">{c.labelEmail as string}</span>
                <span className="contact-card__value">{settings.email}</span>
                <span className="contact-card__note">{c.noteEmail as string}</span>
              </a>

              <div className="contact-card">
                <span className="contact-card__icon"><IconPin /></span>
                <span className="contact-card__label">{c.labelAddress as string}</span>
                <span className="contact-card__value">{settings.address}</span>
                <span className="contact-card__note">{c.noteAddress as string}</span>
              </div>

              <div className="contact-card">
                <span className="contact-card__icon"><IconClock /></span>
                <span className="contact-card__label">{c.labelHours as string}</span>
                <span className="contact-card__value">{settings.workingHours}</span>
                <span className="contact-card__note">{c.noteHours as string}</span>
              </div>
            </div>

            {page.bodyHtml && (
              <div
                className="prose legacy-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.bodyHtml) }}
              />
            )}
          </div>
        </section>

        <section className="section section--dark" id="lead">
          <div className="container lead">
            <div>
              <span className="head__eyebrow">{c.eyebrowLead as string}</span>
              <h2>{c.h2Lead as string}</h2>
              <p style={{ color: '#94a3b8', fontSize: '1.0625rem', maxWidth: '52ch' }}>
                {c.leadText as string}
              </p>
            </div>
            <LeadForm
              defaultTopic={c.defaultTopic as string}
              labels={content.o('form.main', tokens)}
              phone={settings.phone}
              policyUrl={settings.legalPolicyUrl}
            />
          </div>
        </section>
      </main>

      <SiteFooter settings={settings} content={content} tokens={tokens} />
    </>
  );
}
