const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@onehash/ui"],
  // Give static page generation extra time (default is 60s)
  staticPageGenerationTimeout: 120,
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      ...(config.resolve.modules || []),
    ];
    return config;
  },
};

module.exports = nextConfig;
