import Link from 'next/link';
import type { Content, Tokens } from '@/lib/content';
import { render } from '@/lib/content';
import type { SiteSettings } from '@/lib/types';
import { IconClock, IconMail, IconPhone, IconPin } from './icons';
import BrandMark from './BrandMark';
import CookieSettingsLink from './CookieSettingsLink';
import FooterList from './FooterList';

export default function SiteFooter({
  settings,
  content,
  tokens,
}: {
  settings: SiteSettings;
  content: Content;
  tokens: Tokens;
}) {
  const services = content.menu('footer-services');
  const company = content.menu('footer-company');
  const f = content.o('footer.main', tokens);

  /* Тексты подвала могут лежать и в настройках сайта — тогда они
     приходят шаблоном ({fleetMW}, {legalName}) и требуют подстановки. */
  const about = settings.footerAbout ? render(settings.footerAbout, tokens) : (f.about as string);
  const bottom = settings.footerBottom ? render(settings.footerBottom, tokens) : (f.bottom as string);
  const contactsTitle = settings.footerContactsTitle || f.contactsTitle || 'Контакты';
  const policyUrl = settings.legalPolicyUrl || '/politika-obrabotki-personalnyh-dannyh';

  return (
    <footer className="footer" id="contacts">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__logo">
              <span className="logo__mark">
                <BrandMark image={settings.logoMark} width={44} height={40} />
              </span>
              <span className="logo__text">
                <span className="logo__name">{settings.company}</span>
                <span className="logo__sub">{f.logoSub}</span>
              </span>
            </div>
            {about && <p>{about}</p>}
          </div>

          <FooterList title={f.servicesTitle || 'Услуги'} items={services} />

          <FooterList title={f.companyTitle || 'Компания'} items={company} />

          <div>
            <h4>{contactsTitle}</h4>
            <div className="footer__contacts">
              <div className="footer__contact">
                <IconPhone />
                <a href={`tel:${settings.phoneRaw}`}>{settings.phone}</a>
              </div>
              <div className="footer__contact">
                <IconMail />
                <a href={`mailto:${settings.email}`}>{settings.email}</a>
              </div>
              <div className="footer__contact">
                <IconPin />
                <span>{settings.address}</span>
              </div>
              <div className="footer__contact">
                <IconClock />
                <span>{f.hoursText}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>{bottom}</span>
          <div className="footer__legal">
            <Link href={policyUrl}>{f.policyLabel}</Link>
            <CookieSettingsLink label={content.s('cookie.main', 'settingsLabel', tokens)} />
          </div>
        </div>
      </div>
    </footer>
  );
}
