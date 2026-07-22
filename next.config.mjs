/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    // Client-side router cache: re-opening a tab within this window reuses the
    // already-fetched RSC payload instead of hitting the server again, so
    // switching between tournament tabs is instant. `dynamic` covers our
    // dynamically-rendered tournament page (?tab=... navigations).
    staleTimes: {
      dynamic: 60,
      static: 180,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/render/image/**" },
      { protocol: "https", hostname: "*.supabase.in", pathname: "/storage/v1/object/**" },
      { protocol: "https", hostname: "*.supabase.in", pathname: "/storage/v1/render/image/**" },
    ],
  },
};

export default nextConfig;
