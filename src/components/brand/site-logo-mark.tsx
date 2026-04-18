import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
  idPrefix?: string;
};

export function SiteLogoMark({ className, idPrefix = "en-logo" }: SiteLogoMarkProps) {
  const bgGradient = `${idPrefix}-bg`;
  const letterGradient = `${idPrefix}-letters`;
  const borderGradient = `${idPrefix}-border`;
  const accentGradient = `${idPrefix}-accent`;
  const glowFilter = `${idPrefix}-glow`;

  return (
    <svg
      className={cn("site-logo-mark h-10 w-10 shrink-0 sm:h-11 sm:w-11", className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label="eFootball Nexon"
    >
      <defs>
        <linearGradient id={bgGradient} x1="16" y1="10" x2="80" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#101827" />
          <stop offset="0.58" stopColor="#080d16" />
          <stop offset="1" stopColor="#05070c" />
        </linearGradient>
        <linearGradient id={letterGradient} x1="20" y1="22" x2="79" y2="74" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="0.45" stopColor="#60a5fa" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={borderGradient} x1="11" y1="8" x2="85" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.55" stopColor="#1d4ed8" stopOpacity="0.75" />
          <stop offset="1" stopColor="#facc15" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id={accentGradient} x1="22" y1="76" x2="78" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563eb" stopOpacity="0" />
          <stop offset="0.42" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#facc15" />
        </linearGradient>
        <filter id={glowFilter} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.18 0 0 0 0 0.44 0 0 0 0 0.95 0 0 0 0.58 0"
            result="logoGlow"
          />
          <feMerge>
            <feMergeNode in="logoGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="96" height="96" rx="24" fill={`url(#${bgGradient})`} />
      <rect x="1.5" y="1.5" width="93" height="93" rx="22.5" fill="none" stroke={`url(#${borderGradient})`} strokeOpacity="0.62" strokeWidth="3" />
      <path className="site-logo-backline" d="M18 70H77M20 26H66M75 24L25 75" stroke="#60a5fa" strokeOpacity="0.14" strokeWidth="2" />

      <g className="site-logo-glow" filter={`url(#${glowFilter})`}>
        <path
          className="site-logo-letter"
          d="M18 23H52V34H31V42H49V52H31V62H54V73H18V23Z"
          fill={`url(#${letterGradient})`}
        />
        <path
          className="site-logo-letter"
          d="M57 23H68L80 52V23H91V73H79L68 46V73H57V23Z"
          fill={`url(#${letterGradient})`}
        />
      </g>

      <path className="site-logo-accent" d="M22 78H78" stroke={`url(#${accentGradient})`} strokeWidth="4" strokeLinecap="round" />
      <path className="site-logo-scan" d="M-10 72L68 -6" stroke="rgba(219,234,254,0.38)" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
