/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // the arbitrage page reads the committed Fantrax snapshot from disk at runtime
    outputFileTracingIncludes: {
      "/arbitrage/[[...team]]": ["./data/fantrax/**/*"],
    },
  },
};

export default nextConfig;
