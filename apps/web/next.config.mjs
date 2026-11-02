const loadMdxPlugin = async () => {
  try {
    // Ensure both packages are available before enabling MDX.
    await import('@mdx-js/loader');
    const { default: createMDX } = await import('@next/mdx');

    return {
      mdxEnabled: true,
      withMDX: createMDX({
        extension: /\.mdx?$/,
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn('MDX support disabled because @next/mdx or @mdx-js/loader is missing.', reason);
    return {
      mdxEnabled: false,
      withMDX: (config) => config,
    };
  }
};

const browserSecurityHeaders = [
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://*.supabase.co https://res.cloudinary.com https://*.posthog.com",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.posthog.com https://js.stripe.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://www.google-analytics.com https://region1.google-analytics.com https://api.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "form-action 'self' https://checkout.stripe.com",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self "https://js.stripe.com")' },
];

/** @type {() => Promise<import('next').NextConfig>} */
const createConfig = async () => {
  const { mdxEnabled, withMDX } = await loadMdxPlugin();

  /** @type {import('next').NextConfig} */
  const nextConfig = {
    experimental: {
      typedRoutes: true,
    },
    eslint: {
      ignoreDuringBuilds: true,
    },
    transpilePackages: ['@trailplanner/shared', '@pace-yourself/design-system'],
    pageExtensions: ['ts', 'tsx', ...(mdxEnabled ? ['mdx'] : [])],
    async headers() {
      return [
        {
          source: '/:path*',
          headers: browserSecurityHeaders,
        },
        {
          source: '/en/:path*',
          headers: [{ key: 'Content-Language', value: 'en' }],
        },
      ];
    },
    webpack(config) {
      const fileLoaderRule = config.module.rules.find((rule) => rule.test?.test?.('.svg'));

      if (fileLoaderRule) {
        config.module.rules.push(
          {
            ...fileLoaderRule,
            test: /\.svg$/i,
            resourceQuery: /url/,
          },
          {
            test: /\.svg$/i,
            issuer: fileLoaderRule.issuer,
            resourceQuery: { not: [...(fileLoaderRule.resourceQuery?.not ?? []), /url/] },
            use: ['@svgr/webpack'],
          },
        );

        fileLoaderRule.exclude = /\.svg$/i;
      }

      return config;
    },
  };

  return withMDX(nextConfig);
};

export default createConfig;
