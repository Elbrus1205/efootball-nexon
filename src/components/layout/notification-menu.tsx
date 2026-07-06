"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Pusher from "pusher-js";
import { Bell, CalendarCheck2, CheckCheck, ExternalLink, Loader2, ShieldCheck, Sparkles, Swords, Trophy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/realtime/supabase-browser";

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
  // Дедуп по id: и Supabase Realtime, и Pusher могут доставить одно и то же
  // уведомление. Считаем его только один раз.
  const seenIdsRef = useRef<Set<string>>(new Set());

  const ingestNotification = useCallback((notification: NotificationItem) => {
    if (!notification?.id || seenIdsRef.current.has(notification.id)) return;
    seenIdsRef.current.add(notification.id);
    setItems((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 8));
    setUnread((current) => current + 1);
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      const data = await response.json();
      const loaded: NotificationItem[] = data.notifications ?? [];
      for (const item of loaded) {
        if (item?.id) seenIdsRef.current.add(item.id);
      }
      setItems(loaded);
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

    const cleanups: Array<() => void> = [];

    // Основной канал: Supabase Realtime (broadcast).
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      const channel = supabase
        .channel(`user-${userId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "notification:new" }, (message) => {
          ingestNotification(message.payload as NotificationItem);
        })
        .subscribe();

      cleanups.push(() => {
        void supabase.removeChannel(channel);
      });
    }

    // Fallback: Pusher (если настроен). Дедуп по id в ingestNotification.
    if (process.env.NEXT_PUBLIC_PUSHER_KEY && process.env.NEXT_PUBLIC_PUSHER_CLUSTER) {
      const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      });

      const channel = pusher.subscribe(`user-${userId}`);
      channel.bind("notification:new", (notification: NotificationItem) => {
        ingestNotification(notification);
      });

      cleanups.push(() => {
        channel.unbind_all();
        pusher.unsubscribe(`user-${userId}`);
        pusher.disconnect();
      });
    }

    return () => {
      ignore = true;
      window.clearInterval(interval);
      for (const cleanup of cleanups) cleanup();
    };
  }, [loadNotifications, ingestNotification, userId]);

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
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9944f]/60 sm:h-11 sm:w-11"
        >
          {children}
          {unread > 0 ? (
            <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="max-h-[min(620px,calc(100vh-104px))] w-[calc(100vw-24px)] overflow-hidden rounded-[1.35rem] border-white/10 bg-[#0b0f17]/95 p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.5)] backdrop-blur-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:w-[420px] sm:rounded-[1.75rem]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_38%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-3.5 sm:p-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-black leading-tight text-white sm:text-lg">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/15 text-primary sm:h-8 sm:w-8 sm:rounded-xl">
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </span>
              <span className="truncate">Уведомления</span>
            </div>
            <div className="mt-1.5 text-[11px] font-semibold text-zinc-400 sm:mt-2 sm:text-xs">Непрочитанных: {unread}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 gap-1.5 rounded-lg px-2 text-[11px] text-zinc-300 hover:bg-white/10 hover:text-white sm:h-9 sm:rounded-xl sm:px-3 sm:text-xs"
            onClick={markAllAsRead}
            disabled={!unread}
          >
            <CheckCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Прочитано</span>
          </Button>
        </div>
        <div className="max-h-[calc(100vh-176px)] overflow-y-auto overscroll-contain p-2 sm:max-h-[520px] sm:p-3">
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
                <div
                  className={`group rounded-xl border px-2.5 py-2.5 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition sm:rounded-2xl sm:px-4 sm:py-4 sm:text-sm ${
                    item.isRead ? "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]" : style.shell
                  }`}
                >
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border sm:h-11 sm:w-11 sm:rounded-xl ${style.iconBox}`}>
                      <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2 sm:gap-3">
                        <div className="min-w-0 break-words text-[13px] font-black leading-snug text-white sm:text-base">{item.title}</div>
                        {item.link ? <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:text-primary sm:h-4 sm:w-4" /> : null}
                      </div>
                      <div className="mt-1 line-clamp-3 break-words text-[11px] font-semibold leading-4 text-zinc-400 sm:mt-1.5 sm:line-clamp-4 sm:text-sm sm:leading-6">{item.body}</div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] sm:mt-4 sm:gap-3 sm:text-[11px]">
                        <span className={`inline-flex min-w-0 items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 font-bold sm:px-2.5 sm:py-1 ${style.accent}`}>
                          <Sparkles className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                          <span className="truncate">{style.label}</span>
                        </span>
                        <span className="shrink-0 text-zinc-600">{formatNotificationDate(item.createdAt)}</span>
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
