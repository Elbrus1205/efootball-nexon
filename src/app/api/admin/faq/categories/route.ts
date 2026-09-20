import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FAQ_CATEGORY_ORDER_KEY, faqCategoryOrderSchema, matchesFaqCategories } from "@/lib/faq/category-order";

export async function POST(request: Request) {
  await requirePermission("content.manage");
  const input: unknown = await request.json().catch(() => null);
  const parsed = faqCategoryOrderSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Передайте список разделов без повторений." }, { status: 400 });

  try {
    const saved = await db.$transaction(async (tx) => {
      const current = await tx.faqItem.findMany({ select: { category: true }, distinct: ["category"] });
      if (!matchesFaqCategories(parsed.data, current.map((row) => row.category))) return false;
      const body = JSON.stringify(parsed.data);
      await tx.siteContent.upsert({
        where: { key: FAQ_CATEGORY_ORDER_KEY },
        create: { key: FAQ_CATEGORY_ORDER_KEY, body }, update: { body },
      });
      return true;
    });
    if (!saved) return NextResponse.json({ error: "Список разделов изменился. Обновите страницу и задайте порядок заново." }, { status: 409 });
    revalidatePath("/faq");
    revalidatePath("/admin/faq");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save FAQ category order", error);
    return NextResponse.json({ error: "Не удалось сохранить порядок разделов. Повторите попытку." }, { status: 500 });
  }
}
