import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";

export async function GET() {
  const session = await requireAuth();
  const [notifications, unreadCount] = await db.$transaction([
    db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    db.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}
