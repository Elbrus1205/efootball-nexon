import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "@/lib/affiliate";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { roleSchema } from "@/lib/validators";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  await requirePermission("users.changeLowerRoles");
  const formData = await request.formData();
  const body = roleSchema.parse({ role: formData.get("role") });
  const redirectUrl = new URL("/admin/users", getRequestBaseUrl(request));

  if (body.role === "FOUNDER") {
    redirectUrl.searchParams.set("error", "Роль основателя нельзя выдать вручную.");
    return NextResponse.redirect(redirectUrl);
  }

  const targetUser = await db.user.findUnique({
    where: { id: params.id },
    select: { role: true },
  });

  if (targetUser?.role === "FOUNDER") {
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
