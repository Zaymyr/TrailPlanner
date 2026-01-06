let withMDX = (config) => config;
let mdxEnabled = false;

try {
  const { default: createMDX } = await import('@next/mdx');
  withMDX = createMDX({
    extension: /\.mdx?$/,
  });
  mdxEnabled = true;
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.warn('MDX support disabled because @next/mdx or @mdx-js/loader is missing.', reason);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  pageExtensions: ['ts', 'tsx', ...(mdxEnabled ? ['mdx'] : [])],
};

export default withMDX(nextConfig);
