import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { roleSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.FOUNDER]);
  const formData = await request.formData();
  const body = roleSchema.parse({ role: formData.get("role") });
  const redirectUrl = new URL("/admin/users", getRequestBaseUrl(request));

  if (body.role === UserRole.FOUNDER) {
    redirectUrl.searchParams.set("error", "Роль основателя нельзя выдать вручную.");
    return NextResponse.redirect(redirectUrl);
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: { role: true },
  });

  if (targetUser?.role === UserRole.FOUNDER) {
    redirectUrl.searchParams.set("error", "Роль основателя нельзя изменить.");
    return NextResponse.redirect(redirectUrl);
  }

  await db.user.update({
    where: { id: params.id },
    data: { role: body.role },
  });

  redirectUrl.searchParams.set("updated", "Роль пользователя обновлена.");
  return NextResponse.redirect(redirectUrl);
}
