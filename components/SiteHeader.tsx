import Link from 'next/link';
import type { Content, Tokens } from '@/lib/content';
import type { MenuItem, SiteSettings } from '@/lib/types';
import { IconPhone, IconShield, IconTarget, IconTruck } from './icons';
import BrandMark from './BrandMark';
import MegaMenu from './MegaMenu';
import MobileMenu from './MobileMenu';

export default function SiteHeader({
  settings,
  content,
  tokens,
  active,
}: {
  settings: SiteSettings;
  content: Content;
  tokens: Tokens;
  active?: string;
}) {
  const nav: MenuItem[] = content.menu('header');
  const tech: MenuItem[] = content.menu('tech');

  const topbar = content.o('header.topbar', tokens);
  const main = content.o('header.main', tokens);
  const mobile = content.o('header.mobile', tokens);

  return (
    <>
      <div className="topbar">
        <div className="container topbar__inner">
          <ul className="topbar__list">
            <li className="topbar__item">
              <IconTruck />
              {topbar.deliveryText}
            </li>
            <li className="topbar__item">
              <IconShield />
              {topbar.fleetText}
            </li>
            <li className="topbar__item">
              <IconTarget />
              {topbar.targetText}
            </li>
          </ul>
          <div className="topbar__right">
            <span className="topbar__hours">
              <span className="topbar__dot" />
              {topbar.hoursText}
            </span>
            <a href={`mailto:${settings.email}`}>{settings.email}</a>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="container header__inner">
          <Link className="logo" href="/">
            <span className="logo__mark">
              <BrandMark image={settings.logoMark} width={48} height={44} />
            </span>
            <span className="logo__text">
              <span className="logo__name">{settings.company}</span>
              <span className="logo__sub">{main.logoSub}</span>
            </span>
            <span className="sr-only">{main.logoAria}</span>
          </Link>

          <nav className="nav" aria-label={main.navAria}>
            {nav.map((n, i) =>
              /* Первый пункт раскрывает список остальной техники */
              i === 0 ? (
                <MegaMenu
                  key={n.href}
                  label={n.label}
                  href={n.href}
                  items={tech}
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
              aria-label={main.phoneAria}
            >
              <IconPhone />
            </a>
            <span className="header__phone-text">
              <a className="header__phone-num" href={`tel:${settings.phoneRaw}`}>
                {settings.phone}
              </a>
              <span className="header__phone-note">{main.phoneNote}</span>
            </span>
          </div>

          <div className="header__cta">
            <Link className="btn btn--sm" href="/#lead">
              {main.cta}
            </Link>
          </div>

          <MobileMenu
            nav={nav}
            tech={tech}
            phone={settings.phone}
            phoneRaw={settings.phoneRaw}
            labels={mobile}
          />
        </div>
      </header>
    </>
  );
}
