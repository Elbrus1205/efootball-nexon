import Link from "next/link";
import { Briefcase, ClipboardList, Coins, Handshake, ShoppingBag, UserCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CoinsBottomMenuProps = {
  isSignedIn: boolean;
  isPartner: boolean;
  isExecutor: boolean;
  servicesEnabled: boolean;
  buyerOrdersCount: number;
  buyerActiveOrdersCount: number;
  executorActiveOrdersCount: number;
  activeItem?: MenuItemKey;
};

type MenuItemKey = "profile" | "orders" | "services" | "purchases" | "partner" | "work";

type MenuItem = {
  key: MenuItemKey;
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  accent: string;
};

export function CoinsBottomMenu({
  isSignedIn,
  isPartner,
  isExecutor,
  servicesEnabled,
  buyerOrdersCount,
  buyerActiveOrdersCount,
  executorActiveOrdersCount,
  activeItem,
}: CoinsBottomMenuProps) {
  const profileHref = isSignedIn ? "/coins/profile" : "/login";
  const ordersHref = isSignedIn ? "/coins/orders" : "/login";
  const statusItem: MenuItem | null = isPartner
    ? {
        key: "partner",
        href: "/coins/partner",
        label: "Партнёр",
        icon: Handshake,
        accent: "from-amber-300/20 to-orange-400/10 text-amber-100",
      }
    : isExecutor
      ? {
          key: "work",
          href: "/coins/work",
          label: "Работа",
          icon: Briefcase,
          badge: executorActiveOrdersCount,
          accent: "from-emerald-300/20 to-teal-400/10 text-emerald-100",
        }
      : null;

  const items: MenuItem[] = [
    {
      key: "profile",
      href: profileHref,
      label: "Профиль",
      icon: UserCircle,
      accent: "from-sky-300/20 to-blue-500/10 text-sky-100",
    },
    {
      key: "orders",
      href: ordersHref,
      label: "Заказы",
      icon: ClipboardList,
      badge: buyerActiveOrdersCount || buyerOrdersCount,
      accent: "from-violet-300/20 to-fuchsia-500/10 text-violet-100",
    },
    ...(servicesEnabled
      ? [
          {
            key: "services" as const,
            href: "/coins/services",
            label: "Услуги",
            icon: ShoppingBag,
            accent: "from-emerald-300/20 to-cyan-500/10 text-emerald-100",
          },
        ]
      : []),
    {
      key: "purchases",
      href: "/coins/purchases",
      label: "Покупки",
      icon: Coins,
      accent: "from-yellow-300/20 to-amber-500/10 text-yellow-100",
    },
    ...(statusItem ? [statusItem] : []),
  ];

  return (
    <nav
      aria-label="Меню Coins"
      className="fixed inset-x-0 bottom-3 z-30 px-3 pb-[env(safe-area-inset-bottom)] sm:bottom-4 sm:px-5"
    >
      <div
        className={cn(
          "mx-auto grid max-w-4xl gap-1.5 rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(12,18,31,0.92),rgba(5,8,14,0.96))] p-1.5 shadow-[0_18px_54px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl sm:gap-2 sm:rounded-[1.75rem] sm:p-2",
          items.length === 3 && "grid-cols-3",
          items.length === 4 && "grid-cols-4",
          items.length >= 5 && "grid-cols-5",
        )}
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const selected = activeItem === item.key;

          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                "group relative flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-[1.15rem] px-1.5 py-2 text-center text-[10px] font-bold leading-none text-zinc-300 transition duration-300 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:min-h-[64px] sm:rounded-[1.35rem] sm:text-xs",
                selected && "bg-white/[0.06] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
                selected && "ring-1 ring-white/10",
              )}
            >
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 ring-white/10 transition duration-300 group-hover:scale-105 sm:h-9 sm:w-9", item.accent)}>
                <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </span>
              <span className="w-full truncate">{item.label}</span>
              {item.badge ? (
                <span className="absolute right-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-white/15 bg-primary px-1 text-[10px] font-black leading-none text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)]">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
