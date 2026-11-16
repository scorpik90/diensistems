/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // не отдавать X-Powered-By: Next.js

  images: {
    // Фотографии лежат в медиатеке Strapi и отдаются обычными <img>
    // с srcset: браузер сам выбирает размер из набора, который создаёт
    // CMS при загрузке. Оптимизатор Next.js здесь не используется.
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [400, 640, 800, 1200, 1920],
    unoptimized: true,
  },

  /**
   * Редиректы дублей legacy-URL.
   *
   * Боевой PHP-роутер отдавал 200 по двум адресам одной статьи:
   *   /<статья>            (канонический)
   *   /poleznoe/<статья>   (дубль)
   * Дубль уводим 301 на канонический адрес — иначе Яндекс увидит
   * две страницы с одинаковым контентом.
   */
  async redirects() {
    return [
      {
        source: '/poleznoe/:slug',
        destination: '/:slug',
        permanent: true,
      },
    ];
  },

  // Заголовки безопасности и кеширования
  async headers() {    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ];
  },
};

export default nextConfig;
