import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { rublesToKopecks } from "@/lib/coins-products";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

const serviceProductSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().min(5).max(3000),
  priceRubles: z.string().min(1),
  executorPercent: z.coerce.number().int().min(0).max(100),
  ownerPercent: z.coerce.number().int().min(0).max(100),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("coins.manage");

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const method = formData.get("_method");

  if (method === "delete") {
    if (formData.get("confirmDelete") !== "on") {
      redirectUrl.searchParams.set("error", "Подтвердите удаление услуги.");
      return NextResponse.redirect(redirectUrl, 303);
    }

    try {
      await db.coinServiceProduct.update({
        where: { id: params.id },
        data: { isActive: false },
      });
      redirectUrl.searchParams.set("serviceProductDeleted", "1");
    } catch {
      redirectUrl.searchParams.set("error", "Не удалось удалить услугу.");
    }

    return NextResponse.redirect(redirectUrl, 303);
  }

  if (method !== "update") {
    redirectUrl.searchParams.set("error", "Некорректное действие с услугой.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const parsed = serviceProductSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priceRubles: formData.get("priceRubles"),
    executorPercent: formData.get("executorPercent"),
    ownerPercent: formData.get("ownerPercent"),
    sortOrder: formData.get("sortOrder") ?? 0,
  });

  if (!parsed.success) {
    redirectUrl.searchParams.set("error", "Проверьте поля услуги.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  if (parsed.data.executorPercent + parsed.data.ownerPercent > 100) {
    redirectUrl.searchParams.set("error", "Проценты исполнителя и владельца услуги не должны быть больше 100% вместе.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const priceKopecks = rublesToKopecks(parsed.data.priceRubles);

  if (priceKopecks <= 0) {
    redirectUrl.searchParams.set("error", "Укажите корректную стоимость услуги.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await db.coinServiceProduct.update({
      where: { id: params.id },
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        priceKopecks,
        executorPercent: parsed.data.executorPercent,
        ownerPercent: parsed.data.ownerPercent,
        sortOrder: parsed.data.sortOrder,
      },
    });
    redirectUrl.searchParams.set("serviceProductUpdated", "1");
  } catch {
    redirectUrl.searchParams.set("error", "Не удалось обновить услугу.");
  }

  return NextResponse.redirect(redirectUrl, 303);
}

