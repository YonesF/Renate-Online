import type { NextConfig } from "next";

/**
 * Hvilke nettsider som får vise chatten i en iframe.
 * Legg til Shopify-testbutikken din her (eller i env-variabelen) når du tester der.
 */
const tillatteForeldre =
  process.env.ALLOWED_FRAME_ANCESTORS ??
  "'self' https://creativeart.no https://www.creativeart.no https://*.myshopify.com http://localhost:* https://localhost:*";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // Chatten (og hjelpesiden) kan vises i iframe på butikken – men ikke på hvilken som helst side.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${tillatteForeldre}` },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Kort cache, så endringer i embed.js når butikken raskt.
        source: "/embed.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
