import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { roleSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const body = roleSchema.parse({ role: formData.get("role") });

  await db.user.update({
    where: { id: params.id },
    data: { role: body.role },
  });

  return NextResponse.redirect(new URL("/admin/users", request.url));
}
