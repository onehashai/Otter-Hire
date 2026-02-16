/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onehash/ui"],
  // Give static page generation extra time (default is 60s)
  staticPageGenerationTimeout: 120,
};

module.exports = nextConfig;
