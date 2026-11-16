import Link from 'next/link';
import type { SiteSettings } from '@/lib/types';
import { IconPhone, IconShield, IconTarget, IconTruck } from './icons';
import BrandMark from './BrandMark';
import MegaMenu from './MegaMenu';
import MobileMenu from './MobileMenu';

/** Пункты верхнего меню */
const NAV = [
  { href: '/arendageneratorov', label: 'Генераторы' },
  { href: '/tsenyinaarendu', label: 'Цены' },
  { href: '/nashiobekty', label: 'Объекты' },
  { href: '/poleznoe', label: 'Полезное' },
  { href: '/contacts', label: 'Контакты' },
];

/**
 * Остальная техника и услуги — выпадающий список у пункта «Генераторы».
 *
 * На боевом сайте это был один длинный список из 12 пунктов в шапке;
 * здесь верхнее меню короткое, а полный список техники раскрывается
 * по наведению — так он не перегружает шапку и остаётся под рукой.
 */
const TECH_MENU = [
  { href: '/mobilnyegeneratory', label: 'Мобильные станции (ПЭС)', note: 'Передвижные электростанции 8–400 кВт' },
  { href: '/arendakompressorov', label: 'Компрессоры', note: 'Винтовые, 5–17 м³/мин' },
  { href: '/kompressornasmeny', label: 'Компрессоры на смену', note: 'Посменная аренда под молоток и бетонолом' },
  { href: '/arendamanipulatora', label: 'Краны-манипуляторы', note: '3–9 тонн, с оператором' },
  { href: '/dopoborudovanie', label: 'Доп. оборудование', note: 'Шумозащитное ограждение' },
  { href: '/dostavka', label: 'Доставка', note: 'Своими манипуляторами от 7 000 ₽' },
  { href: '/prodazhatopliva', label: 'Топливо', note: 'Дизельное топливо в аренду' },
];

export default function SiteHeader({
  settings,
  active,
}: {
  settings: SiteSettings;
  active?: string;
}) {
  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <ul className="topbar__list">
            <li className="topbar__item">
              <IconTruck />
              Доставка на объект от {settings.deliveryHours} часов
            </li>
            <li className="topbar__item">
              <IconShield />
              Собственный парк {settings.fleetMW} МВт
            </li>
            <li className="topbar__item">
              <IconTarget />
              AIRMAN · DENYO · Cummins
            </li>
          </ul>
          <div className="topbar__right">
            <span className="topbar__hours">
              <span className="topbar__dot" />
              Приём заявок 24/7
            </span>
            <a href={`mailto:${settings.email}`}>{settings.email}</a>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="container header__inner">
          <Link className="logo" href="/">
            <span className="logo__mark">
              <BrandMark width={48} height={44} />
            </span>
            <span className="logo__text">
              <span className="logo__name">{settings.company}</span>
              <span className="logo__sub">Аренда ДГУ с {settings.foundedYear}</span>
            </span>
            <span className="sr-only">— на главную</span>
          </Link>

          <nav className="nav" aria-label="Основная навигация">
            {NAV.map((n, i) =>
              /* Первый пункт раскрывает список остальной техники */
              i === 0 ? (
                <MegaMenu
                  key={n.href}
                  label={n.label}
                  href={n.href}
                  items={TECH_MENU}
                  active={active}
                />
              ) : (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`nav__link${active === n.href ? ' nav__link--active' : ''}`}
                >
                  {n.label}
                </Link>
              )
            )}
          </nav>

          <div className="header__spacer" />

          <div className="header__phone">
            {/* Иконка — тоже ссылка на звонок */}
            <a
              className="header__phone-ico"
              href={`tel:${settings.phoneRaw}`}
              aria-label={`Позвонить ${settings.phone}`}
            >
              <IconPhone />
            </a>
            <span className="header__phone-text">
              <a className="header__phone-num" href={`tel:${settings.phoneRaw}`}>
                {settings.phone}
              </a>
              <span className="header__phone-note">Звонок по России бесплатный</span>
            </span>
          </div>

          <div className="header__cta">
            <Link className="btn btn--sm" href="/#lead">
              Заказать
            </Link>
          </div>

          <MobileMenu
            nav={NAV}
            tech={TECH_MENU}
            phone={settings.phone}
            phoneRaw={settings.phoneRaw}
          />
        </div>
      </header>
    </>
  );
}
