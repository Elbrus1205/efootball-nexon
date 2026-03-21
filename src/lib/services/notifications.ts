import Pusher from "pusher";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";

const pusher =
  process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET && process.env.PUSHER_CLUSTER
    ? new Pusher({
        appId: process.env.PUSHER_APP_ID,
        key: process.env.PUSHER_KEY,
        secret: process.env.PUSHER_SECRET,
        cluster: process.env.PUSHER_CLUSTER,
        useTLS: true,
      })
    : null;

export async function createNotification({
  userId,
  title,
  body,
  type,
  link,
}: {
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  link?: string;
}) {
  const notification = await db.notification.create({
    data: { userId, title, body, type, link },
  });

  if (pusher) {
    await pusher.trigger(`private-user-${userId}`, "notification:new", notification);
  }

  return notification;
}
