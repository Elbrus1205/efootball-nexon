import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <svg
      aria-label="eFootball Nexon"
      role="img"
      viewBox="0 0 92 56"
      className={cn(
        "brand-logo-mark h-10 w-[66px] shrink-0 text-white sm:h-12 sm:w-[80px]",
        className,
      )}
    >
      <defs>
        <linearGradient id="brand-logo-gradient" x1="0" y1="0" x2="92" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#dbeafe" />
          <stop offset="1" stopColor="#67e8f9" />
        </linearGradient>
        <linearGradient id="brand-logo-accent" x1="10" y1="48" x2="82" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f59e0b" />
          <stop offset="0.48" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M12 6H80L88 14V42L80 50H12L4 42V14L12 6Z" fill="rgba(255,255,255,0.035)" stroke="url(#brand-logo-accent)" strokeWidth="2" />
      <path d="M15 12H77L82 17V39L77 44H15L10 39V17L15 12Z" fill="rgba(2,6,23,0.55)" stroke="rgba(255,255,255,0.1)" />
      <g fill="url(#brand-logo-gradient)">
        <rect x="18" y="17" width="6" height="22" rx="1.2" />
        <rect x="18" y="17" width="22" height="6" rx="1.2" />
        <rect x="18" y="26" width="19" height="5.5" rx="1.2" />
        <rect x="18" y="34" width="22" height="5.5" rx="1.2" />
        <path d="M49 17H55L68 31V17H75V39H69L56 25V39H49V17Z" />
      </g>
      <path className="brand-logo-scan" d="M13 45H79" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
