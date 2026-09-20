import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { FAQ_CATEGORY_ORDER_KEY, faqCategoryOrderSchema, faqCategoryChangesSchema, getFaqCategoryRenameError, matchesFaqCategories } from "@/lib/faq/category-order";

export async function POST(request: Request) {
  await requirePermission("content.manage");
  const input: unknown = await request.json().catch(() => null);
  const legacy = faqCategoryOrderSchema.safeParse(input);
  const parsed = faqCategoryChangesSchema.safeParse(legacy.success ? legacy.data.map((name) => ({ originalName: name, name })) : input);
  if (!parsed.success) return NextResponse.json({ error: "Передайте список разделов без повторений." }, { status: 400 });
  const renameError = getFaqCategoryRenameError(parsed.data);
  if (renameError) return NextResponse.json({ error: renameError }, { status: 400 });

  try {
    const saved = await db.$transaction(async (tx) => {
      const current = await tx.faqItem.findMany({ select: { category: true }, distinct: ["category"] });
      if (!matchesFaqCategories(parsed.data.map((row) => row.originalName), current.map((row) => row.category))) return false;
      for (const row of parsed.data) {
        if (row.name !== row.originalName) await tx.faqItem.updateMany({ where: { category: row.originalName }, data: { category: row.name } });
      }
      const body = JSON.stringify(parsed.data.map((row) => row.name));
      await tx.siteContent.upsert({
        where: { key: FAQ_CATEGORY_ORDER_KEY },
        create: { key: FAQ_CATEGORY_ORDER_KEY, body }, update: { body },
      });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!saved) return NextResponse.json({ error: "Список разделов изменился. Обновите страницу и задайте порядок заново." }, { status: 409 });
    revalidatePath("/faq");
    revalidatePath("/admin/faq");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to save FAQ categories", error);
    return NextResponse.json({ error: "Не удалось сохранить разделы. Повторите попытку." }, { status: 500 });
  }
}
