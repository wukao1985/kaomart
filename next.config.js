/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.shopify.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "kaomart-2.myshopify.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
