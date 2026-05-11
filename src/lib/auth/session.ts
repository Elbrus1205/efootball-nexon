import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { roleHasAnyPermission, roleHasPermission, type RolePermissionId } from "@/lib/role-permissions";

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isBanned) redirect("/login?banned=1");
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requirePermission(permission: RolePermissionId) {
  const session = await requireAuth();
  if (!(await roleHasPermission(session.user.role, permission))) redirect("/dashboard");
  return session;
}

export async function requireAnyPermission(permissions: RolePermissionId[]) {
  const session = await requireAuth();
  if (!(await roleHasAnyPermission(session.user.role, permissions))) redirect("/dashboard");
  return session;
}
