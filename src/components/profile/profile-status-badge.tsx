import type { ProfileStatusTone, ProfileStatusType } from "@prisma/client";
import { profileStatusClassName } from "@/lib/profile-status-style";
import { cn } from "@/lib/utils";

export type ProfileStatusBadgeData = {
  title: string;
  tone: ProfileStatusTone;
  type?: ProfileStatusType;
};

export function ProfileStatusBadge({
  status,
  className,
}: {
  status: ProfileStatusBadgeData;
  className?: string;
}) {
  const isAmbassador = status.type === "AMBASSADOR";

  return (
    <span className={profileStatusClassName(status.tone, cn(isAmbassador && "profile-status-ambassador gap-1.5 pl-1", className))}>
      {isAmbassador ? (
        <span className="profile-status-youtube-icon inline-flex h-3.5 w-5 items-center justify-center rounded-[5px] ring-1 ring-white/25 sm:h-4 sm:w-6">
          <span className="ml-[1px] h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-[#101010] sm:border-y-[5px] sm:border-l-[7px]" />
        </span>
      ) : null}
      <span>{status.title}</span>
    </span>
  );
}
