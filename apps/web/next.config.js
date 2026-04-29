const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost.com",
    "localhost",
    "app.localhost.com",
    "jobs.localhost.com",
    "api.localhost.com",
  ],
  transpilePackages: ["@onehash/ui"],
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveAlias: {
      "react-hook-form": "./apps/web/node_modules/react-hook-form",
    },
  },
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
  async redirects() {
    return [
      { source: "/talent-pool", destination: "/candidates", permanent: true },
      {
        source: "/talent-pool/:candidateId",
        destination: "/candidates/:candidateId",
        permanent: true,
      },
    ];
  },
  webpack(config) {
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };
    // Deduplicate react-hook-form across monorepo packages to avoid TS type conflicts
    config.resolve.alias = {
      ...config.resolve.alias,
      "react-hook-form": path.resolve(__dirname, "node_modules/react-hook-form"),
    };
    return config;
  },
};

module.exports = nextConfig;

// Injected content via Sentry wizard below

const { withSentryConfig } = require("@sentry/nextjs");

module.exports = withSentryConfig(module.exports, {
  org: process.env.SENTRY_ORG || "onehash-md",
  project: process.env.SENTRY_PROJECT || "ats-frontend",

  silent: !process.env.CI,

  widenClientFileUpload: true,

  tunnelRoute: "/monitoring",

  webpack: {
    automaticVercelMonitors: true,

    treeshake: {
      removeDebugLogging: true,
    },
  },
});
