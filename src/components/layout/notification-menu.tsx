"use client";

import { useEffect, useState } from "react";
import Pusher from "pusher-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationMenu({
  children,
  userId,
  unreadCount,
}: {
  children: React.ReactNode;
  userId: string;
  unreadCount: number;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let ignore = false;

    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) setItems(data.notifications ?? []);
      });

    if (process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      const channel = pusher.subscribe(`private-user-${userId}`);
      channel.bind("notification:new", (notification: NotificationItem) => {
        setItems((current) => [notification, ...current].slice(0, 8));
      });

      return () => {
        ignore = true;
        channel.unbind_all();
        pusher.unsubscribe(`private-user-${userId}`);
        pusher.disconnect();
      };
    }

    return () => {
      ignore = true;
    };
  }, [userId]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[340px]">
        <div className="mb-2 flex items-center justify-between px-3 py-2">
          <div>
            <div className="font-medium">Уведомления</div>
            <div className="text-xs text-zinc-500">Непрочитанных: {unreadCount}</div>
          </div>
        </div>
        <div className="space-y-2">
          {items.length ? (
            items.map((item) => (
              <div key={item.id} className={`rounded-2xl px-3 py-3 text-sm ${item.isRead ? "bg-transparent" : "bg-primary/10"}`}>
                <div className="font-medium text-white">{item.title}</div>
                <div className="mt-1 text-zinc-400">{item.body}</div>
              </div>
            ))
          ) : (
            <div className="px-3 py-8 text-center text-sm text-zinc-500">Пока уведомлений нет.</div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
