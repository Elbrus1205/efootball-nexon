import type { UserRole } from "@prisma/client";
import { userRoleColor, userRoleLabel } from "@/lib/admin-display";
import { cn } from "@/lib/utils";

type UserRoleBadgeProps = {
  role: UserRole;
  className?: string;
};

export function UserRoleBadge({ role, className = "" }: UserRoleBadgeProps) {
  const color = userRoleColor[role];

  return (
    <span
      className={cn(
        "inline-flex min-h-6 max-w-full shrink-0 items-center overflow-hidden truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-black uppercase leading-none tracking-[0.1em] sm:px-2.5 sm:text-[11px]",
        className,
      )}
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
