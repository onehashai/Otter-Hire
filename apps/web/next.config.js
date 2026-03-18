/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const temporalBackendUrl = process.env.TEMPORAL_UI_BACKEND_URL || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/:path*`,
      },
      {
        source: "/public/:path*",
        destination: `${backendUrl}/public/:path*`,
      },
      {
        source: "/temporal",
        destination: `${temporalBackendUrl}/temporal`,
      },
      {
        source: "/temporal/:path*",
        destination: `${temporalBackendUrl}/temporal/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
