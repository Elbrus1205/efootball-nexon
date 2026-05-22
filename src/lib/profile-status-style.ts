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
  GOLD: "border-[#F5C542]/70 bg-[#2A2107]/85 text-[#FFE48A]",
  PURPLE: "border-[#D8DCE7]/65 bg-[#202026]/85 text-[#F4F6FA]",
  BLUE: "border-[#5AA9E6]/65 bg-[#071C2E]/85 text-[#A9D8FF]",
  GREEN: "border-[#54C083]/65 bg-[#082416]/85 text-[#BFE6CC]",
  GRAY: "border-[#8E8E8E]/55 bg-[#181818]/85 text-[#D7D7D7]",
};

export function profileStatusClassName(tone: ProfileStatusTone, className?: string) {
  return cn(
    "inline-flex min-h-4 items-center rounded-full border px-1.5 py-0 text-[7px] font-bold leading-none sm:min-h-6 sm:px-2.5 sm:py-0.5 sm:text-[11px]",
    profileStatusToneClasses[tone],
    className,
  );
}
