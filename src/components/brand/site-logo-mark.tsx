import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <svg
      aria-label="eFootball Nexon"
      role="img"
      viewBox="0 0 96 96"
      className={cn(
        "brand-logo-mark h-10 w-10 shrink-0 text-white sm:h-12 sm:w-12",
        className,
      )}
    >
      <defs>
        <linearGradient id="brand-logo-border" x1="14" y1="8" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b8ffe5" />
          <stop offset="0.52" stopColor="#21f1a8" />
          <stop offset="1" stopColor="#0d9b6b" />
        </linearGradient>
        <linearGradient id="brand-logo-n" x1="53" y1="24" x2="77" y2="70" gradientUnits="userSpaceOnUse">
          <stop stopColor="#b8ffe5" />
          <stop offset="0.5" stopColor="#21f1a8" />
          <stop offset="1" stopColor="#11b77d" />
        </linearGradient>
      </defs>
      <path d="M48 6 82 19v31c0 19-13.4 33.2-34 40C27.4 83.2 14 69 14 50V19L48 6Z" fill="#0b1210" stroke="url(#brand-logo-border)" strokeWidth="2.4" />
      <path d="M48 13 75 23v27c0 14.7-9.8 26.2-27 32.4C30.8 76.2 21 64.7 21 50V23l27-10Z" fill="rgba(255,255,255,0.025)" stroke="rgba(255,255,255,0.1)" />
      <g>
        <path d="M27 29h22v8H36v6h11v8H36v7h14v8H27V29Z" fill="#f4faf7" />
        <path d="M55 29h8l8 14V29h8v37h-8l-8-14v14h-8V29Z" fill="url(#brand-logo-n)" />
      </g>
      <path className="brand-logo-scan" d="M28 74h40" stroke="url(#brand-logo-border)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
