/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,

  async rewrites() {
    const temporalUrl =
      process.env.TEMPORAL_UI_BACKEND_URL || "http://localhost:8080";

    return [
      // Optional: keep ONLY if you use Temporal UI via frontend domain
      {
        source: "/temporal",
        destination: `${temporalUrl}/temporal`,
      },
      {
        source: "/temporal/:path*",
        destination: `${temporalUrl}/temporal/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;