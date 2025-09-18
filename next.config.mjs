/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep the config lean & Next 15 compatible
  eslint: {
    // Build won’t fail on ESLint warnings from your components
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Keep strict if you want; this just prevents build from failing on TS in CI
    ignoreBuildErrors: false,
  },

  // DO NOT use deprecated devIndicators options or swcMinify (removed in Next 15)
  // devIndicators: false,            // ❌ remove
  // swcMinify: true,                 // ❌ remove

  // If you **don’t** want to add `critters` to package.json, keep this disabled:
  experimental: {
    optimizeCss: false, // ✅ avoids "Cannot find module 'critters'"
  },

  // Allow optimized <Image/> from Wikimedia & Commons (your image API uses these)
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // Full-size & thumbs live here
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
      // (optional) if any other CDNs are used by your image fetcher, add them here
    ],
  },

  // Small cache bump for your API routes (tweak as needed)
  headers: async () => [
    {
      source: "/api/:path*",
      headers: [
        { key: "Cache-Control", value: "no-store" },
      ],
    },
  ],
};

export default nextConfig;
