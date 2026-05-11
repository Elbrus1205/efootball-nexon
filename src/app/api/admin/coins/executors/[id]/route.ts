import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requirePermission("coins.manage");

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const method = String(formData.get("_method") ?? "");

  if (method !== "delete") {
    redirectUrl.searchParams.set("error", "Некорректное действие с исполнителем.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const confirmDelete = formData.get("confirmDelete") === "on";
  if (!confirmDelete) {
    redirectUrl.searchParams.set("error", "Подтвердите удаление исполнителя.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinServiceExecutor.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  redirectUrl.searchParams.set("executorDeleted", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
