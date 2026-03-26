/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.NEXT_BUILD_STANDALONE === "true" ? "standalone" : undefined,
};

module.exports = nextConfig;
