/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    const isDev = process.env.NODE_ENV === "development";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
    const temporalUrl = process.env.TEMPORAL_UI_BACKEND_URL || "http://localhost:8080";

    return [
      {
        source: "/api/:path*",
        destination: isDev ? `${backendUrl}/:path*` : "/api/:path*",
      },
      {
        source: "/public/:path*",
        destination: isDev ? `${backendUrl}/public/:path*` : "/api/public/:path*",
      },
      {
        source: "/temporal",
        destination: isDev ? `${temporalUrl}/temporal` : "/temporal",
      },
      {
        source: "/temporal/:path*",
        destination: isDev ? `${temporalUrl}/temporal/:path*` : "/temporal/:path*",
      },
    ];
  },
};

module.exports = nextConfig;