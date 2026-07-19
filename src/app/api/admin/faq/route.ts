import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { blocksToPlainText, normalizeFaqBlocks, stringifyFaqBlocks } from "@/lib/faq/content";

function redirectToFaq(request: Request, params: Record<string, string>) {
  const url = new URL("/admin/faq", getRequestBaseUrl(request));

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url, 303);
}

function getString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBlocks(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    return normalizeFaqBlocks(JSON.parse(value));
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  await requirePermission("content.manage");

  const formData = await request.formData();
  const action = getString(formData.get("_action"));
  const id = getString(formData.get("id"));

  try {
    if (action === "delete") {
      if (!id) throw new Error("FAQ не найден.");
      await db.faqItem.delete({ where: { id } });
      revalidatePath("/faq");
      revalidatePath("/admin/faq");
      return redirectToFaq(request, { deleted: "1" });
    }

    const title = getString(formData.get("title"));
    const category = getString(formData.get("category")) || "Общее";
    const sortOrder = Number.parseInt(getString(formData.get("sortOrder")), 10);
    const isPublished = formData.get("isPublished") === "true";
    const blocks = parseBlocks(formData.get("contentJson"));
    const answer = blocksToPlainText(blocks);

    if (title.length < 3) throw new Error("Вопрос должен быть не короче 3 символов.");
    if (!blocks.length || answer.length < 5) {
      throw new Error("Добавьте хотя бы один содержательный блок ответа.");
    }

    const contentJson = stringifyFaqBlocks(blocks);
    const data = {
      title,
      answer,
      contentJson,
      category,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isPublished,
    };

    if (action === "update") {
      if (!id) throw new Error("FAQ не найден.");

      await db.$transaction(async (tx) => {
        await tx.faqItem.update({ where: { id }, data });
        // Blocks fully replace legacy attachment rows; clear any leftovers.
        await tx.faqAttachment.deleteMany({ where: { faqItemId: id } });
      });

      revalidatePath("/faq");
      revalidatePath("/admin/faq");
      return redirectToFaq(request, { updated: "1" });
    }

    await db.faqItem.create({ data });

    revalidatePath("/faq");
    revalidatePath("/admin/faq");
    return redirectToFaq(request, { created: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить FAQ.";
    return redirectToFaq(request, { error: message });
  }
}
