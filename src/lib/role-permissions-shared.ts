import { UserRole } from "@prisma/client";

export type ManagedRole = Extract<UserRole, "TRAINEE" | "JUDGE" | "ORGANIZER" | "ADMIN">;

export type RolePermission = {
  id: string;
  label: string;
  description?: string;
};

export const managedRoles = [UserRole.TRAINEE, UserRole.JUDGE, UserRole.ORGANIZER, UserRole.ADMIN] as const;

export const rolePermissions = [
  {
    id: "admin.matchesOnly",
    label: "Видит админку только для матчей и модерации",
    description: "Ограниченный вход в админ-панель без доступа к турнирам, пользователям, магазину и настройкам.",
  },
  { id: "matches.reviewResults", label: "Проверять результаты матчей" },
  { id: "matches.confirmResults", label: "Подтверждать результат" },
  { id: "matches.rejectResults", label: "Отклонять результат" },
  { id: "matches.markDispute", label: "Переводить матч в спор" },
  { id: "matches.commentDispute", label: "Оставлять комментарий по спору" },

  { id: "tournaments.createEdit", label: "Создавать и редактировать турниры" },
  { id: "tournaments.manageParticipants", label: "Управлять участниками турнира" },
  { id: "tournaments.manageStructure", label: "Создавать стадии, группы, лиги и сетки" },
  { id: "matches.generate", label: "Генерировать матчи" },
  { id: "schedule.manage", label: "Менять расписание турнира" },
  { id: "participants.assignClubs", label: "Назначать клубы" },
  { id: "tournaments.manageDeadlines", label: "Управлять дедлайнами" },
  { id: "ownTournaments.moderateMatches", label: "Видеть матчи и модерировать свои турниры" },

  { id: "admin.inheritOrganizerJudge", label: "Всё, что может организатор и судья" },
  { id: "users.ban", label: "Банить и разбанивать пользователей" },
  { id: "users.changeLowerRoles", label: "Менять роли ниже своей роли: игрок, судья, организатор" },
  { id: "profileStatuses.manage", label: "Управлять статусами профиля" },
  { id: "allTournaments.moderateMatches", label: "Модерировать все турниры и все матчи" },
  { id: "users.view", label: "Смотреть пользователей" },
  { id: "broadcasts.manage", label: "Делать рассылки" },
  { id: "content.manage", label: "Управлять FAQ и регламентами" },
  { id: "divisions.manage", label: "Управлять режимом Дивизион" },
] as const satisfies readonly RolePermission[];

export type RolePermissionId = (typeof rolePermissions)[number]["id"];

export const rolePermissionIds = rolePermissions.map((permission) => permission.id) as RolePermissionId[];

export const defaultRolePermissions: Record<ManagedRole, RolePermissionId[]> = {
  [UserRole.TRAINEE]: [
    "matches.reviewResults",
    "matches.confirmResults",
    "matches.rejectResults",
    "matches.markDispute",
    "matches.commentDispute",
    "tournaments.createEdit",
    "tournaments.manageParticipants",
    "tournaments.manageStructure",
    "matches.generate",
    "schedule.manage",
    "participants.assignClubs",
    "tournaments.manageDeadlines",
    "ownTournaments.moderateMatches",
  ],
  [UserRole.JUDGE]: [
    "admin.matchesOnly",
    "matches.reviewResults",
    "matches.confirmResults",
    "matches.rejectResults",
    "matches.markDispute",
    "matches.commentDispute",
  ],
  [UserRole.ORGANIZER]: [
    "tournaments.createEdit",
    "tournaments.manageParticipants",
    "tournaments.manageStructure",
    "matches.generate",
    "schedule.manage",
    "participants.assignClubs",
    "tournaments.manageDeadlines",
    "ownTournaments.moderateMatches",
  ],
  [UserRole.ADMIN]: [
    "admin.inheritOrganizerJudge",
    "matches.reviewResults",
    "matches.confirmResults",
    "matches.rejectResults",
    "matches.markDispute",
    "matches.commentDispute",
    "tournaments.createEdit",
    "tournaments.manageParticipants",
    "tournaments.manageStructure",
    "matches.generate",
    "schedule.manage",
    "participants.assignClubs",
    "tournaments.manageDeadlines",
    "ownTournaments.moderateMatches",
    "users.ban",
    "users.changeLowerRoles",
    "profileStatuses.manage",
    "allTournaments.moderateMatches",
    "users.view",
    "broadcasts.manage",
    "content.manage",
    "divisions.manage",
  ],
};

export function isManagedRole(role: UserRole): role is ManagedRole {
  return managedRoles.includes(role as ManagedRole);
}

export function isRolePermissionId(permission: string): permission is RolePermissionId {
  return rolePermissionIds.includes(permission as RolePermissionId);
}

export const adminNavPermissions: Record<string, RolePermissionId[]> = {
  "/admin/tournaments": ["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/seasons": ["tournaments.createEdit"],
  "/admin/statuses": ["profileStatuses.manage"],
  "/admin/regulations": ["content.manage"],
  "/admin/faq": ["content.manage"],
  "/admin/users": ["users.view", "users.ban", "users.changeLowerRoles"],
  "/admin/role-permissions": [],
  "/admin/matches": ["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/moderation": ["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/broadcasts": ["broadcasts.manage"],
  "/admin/divisions": ["divisions.manage"],
};
