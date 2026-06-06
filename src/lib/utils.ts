import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const MOSCOW_TIME_ZONE = "Europe/Moscow";
const MOSCOW_UTC_OFFSET_HOURS = 3;

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

export function parseMoscowDateTimeLocal(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);

  if (!match) {
    return new Date(trimmed);
  }

  const [, year, month, day, hour, minute, second = "00"] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - MOSCOW_UTC_OFFSET_HOURS,
      Number(minute),
      Number(second),
    ),
  );
}

export function formatMoscowDateTimeLocalInput(value?: Date | string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return `${byType.year}-${byType.month}-${byType.day}T${byType.hour}:${byType.minute}`;
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
