import type { MetadataRoute } from "next";

const baseUrl = "https://efootball-nexon.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "/",
    "/tournaments",
    "/players",
    "/ratings",
    "/divisions",
    "/faq",
    "/regulations",
    "/contacts",
    "/shop",
    "/terms",
    "/privacy",
    "/cookies",
    "/consent",
  ];

  return routes.map((path) => ({
    url: `${baseUrl}${path}`,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
