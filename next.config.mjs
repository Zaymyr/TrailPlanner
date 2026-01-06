import createMDX from '@next/mdx';

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
  },
  pageExtensions: ['ts', 'tsx', 'mdx'],
};

export default withMDX(nextConfig);
