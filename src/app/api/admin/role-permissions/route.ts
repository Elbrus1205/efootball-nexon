import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isManagedRole, isRolePermissionId, managedRoles, rolePermissionIds } from "@/lib/role-permissions";

export async function POST(request: Request) {
  await requireRole([UserRole.FOUNDER]);

  const body = (await request.json().catch(() => null)) as { permissions?: Record<string, unknown> } | null;

  if (!body?.permissions || typeof body.permissions !== "object") {
    return NextResponse.json({ error: "Некорректный список прав." }, { status: 400 });
  }

  const operations = [];

  for (const role of managedRoles) {
    const enabledInput = body.permissions[role];
    const enabled = new Set(
      Array.isArray(enabledInput)
        ? enabledInput.filter((permission): permission is string => typeof permission === "string").filter(isRolePermissionId)
        : [],
    );

    if (!isManagedRole(role)) continue;

    for (const permission of rolePermissionIds) {
      operations.push(
        db.rolePermission.upsert({
          where: {
            role_permission: {
              role,
              permission,
            },
          },
          create: {
            role,
            permission,
            enabled: enabled.has(permission),
          },
          update: {
            enabled: enabled.has(permission),
          },
        }),
      );
    }
  }

  await db.$transaction(operations);

  return NextResponse.json({ ok: true });
}
