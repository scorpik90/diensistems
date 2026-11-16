/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // не отдавать X-Powered-By: Next.js

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [400, 640, 800, 1200, 1920],
    // Изображения уже перекодированы в AVIF/WebP на этапе сборки ассетов,
    // поэтому next/image отдаёт <picture> без ресайза на сервере.
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
        /*
         * Картинки из /public меняются при перегенерации фото
         * (миграция, обновление снимков). Долгий max-age оставил бы
         * у посетителей старые версии на месяц, поэтому кэшируем
         * коротко, но с ETag: браузер перезапрашивает файл, а сервер
         * отвечает 304, если он не изменился — трафик не растёт.
         */
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
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
