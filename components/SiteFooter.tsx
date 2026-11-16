import Link from 'next/link';
import type { SiteSettings } from '@/lib/types';
import { IconClock, IconMail, IconPhone, IconPin } from './icons';
import BrandMark from './BrandMark';
import CookieSettingsLink from './CookieSettingsLink';
import FooterList from './FooterList';

/** Услуги — то, что сдаём в аренду */
const SERVICES = [
  { href: '/arendageneratorov', label: 'Дизельные генераторы' },
  { href: '/mobilnyegeneratory', label: 'Мобильные станции (ПЭС)' },
  { href: '/arendakompressorov', label: 'Компрессоры' },
  { href: '/kompressornasmeny', label: 'Компрессоры на смену' },
  { href: '/arendamanipulatora', label: 'Краны-манипуляторы' },
  { href: '/dopoborudovanie', label: 'Доп. оборудование' },
  { href: '/prodazhabu', label: 'Продажа б/у техники' },
];

/** Компания — разделы сайта о нас и документы */
const COMPANY = [
  { href: '/tsenyinaarendu', label: 'Прайс-лист' },
  { href: '/nashiobekty', label: 'Наши объекты' },
  { href: '/dostavka', label: 'Доставка' },
  { href: '/poleznoe', label: 'Полезные статьи' },
  { href: '/contacts', label: 'Контакты' },
  { href: '/#faq', label: 'Вопросы и ответы' },
];

export default function SiteFooter({ settings }: { settings: SiteSettings }) {
  return (
    <footer className="footer" id="contacts">
      <div className="container">
        <div className="footer__grid">
          <div>
            <div className="footer__logo">
              <span className="logo__mark">
                <BrandMark width={44} height={40} />
              </span>
              <span className="logo__text">
                <span className="logo__name">{settings.company}</span>
                <span className="logo__sub">Аренда ДГУ с {settings.foundedYear}</span>
              </span>
            </div>
            <p>
              Собственный парк дизельных электростанций AIRMAN, DENYO и Cummins на {settings.fleetMW} МВт.
              Аренда, доставка, ТО и круглосуточная поддержка по Москве и Московской области.
            </p>
          </div>

          <FooterList title="Услуги" items={SERVICES} />

          <FooterList title="Компания" items={COMPANY} />

          <div>
            <h4>Контакты</h4>
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
                <span>Приём заявок — {settings.workingHours}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © 2008–2026 genorg.ru · {settings.legalName}
          </span>
          <div className="footer__legal">
            <Link href="/politika-obrabotki-personalnyh-dannyh">
              Политика обработки персональных данных
            </Link>
            <CookieSettingsLink />
          </div>
        </div>
      </div>
    </footer>
  );
}
