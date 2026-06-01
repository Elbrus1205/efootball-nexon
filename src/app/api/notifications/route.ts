import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/session";
import { notifyExpiredProfileStatuses } from "@/lib/profile-statuses";
import { repairMojibake } from "@/lib/text-encoding";

export async function GET() {
  const session = await requireAuth();
  await notifyExpiredProfileStatuses({ userId: session.user.id });
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

  return NextResponse.json({
    notifications: notifications.map((notification) => ({
      ...notification,
      title: repairMojibake(notification.title),
      body: repairMojibake(notification.body),
    })),
    unreadCount,
  });
}
