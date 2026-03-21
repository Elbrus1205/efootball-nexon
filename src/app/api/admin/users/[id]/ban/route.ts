import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { banSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const body = banSchema.parse({ isBanned: formData.get("isBanned") === "true" });

  await db.user.update({
    where: { id: params.id },
    data: { isBanned: body.isBanned },
  });

  return NextResponse.redirect(new URL("/admin/users", process.env.NEXTAUTH_URL));
}
