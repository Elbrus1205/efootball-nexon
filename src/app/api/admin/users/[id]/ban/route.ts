import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { banSchema } from "@/lib/validators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const body = banSchema.parse({
    action: formData.get("action"),
    reason: formData.get("reason"),
    bannedUntil: formData.get("bannedUntil"),
  });

  const data =
    body.action === "unban"
      ? {
          isBanned: false,
          banReason: null,
          bannedUntil: null,
          bannedAt: null,
        }
      : body.action === "permanent"
        ? {
            isBanned: true,
            banReason: body.reason?.trim() || null,
            bannedUntil: null,
            bannedAt: new Date(),
          }
        : {
            isBanned: false,
            banReason: body.reason?.trim() || null,
            bannedUntil: new Date(body.bannedUntil ?? ""),
            bannedAt: new Date(),
          };

  await db.user.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.redirect(new URL("/admin/users", request.url));
}
