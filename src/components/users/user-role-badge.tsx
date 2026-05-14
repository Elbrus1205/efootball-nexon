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
        "inline-flex min-h-4 max-w-full shrink-0 items-center overflow-hidden truncate whitespace-nowrap rounded-full border px-1.5 py-0 text-[7px] font-black uppercase leading-none tracking-[0.07em] sm:min-h-6 sm:px-2.5 sm:py-0.5 sm:text-[11px] sm:tracking-[0.1em]",
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
