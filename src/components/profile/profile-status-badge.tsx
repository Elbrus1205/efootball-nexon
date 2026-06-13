import { Youtube } from "lucide-react";
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
        <span className="profile-status-youtube-icon inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-white sm:h-4 sm:w-4">
          <Youtube className="h-2.5 w-2.5 fill-current sm:h-3 sm:w-3" />
        </span>
      ) : null}
      <span>{status.title}</span>
    </span>
  );
}
