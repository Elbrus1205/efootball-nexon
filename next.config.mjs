/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
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
