import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <svg
      aria-label="eFootball Nexon"
      role="img"
      viewBox="0 0 168 72"
      className={cn(
        "h-10 w-[94px] shrink-0 text-white sm:h-11 sm:w-[104px]",
        className,
      )}
    >
      <g fill="currentColor">
        <rect x="4" y="8" width="14" height="56" />
        <rect x="4" y="8" width="68" height="12" />
        <rect x="4" y="30" width="58" height="12" />
        <rect x="4" y="52" width="68" height="12" />
        <rect x="92" y="8" width="14" height="56" />
        <polygon points="108,8 124,8 150,64 134,64" />
        <rect x="150" y="8" width="14" height="56" />
      </g>
    </svg>
  );
}
