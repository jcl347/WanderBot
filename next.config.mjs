/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow <Image/> to load from Wikimedia + Openverse + Unsplash
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "commons.wikimedia.org", pathname: "/**" },
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "api.openverse.engineering", pathname: "/**" },
      { protocol: "https", hostname: "static.openverse.engineering", pathname: "/**" },
      { protocol: "https", hostname: "images.openverse.engineering", pathname: "/**" }, // CDN
    ],
  },

  // Keep this off unless you add 'critters'
  experimental: {
    optimizeCss: false,
  },

  // Don’t fail Vercel builds on lint errors (you’ll still see them in logs)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Helpful cache headers for our serverless image proxy
  async headers() {
    return [
      {
        source: "/api/images",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // cover any nested path like /api/images/warmup or query variants
        source: "/api/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value:
              "public, max-age=60, s-maxage=600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
