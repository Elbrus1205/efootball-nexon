import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const formData = await request.formData();
  const redirectUrl = new URL("/admin/coins", getRequestBaseUrl(request));
  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    redirectUrl.searchParams.set("error", "Выберите пользователя для исполнителя.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  const user = await db.user.findFirst({
    where: {
      id: userId,
      isBanned: false,
    },
    select: { id: true },
  });

  if (!user) {
    redirectUrl.searchParams.set("error", "Пользователь не найден.");
    return NextResponse.redirect(redirectUrl, 303);
  }

  await db.coinServiceExecutor.upsert({
    where: { userId },
    update: { isActive: true },
    create: { userId },
  });

  redirectUrl.searchParams.set("executorCreated", "1");
  return NextResponse.redirect(redirectUrl, 303);
}
