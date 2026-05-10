import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { FaqAttachmentKind, UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

type AttachmentInput = {
  title?: unknown;
  url?: unknown;
  kind?: unknown;
  mimeType?: unknown;
};

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

function parseAttachments(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) return [];

  try {
    const parsed = JSON.parse(value) as AttachmentInput[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((attachment, index) => {
        const title = typeof attachment.title === "string" ? attachment.title.trim() : "";
        const url = typeof attachment.url === "string" ? attachment.url.trim() : "";
        const rawKind = typeof attachment.kind === "string" ? attachment.kind : "";
        const kind = Object.values(FaqAttachmentKind).includes(rawKind as FaqAttachmentKind) ? (rawKind as FaqAttachmentKind) : FaqAttachmentKind.LINK;
        const mimeType = typeof attachment.mimeType === "string" ? attachment.mimeType.trim() : "";

        return url
          ? {
              title: title || url,
              url,
              kind,
              mimeType: mimeType || null,
              sortOrder: index,
            }
          : null;
      })
      .filter(Boolean) as Array<{ title: string; url: string; kind: FaqAttachmentKind; mimeType: string | null; sortOrder: number }>;
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER, UserRole.ORGANIZER]);

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
    const answer = getString(formData.get("answer"));
    const category = getString(formData.get("category")) || "Общее";
    const sortOrder = Number.parseInt(getString(formData.get("sortOrder")), 10);
    const isPublished = formData.get("isPublished") === "true";
    const attachments = parseAttachments(formData.get("attachmentsJson"));

    if (title.length < 3) throw new Error("Вопрос должен быть не короче 3 символов.");
    if (answer.length < 5) throw new Error("Ответ должен быть не короче 5 символов.");

    if (action === "update") {
      if (!id) throw new Error("FAQ не найден.");

      await db.$transaction(async (tx) => {
        await tx.faqItem.update({
          where: { id },
          data: {
            title,
            answer,
            category,
            sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
            isPublished,
          },
        });
        await tx.faqAttachment.deleteMany({ where: { faqItemId: id } });
        if (attachments.length) {
          await tx.faqAttachment.createMany({
            data: attachments.map((attachment) => ({ ...attachment, faqItemId: id })),
          });
        }
      });

      revalidatePath("/faq");
      revalidatePath("/admin/faq");
      return redirectToFaq(request, { updated: "1" });
    }

    await db.faqItem.create({
      data: {
        title,
        answer,
        category,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
        isPublished,
        attachments: attachments.length ? { createMany: { data: attachments } } : undefined,
      },
    });

    revalidatePath("/faq");
    revalidatePath("/admin/faq");
    return redirectToFaq(request, { created: "1" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить FAQ.";
    return redirectToFaq(request, { error: message });
  }
}
