import { UserRole } from "@prisma/client";

export type TelegramAdminCommand = {
  command: string;
  description: string;
};

export const telegramAdminCommands = [
  { command: "/admin", description: "показать этот список админских команд" },
  { command: "/inactive НИК_С_САЙТА", description: "отметить участника неактивным с рассчитанного тура" },
  { command: "/inactivelist", description: "открыть список неактивных участников и активировать выбранного" },
] as const satisfies readonly TelegramAdminCommand[];

const telegramAdminRoles = [
  UserRole.FOUNDER,
  UserRole.ORGANIZER,
  UserRole.ADMIN,
  UserRole.JUDGE,
  UserRole.TRAINEE,
] as const;

export function isTelegramAdminRole(role?: UserRole | null) {
  return role !== undefined && role !== null && telegramAdminRoles.some((adminRole) => adminRole === role);
}

export function buildTelegramAdminCommandsText() {
  return [
    "Команды для администраторов сайта:",
    "",
    ...telegramAdminCommands.map(({ command, description }) => `${command} — ${description}`),
  ].join("\n");
}
