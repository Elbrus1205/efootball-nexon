import type { ProfileStatusTone } from "@prisma/client";
import { cn } from "@/lib/utils";

export const MAX_SELECTED_PROFILE_STATUSES = 3;

export const profileStatusToneMeta: Record<ProfileStatusTone, { level: string; color: string; value: string }> = {
  GOLD: { level: "TOP 1", color: "Золото", value: "Лучшие" },
  PURPLE: { level: "TOP 2", color: "Фиолетовый", value: "Очень сильные" },
  BLUE: { level: "TOP 3", color: "Синий", value: "Уважаемые" },
  GREEN: { level: "TOP 4", color: "Зелёный", value: "Активные" },
  GRAY: { level: "TOP 5", color: "Серый", value: "Обычные" },
};

export const profileStatusToneOrder: ProfileStatusTone[] = ["GOLD", "PURPLE", "BLUE", "GREEN", "GRAY"];

export const profileStatusToneClasses: Record<ProfileStatusTone, string> = {
  GOLD: "border-amber-300/45 bg-amber-300/15 text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.14)]",
  PURPLE: "border-violet-300/40 bg-violet-400/15 text-violet-100 shadow-[0_0_20px_rgba(167,139,250,0.12)]",
  BLUE: "border-sky-300/40 bg-sky-400/15 text-sky-100 shadow-[0_0_20px_rgba(56,189,248,0.12)]",
  GREEN: "border-emerald-300/40 bg-emerald-400/15 text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.12)]",
  GRAY: "border-zinc-300/25 bg-zinc-300/10 text-zinc-200",
};

export function profileStatusClassName(tone: ProfileStatusTone, className?: string) {
  return cn(
    "inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-bold leading-none",
    profileStatusToneClasses[tone],
    className,
  );
}
