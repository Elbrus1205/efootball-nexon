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
  GOLD: "profile-status-tone-gold",
  PURPLE: "profile-status-tone-purple",
  BLUE: "profile-status-tone-blue",
  GREEN: "profile-status-tone-green",
  GRAY: "profile-status-tone-gray",
};

export function profileStatusClassName(tone: ProfileStatusTone, className?: string) {
  return cn(
    "profile-status-badge inline-flex min-h-4 items-center rounded-full border px-1.5 py-0 text-[7px] font-bold leading-none sm:min-h-6 sm:px-2.5 sm:py-0.5 sm:text-[11px]",
    profileStatusToneClasses[tone],
    className,
  );
}
