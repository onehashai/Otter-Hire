const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "smartats.in",
    "localhost",
    "app.smartats.in",
    "jobs.smartats.in",
    "api.smartats.in",
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
  async rewrites() {
    // Proxy all /v1/* API calls through Next.js server → Docker internal backend.
    // This avoids Docker Desktop Mac's broken 127.0.0.1 port forwarding — the browser
    // calls /v1/... on the same origin (app.localhost.com:3000) and Next.js forwards
    // it to http://backend:8000 over the Docker network.
    const internalApiBase = (
      process.env.NEXT_INTERNAL_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://localhost:8000"
    ).replace(/\/$/, "");
    return [
      {
        source: "/v1/:path*",
        destination: `${internalApiBase}/v1/:path*`,
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
