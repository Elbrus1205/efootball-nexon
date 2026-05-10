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
        "brand-logo-mark h-9 w-[58px] shrink-0 text-white sm:h-11 sm:w-[72px]",
        className,
      )}
    >
      <defs>
        <linearGradient id="brand-logo-gradient" x1="0" y1="0" x2="80" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
      </defs>
      <g fill="url(#brand-logo-gradient)">
        <rect x="4" y="7" width="8" height="34" rx="1.5" />
        <rect x="4" y="7" width="31" height="8" rx="1.5" />
        <rect x="4" y="20" width="27" height="8" rx="1.5" />
        <rect x="4" y="33" width="31" height="8" rx="1.5" />
        <path d="M44 7H52L67 26V7H75V41H67L52 22V41H44V7Z" />
      </g>
      <path className="brand-logo-scan" d="M3 43H76" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
