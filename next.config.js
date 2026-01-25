/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable standalone output for Docker
  output: 'standalone',
  // Enable experimental features for SSE
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Transpile EUI packages to fix dynamic icon imports
  // This ensures Next.js properly bundles the dynamically loaded icon chunks
  transpilePackages: [
    '@elastic/eui',
    '@elastic/eui-theme-borealis',
  ],
  // Webpack configuration for EUI compatibility
  webpack: (config) => {
    // Handle EUI's dynamic imports for icons
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

module.exports = nextConfig;
