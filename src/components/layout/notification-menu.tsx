"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Pusher from "pusher-js";
import { Bell, CalendarCheck2, CheckCheck, ExternalLink, Loader2, ShieldCheck, Sparkles, Swords, Trophy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type NotificationItem = {
  id: string;
  type?: "TOURNAMENT" | "MATCH" | "RESULT" | "SYSTEM";
  title: string;
  body: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
};

const notificationStyles = {
  TOURNAMENT: {
    icon: Trophy,
    label: "Турнир",
    accent: "text-accent",
    shell: "border-accent/25 bg-accent/10 hover:bg-accent/15",
    iconBox: "border-accent/25 bg-accent/15 text-accent",
  },
  MATCH: {
    icon: Swords,
    label: "Матч",
    accent: "text-primary",
    shell: "border-primary/25 bg-primary/10 hover:bg-primary/15",
    iconBox: "border-primary/25 bg-primary/15 text-primary",
  },
  RESULT: {
    icon: ShieldCheck,
    label: "Результат",
    accent: "text-emerald-300",
    shell: "border-emerald-400/25 bg-emerald-500/10 hover:bg-emerald-500/15",
    iconBox: "border-emerald-400/25 bg-emerald-500/15 text-emerald-300",
  },
  SYSTEM: {
    icon: CalendarCheck2,
    label: "Система",
    accent: "text-sky-300",
    shell: "border-sky-400/25 bg-sky-500/10 hover:bg-sky-500/15",
    iconBox: "border-sky-400/25 bg-sky-500/15 text-sky-300",
  },
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
  const [unread, setUnread] = useState(unreadCount);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      setItems(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  async function markAllAsRead() {
    if (!unread) return;

    setUnread(0);
    setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    await fetch("/api/notifications/read", { method: "POST" }).catch(() => {
      setUnread(unread);
    });
  }

  useEffect(() => {
    let ignore = false;

    loadNotifications();
    const interval = window.setInterval(() => {
      if (!ignore) void loadNotifications();
    }, 45_000);

    if (process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      const channel = pusher.subscribe(`user-${userId}`);
      channel.bind("notification:new", (notification: NotificationItem) => {
        setItems((current) => [notification, ...current].slice(0, 8));
        setUnread((current) => current + 1);
      });

      return () => {
        ignore = true;
        window.clearInterval(interval);
        channel.unbind_all();
        pusher.unsubscribe(`user-${userId}`);
        pusher.disconnect();
      };
    }

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [loadNotifications, userId]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void loadNotifications();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:h-11 sm:w-11"
        >
          {children}
          {unread > 0 ? (
            <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(400px,calc(100vw-24px))] rounded-2xl border-white/10 bg-[#0b0f17]/95 p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.16),transparent_42%)] p-4">
          <div>
            <div className="flex items-center gap-2 font-medium">
              <Bell className="h-4 w-4 text-primary" />
              Уведомления
            </div>
            <div className="mt-1 text-xs text-zinc-500">Непрочитанных: {unread}</div>
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-9 gap-2 rounded-lg px-3 text-xs" onClick={markAllAsRead} disabled={!unread}>
            <CheckCheck className="h-4 w-4" />
            Прочитано
          </Button>
        </div>
        <div className="max-h-[430px] overflow-y-auto p-2">
          {loading && !items.length ? (
            <div className="flex items-center justify-center gap-2 px-3 py-10 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаем уведомления
            </div>
          ) : items.length ? (
            items.map((item) => {
              const style = notificationStyles[item.type ?? "SYSTEM"];
              const Icon = style.icon;
              const content = (
                <div className={`group rounded-xl border px-3 py-3 text-sm transition ${item.isRead ? "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]" : style.shell}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${style.iconBox}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 font-medium text-white">{item.title}</div>
                        {item.link ? <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-primary" /> : null}
                      </div>
                      <div className="mt-1 line-clamp-3 text-zinc-400">{item.body}</div>
                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                        <span className={`inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 font-semibold ${style.accent}`}>
                          <Sparkles className="h-3 w-3" />
                          {style.label}
                        </span>
                        <span className="text-zinc-600">{formatNotificationDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );

              return item.link ? (
                <Link key={item.id} href={item.link} onClick={() => setOpen(false)} className="mb-2 block">
                  {content}
                </Link>
              ) : (
                <div key={item.id} className="mb-2">
                  {content}
                </div>
              );
            })
          ) : (
            <div className="px-3 py-10 text-center text-sm text-zinc-500">
              Пока уведомлений нет.
              <span className="mt-1 block text-xs text-zinc-600">Матчи, турниры, сезоны и регламент появятся здесь сразу после событий.</span>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatNotificationDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
