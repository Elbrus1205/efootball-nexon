import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));

  if (formData.get("_method") !== "delete" || formData.get("confirmDelete") !== "on") {
    redirectUrl.searchParams.set("error", "Подтвердите удаление партнёрской программы.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  try {
    await db.affiliatePartner.delete({ where: { id: params.id } });
    redirectUrl.searchParams.set("deleted", "1");
  } catch {
    redirectUrl.searchParams.set("error", "Не удалось удалить партнёрскую программу.");
  }

  return NextResponse.redirect(redirectUrl, 303);
}
