import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const MOSCOW_TIME_ZONE = "Europe/Moscow";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getMoscowDateParts(date: Date | string) {
  const parsed = new Date(date);
  const parts = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

export function formatDate(date: Date | string, dateFormat = "d MMM yyyy, HH:mm") {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return "";

  if (dateFormat === "d MMM yyyy, HH:mm") {
    const parts = getMoscowDateParts(parsed);
    return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
  }

  if (dateFormat === "d MMM yyyy") {
    const parts = getMoscowDateParts(parsed);
    return `${parts.day} ${parts.month} ${parts.year}`;
  }

  if (dateFormat === "d MMMM") {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: MOSCOW_TIME_ZONE,
      day: "numeric",
      month: "long",
    }).format(parsed);
  }

  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
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
