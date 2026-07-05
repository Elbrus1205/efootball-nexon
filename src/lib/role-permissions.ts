import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import {
  adminNavPermissions,
  defaultRolePermissions,
  isManagedRole,
  isRolePermissionId,
  managedRoles,
  rolePermissionIds,
  type ManagedRole,
  type RolePermissionId,
} from "@/lib/role-permissions-shared";

export {
  adminNavPermissions,
  defaultRolePermissions,
  isManagedRole,
  isRolePermissionId,
  managedRoles,
  rolePermissionIds,
  rolePermissions,
} from "@/lib/role-permissions-shared";
export type { ManagedRole, RolePermission, RolePermissionId } from "@/lib/role-permissions-shared";

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

export async function getAllowedAdminNavHrefs(role: UserRole) {
  if (role === UserRole.FOUNDER) {
    return Object.keys(adminNavPermissions);
  }

  const permissions = await getRolePermissionIds(role);

  return Object.entries(adminNavPermissions)
    .filter(([, required]) => required.length > 0 && required.some((permission) => permissions.has(permission)))
    .map(([href]) => href);
}
