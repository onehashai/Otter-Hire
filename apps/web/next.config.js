/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
  async redirects() {
    return [
      { source: "/talent-pool", destination: "/candidates", permanent: true },
      { source: "/talent-pool/:candidateId", destination: "/candidates/:candidateId", permanent: true },
    ];
  },
};

module.exports = nextConfig;
