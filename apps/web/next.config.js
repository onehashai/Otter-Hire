/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onehash/ui"],
  staticPageGenerationTimeout: 120,
  experimental: {
    optimizePackageImports: ["@onehash/ui"],
  },
};

module.exports = nextConfig;
