import { db } from "@/lib/db";
import { roleHasPermission } from "@/lib/role-permissions";

export async function getShopPermissionIds(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true, isBanned: true } });
  if (!user || user.isBanned) return [] as Array<"shop.support" | "shop.manage">;
  const [support, manage] = await Promise.all([
    roleHasPermission(user.role, "shop.support"),
    roleHasPermission(user.role, "shop.manage"),
  ]);
  return [support ? "shop.support" as const : null, manage ? "shop.manage" as const : null].filter(
    (permission): permission is "shop.support" | "shop.manage" => Boolean(permission),
  );
}

export async function requireShopPermission(userId: string, permission: "shop.support" | "shop.manage") {
  const permissions = await getShopPermissionIds(userId);
  if (!permissions.includes(permission)) throw new Error("Недостаточно прав для действия в магазине.");
  return permissions;
}
