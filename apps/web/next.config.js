/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
  async rewrites() {
    const apiUrl = process.env.API_INTERNAL_URL || "http://localhost:8000";
    const temporalUiUrl = process.env.TEMPORAL_UI_INTERNAL_URL || "http://localhost:8080";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
      {
        source: "/public/:path*",
        destination: `${apiUrl}/public/:path*`,
      },
      {
        source: "/temporal-dashboard",
        destination: `${temporalUiUrl}/temporal-dashboard`,
      },
      {
        source: "/temporal-dashboard/:path*",
        destination: `${temporalUiUrl}/temporal-dashboard/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
