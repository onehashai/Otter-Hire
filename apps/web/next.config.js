/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // Suppress webpack cache warnings about missing optional SWC native binaries
    // for platforms other than the one currently running (e.g. linux-arm64-musl
    // warnings when running on macOS darwin, or vice versa).
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: "error",
    };
    return config;
  },
};

module.exports = nextConfig;
