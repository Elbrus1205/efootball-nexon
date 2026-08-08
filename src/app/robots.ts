import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/dashboard/",
        "/api/",
        "/login/",
        "/register/",
        "/forgot-password/",
        "/reset-password/",
        "/shop/orders/",
        "/shop/seller/",
        "/vk/callback/",
      ],
    },
    sitemap: "https://efootball-nexon.com/sitemap.xml",
    host: "https://efootball-nexon.com",
  };
}
