import { AdminActionType, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await requireRole([UserRole.ADMIN]);
  const formData = await request.formData();
  const confirmed = formData.get("confirmDelete") === "true";

  if (!confirmed) {
    return NextResponse.redirect(new URL("/admin/users", request.url));
  }

  if (params.id === session.user.id) {
    return NextResponse.json({ error: "Нельзя удалить свой аккаунт из админ-панели." }, { status: 400 });
  }

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      nickname: true,
      telegramUsername: true,
      role: true,
      isBanned: true,
      banReason: true,
      bannedUntil: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.redirect(new URL("/admin/users", request.url));
  }

  await db.$transaction(async (tx) => {
    await tx.adminAction.create({
      data: {
        adminId: session.user.id,
        entityType: "USER",
        entityId: user.id,
        actionType: AdminActionType.DELETE,
        beforeJson: user,
      },
    });

    await tx.user.delete({
      where: { id: user.id },
    });
  });

  return NextResponse.redirect(new URL("/admin/users", request.url));
}
