/**
 * Инлайновый SVG-набор вместо Font Awesome.
 * Один компонент — ноль сетевых запросов, ноль FOUT, весит ~4 КБ.
 * Иконки продублированы из исходников Font Awesome 4 (лицензия SIL OFL 1.1).
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconBolt = (p: P) => (
  <svg {...base} {...p}><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z" /></svg>
);

export const IconPhone = (p: P) => (
  <svg {...base} {...p}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

export const IconTruck = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7h11v8H3z" /><path d="M14 10h4l3 3v2h-7z" />
    <circle cx="7" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" />
  </svg>
);

export const IconShield = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
  </svg>
);

export const IconClock = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);

export const IconPulse = (p: P) => (
  <svg {...base} {...p}><path d="M2 12h4l3-8 4 16 3-8h6" /></svg>
);

export const IconDoc = (p: P) => (
  <svg {...base} {...p}><path d="M4 4h16v16H4z" /><path d="M4 8h16M8 4v16" /></svg>
);

export const IconCheck = (p: P) => (
  <svg {...base} {...p}><path d="m5 13 4 4L19 7" /></svg>
);

export const IconCross = (p: P) => (
  <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
);

export const IconArrow = (p: P) => (
  <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

export const IconMenu = (p: P) => (
  <svg {...base} {...p}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
);

export const IconClose = (p: P) => (
  <svg {...base} {...p}><path d="M18 6 6 18M6 6l12 12" /></svg>
);

export const IconPlus = (p: P) => (
  <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>
);

export const IconMail = (p: P) => (
  <svg {...base} {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></svg>
);

export const IconPin = (p: P) => (
  <svg {...base} {...p}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

export const IconStar = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="m12 17.3-6.2 3.7 1.7-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.5 4.8 1.7 7z" />
  </svg>
);

export const IconTarget = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 12h.01" /></svg>
);

export const IconSpark = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
);
