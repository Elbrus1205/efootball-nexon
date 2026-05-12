import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";

export type ManagedRole = Extract<UserRole, "JUDGE" | "ORGANIZER" | "ADMIN">;

export type RolePermission = {
  id: string;
  label: string;
  description?: string;
};

export const managedRoles = [UserRole.JUDGE, UserRole.ORGANIZER, UserRole.ADMIN] as const;

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
  { id: "coins.manage", label: "Управлять магазином Coins, заказами, товарами, картами и партнёрами" },
] as const satisfies readonly RolePermission[];

export type RolePermissionId = (typeof rolePermissions)[number]["id"];

export const rolePermissionIds = rolePermissions.map((permission) => permission.id) as RolePermissionId[];

export const defaultRolePermissions: Record<ManagedRole, RolePermissionId[]> = {
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
    "coins.manage",
  ],
};

export function isManagedRole(role: UserRole): role is ManagedRole {
  return managedRoles.includes(role as ManagedRole);
}

export function isRolePermissionId(permission: string): permission is RolePermissionId {
  return rolePermissionIds.includes(permission as RolePermissionId);
}

export async function getRolePermissionState() {
  const rows = await db.rolePermission.findMany();
  const state = Object.fromEntries(managedRoles.map((role) => [role, new Set(defaultRolePermissions[role])])) as Record<ManagedRole, Set<RolePermissionId>>;

  for (const row of rows) {
    if (!isManagedRole(row.role) || !isRolePermissionId(row.permission)) continue;

    if (row.enabled) {
      state[row.role].add(row.permission);
    } else {
      state[row.role].delete(row.permission);
    }
  }

  return state;
}

export async function getRolePermissionIds(role: UserRole) {
  if (role === UserRole.FOUNDER) {
    return new Set(rolePermissionIds);
  }

  if (!isManagedRole(role)) {
    return new Set<RolePermissionId>();
  }

  const state = await getRolePermissionState();
  return state[role];
}

export async function roleHasPermission(role: UserRole, permission: RolePermissionId) {
  if (role === UserRole.FOUNDER) return true;
  const permissions = await getRolePermissionIds(role);
  return permissions.has(permission);
}

export async function roleHasAnyPermission(role: UserRole, permissions: RolePermissionId[]) {
  if (role === UserRole.FOUNDER) return true;
  const current = await getRolePermissionIds(role);
  return permissions.some((permission) => current.has(permission));
}

export const adminNavPermissions: Record<string, RolePermissionId[]> = {
  "/admin/tournaments": ["tournaments.createEdit", "tournaments.manageParticipants", "tournaments.manageStructure", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/seasons": ["tournaments.createEdit"],
  "/admin/statuses": ["profileStatuses.manage"],
  "/admin/coins": ["coins.manage"],
  "/admin/regulations": ["content.manage"],
  "/admin/faq": ["content.manage"],
  "/admin/users": ["users.view", "users.ban", "users.changeLowerRoles"],
  "/admin/role-permissions": [],
  "/admin/matches": ["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/moderation": ["matches.reviewResults", "ownTournaments.moderateMatches", "allTournaments.moderateMatches"],
  "/admin/broadcasts": ["broadcasts.manage"],
};

export async function getAllowedAdminNavHrefs(role: UserRole) {
  if (role === UserRole.FOUNDER) {
    return Object.keys(adminNavPermissions);
  }

  const permissions = await getRolePermissionIds(role);

  return Object.entries(adminNavPermissions)
    .filter(([, required]) => required.length > 0 && required.some((permission) => permissions.has(permission)))
    .map(([href]) => href);
}
