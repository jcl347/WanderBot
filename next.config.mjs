/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the config minimal and compatible with Next 15
  reactStrictMode: true,

  // Images we fetch from Wikimedia/Openverse (+ rails providers)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" }, // ok to keep
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "api.openverse.engineering" },
      { protocol: "https", hostname: "static.openverse.engineering" },
      { protocol: "https", hostname: "images.openverse.engineering" }, // <-- add this
    ],
  },

  // DO NOT enable optimizeCss unless you install 'critters'
  experimental: {
    optimizeCss: false,
  },

  // Silence outdated devIndicators options
  devIndicators: {
    position: "bottom-left",
  },

  headers: async () => [
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
  ],
};

export default nextConfig;
