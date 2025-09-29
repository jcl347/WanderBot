/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizeCss: true,
  },
  images: {
    // Allow Wikimedia thumbnails/full-size
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "commons.wikimedia.org" },
      // (Occasionally thumb proxies live on *.wikimedia.org)
      { protocol: "https", hostname: "*.wikimedia.org" },
    ],
  },
  devIndicators: {
    position: "bottom-left",
  },
  transpilePackages: [],
  // “critters” module error during 404 prerender often happens when
  // a custom _document tries to inline CSS. Ensure no custom _document uses it,
  // otherwise let Next handle CSS inlining.
};

export default nextConfig;
