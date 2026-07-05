"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { userRoleColor, userRoleLabel } from "@/lib/admin-display";
import { managedRoles, rolePermissions, type ManagedRole, type RolePermissionId } from "@/lib/role-permissions-shared";
import { cn } from "@/lib/utils";

type RolePermissionManagerProps = {
  initialEnabledByRole: Record<ManagedRole, RolePermissionId[]>;
};

function createInitialState(initialEnabledByRole: RolePermissionManagerProps["initialEnabledByRole"]) {
  return Object.fromEntries(managedRoles.map((role) => [role, new Set(initialEnabledByRole[role])])) as Record<ManagedRole, Set<RolePermissionId>>;
}

export function RolePermissionsManager({ initialEnabledByRole }: RolePermissionManagerProps) {
  const [enabledByRole, setEnabledByRole] = useState(() => createInitialState(initialEnabledByRole));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const totals = useMemo(
    () =>
      Object.fromEntries(
        managedRoles.map((role) => [role, enabledByRole[role].size]),
      ) as Record<ManagedRole, number>,
    [enabledByRole],
  );

  const togglePermission = (role: ManagedRole, permissionId: RolePermissionId) => {
    setEnabledByRole((current) => {
      const nextRolePermissions = new Set(current[role]);

      if (nextRolePermissions.has(permissionId)) {
        nextRolePermissions.delete(permissionId);
      } else {
        nextRolePermissions.add(permissionId);
      }

      return {
        ...current,
        [role]: nextRolePermissions,
      };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/admin/role-permissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: Object.fromEntries(managedRoles.map((role) => [role, Array.from(enabledByRole[role])])),
      }),
    });

    setSaving(false);
    setMessage(response.ok ? "Права ролей сохранены." : "Не удалось сохранить права.");
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-lg p-0">
        <CardHeader className="border-b border-white/10 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Права ролей</CardTitle>
              <CardDescription className="mt-2 max-w-3xl">
                Черновик матрицы прав. Всё, что не включено у роли, считается недоступным для этой роли.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {message ? <span className="text-sm text-zinc-300">{message}</span> : null}
              <Badge variant="neutral">Настройка списка</Badge>
              <Button type="button" onClick={save} disabled={saving}>
                {saving ? "Сохранение..." : "Сохранить"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid gap-3 md:grid-cols-3">
            {managedRoles.map((role) => {
              const color = userRoleColor[role];

              return (
                <div key={role} className="rounded-lg border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-white" style={{ color }}>
                      {userRoleLabel[role]}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-300">
                      {totals[role]} / {rolePermissions.length}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[minmax(280px,1fr)_160px_160px_160px] border-b border-white/10 bg-white/[0.03] text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
              <div className="px-4 py-3">Право</div>
              {managedRoles.map((role) => (
                <div key={role} className="px-4 py-3 text-center">
                  {userRoleLabel[role]}
                </div>
              ))}
            </div>

            <div className="divide-y divide-white/10">
              {rolePermissions.map((permission) => (
                <div key={permission.id} className="grid grid-cols-[minmax(280px,1fr)_160px_160px_160px] items-center">
                  <div className="px-4 py-4">
                    <div className="font-medium text-white">{permission.label}</div>
                    {"description" in permission && permission.description ? <div className="mt-1 text-xs leading-5 text-zinc-500">{permission.description}</div> : null}
                  </div>

                  {managedRoles.map((role) => {
                    const checked = enabledByRole[role].has(permission.id);
                    const color = userRoleColor[role];

                    return (
                      <label key={`${role}-${permission.id}`} className="flex justify-center px-4 py-4">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(role, permission.id)}
                          className="peer sr-only"
                          aria-label={`${userRoleLabel[role]}: ${permission.label}`}
                        />
                        <span
                          className={cn(
                            "relative h-7 w-12 rounded-full border transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-zinc-400 after:transition",
                            checked ? "after:translate-x-5" : "",
                          )}
                          style={{
                            borderColor: checked ? `${color}99` : "rgba(255,255,255,0.12)",
                            backgroundColor: checked ? `${color}26` : "rgba(255,255,255,0.04)",
                            boxShadow: checked ? `0 0 18px ${color}22` : undefined,
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
