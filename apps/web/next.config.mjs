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
