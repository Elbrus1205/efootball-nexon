import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <svg
      aria-label="eFootball Nexon"
      role="img"
      viewBox="0 0 80 48"
      className={cn(
        "h-10 w-[66px] shrink-0 text-white sm:h-11 sm:w-[72px]",
        className,
      )}
    >
      <g fill="currentColor">
        <rect x="3" y="6" width="8" height="36" />
        <rect x="3" y="6" width="31" height="8" />
        <rect x="3" y="20" width="27" height="8" />
        <rect x="3" y="34" width="31" height="8" />
        <path d="M44 6H52L67 25V6H75V42H67L52 23V42H44V6Z" />
      </g>
    </svg>
  );
}
