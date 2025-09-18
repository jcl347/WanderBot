/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // Disable the overlay “Next.js” dev indicators
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },

  eslint: {
    // Prevent ESLint warnings from failing production builds
    ignoreDuringBuilds: true,
  },

  typescript: {
    // Prevent type errors from blocking builds (optional, but useful if Zod is strict)
    ignoreBuildErrors: true,
  },

  images: {
    // Allow optimized <Image /> loading from Wikimedia Commons
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
        pathname: "/**",
      },
    ],
  },

  experimental: {
    // Optimize Tailwind/large CSS
    optimizeCss: true,
  },
};

export default nextConfig;
