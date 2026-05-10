import type { UserRole } from "@prisma/client";
import { userRoleColor, userRoleLabel } from "@/lib/admin-display";

type UserRoleBadgeProps = {
  role: UserRole;
  className?: string;
};

export function UserRoleBadge({ role, className = "" }: UserRoleBadgeProps) {
  const color = userRoleColor[role];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-none tracking-[0.12em] ${className}`}
      style={{
        color,
        borderColor: `${color}66`,
        backgroundColor: `${color}1A`,
        boxShadow: `0 0 18px ${color}22`,
      }}
    >
      {userRoleLabel[role]}
    </span>
  );
}
