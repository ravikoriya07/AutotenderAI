/** @type {import('next').NextConfig} */
const nextConfig = {
  /** Keep dev tools pill away from the fixed research chat input (bottom-left overlap). */
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
