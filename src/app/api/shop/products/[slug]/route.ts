import { NextResponse } from "next/server";
import { getShopProductBySlug } from "@/lib/shop/catalog";

export async function GET(_request: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const product = await getShopProductBySlug(slug);
  if (!product) return NextResponse.json({ error: "Товар не найден." }, { status: 404 });
  return NextResponse.json({ product });
}
