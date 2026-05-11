import { UserRole } from "@prisma/client";
import { RolePermissionsManager } from "@/components/admin/role-permissions-manager";
import { requireRole } from "@/lib/auth/session";
import { getRolePermissionState, managedRoles, type ManagedRole, type RolePermissionId } from "@/lib/role-permissions";

export default async function AdminRolePermissionsPage() {
  await requireRole([UserRole.FOUNDER]);
  const state = await getRolePermissionState();
  const initialEnabledByRole = Object.fromEntries(
    managedRoles.map((role) => [role, Array.from(state[role])]),
  ) as Record<ManagedRole, RolePermissionId[]>;

  return <RolePermissionsManager initialEnabledByRole={initialEnabledByRole} />;
}
