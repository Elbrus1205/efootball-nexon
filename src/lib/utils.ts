import { type ClassValue, clsx } from "clsx";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, dateFormat = "d MMM yyyy, HH:mm") {
  return format(new Date(date), dateFormat, { locale: ru });
}

export function getInitials(value?: string | null) {
  if (!value) return "EF";
  return value
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}
