/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Keep dev tools pill away from the fixed research chat input (bottom-left overlap). */
  devIndicators: {
    position: "bottom-right",
  },
  async redirects() {
    return [
      {
        source: "/inventory-management",
        destination: "/inquiry-management",
        permanent: true,
      },
      {
        source: "/inventory-management/:path*",
        destination: "/inquiry-management/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
