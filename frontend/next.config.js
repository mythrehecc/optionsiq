/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Tell Next.js to compile these packages so CSS-in-JS works properly with webpack
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/cssinjs'],

  // Optimize antd barrel imports — reduces memory usage significantly
  experimental: {
    optimizePackageImports: ['antd', '@ant-design/icons'],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'production' 
          ? 'https://optionsiq.onrender.com/:path*'
          : 'http://localhost:5000/:path*',
      },
    ];
  },

  // Webpack config: externalize heavy packages from client bundle
  webpack(config, { isServer }) {
    // Suppress antd CSS-in-JS warnings
    config.ignoreWarnings = [
      { module: /node_modules\/@ant-design/ },
      { module: /node_modules\/antd/ },
    ];
    return config;
  },
};

module.exports = nextConfig;
