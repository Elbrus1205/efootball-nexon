import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
  idPrefix?: string;
};

export function SiteLogoMark({ className, idPrefix = "en-logo" }: SiteLogoMarkProps) {
  const bgGradient = `${idPrefix}-bg`;
  const letterGradient = `${idPrefix}-letters`;
  const strokeGradient = `${idPrefix}-stroke`;
  const glowFilter = `${idPrefix}-glow`;

  return (
    <svg
      className={cn("site-logo-mark h-10 w-10 shrink-0 sm:h-11 sm:w-11", className)}
      viewBox="0 0 96 96"
      role="img"
      aria-label="eFootball Nexon"
    >
      <defs>
        <linearGradient id={bgGradient} x1="12" y1="8" x2="84" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0e1b2e" />
          <stop offset="0.48" stopColor="#08111f" />
          <stop offset="1" stopColor="#1f1706" />
        </linearGradient>
        <linearGradient id={letterGradient} x1="18" y1="18" x2="78" y2="78" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.42" stopColor="#3b82f6" />
          <stop offset="0.64" stopColor="#facc15" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <linearGradient id={strokeGradient} x1="14" y1="10" x2="82" y2="88" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#60a5fa" />
          <stop offset="0.52" stopColor="#2563eb" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <filter id={glowFilter} x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="3.5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="0 0 0 0 0.24 0 0 0 0 0.55 0 0 0 0 1 0 0 0 0.72 0"
            result="blueGlow"
          />
          <feMerge>
            <feMergeNode in="blueGlow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect width="96" height="96" rx="26" fill={`url(#${bgGradient})`} />
      <rect x="1.5" y="1.5" width="93" height="93" rx="24.5" fill="none" stroke={`url(#${strokeGradient})`} strokeOpacity="0.38" strokeWidth="3" />
      <path className="site-logo-grid" d="M15 65H82M20 33H76M48 13V83M27 77L70 20" stroke="#60a5fa" strokeOpacity="0.18" strokeWidth="2" />
      <path className="site-logo-pitch" d="M16 72L36 58H60L80 72M31 42H65M38 42V54H58V42" fill="none" stroke="#facc15" strokeOpacity="0.16" strokeWidth="2" />

      <g className="site-logo-glow" filter={`url(#${glowFilter})`}>
        <path
          className="site-logo-letter site-logo-letter-e"
          d="M19 24H49V34H31V42H47V52H31V62H51V72H19V24Z"
          fill={`url(#${letterGradient})`}
        />
        <path
          className="site-logo-letter site-logo-letter-n"
          d="M55 24H66L78 52V24H88V72H77L65 44V72H55V24Z"
          fill={`url(#${letterGradient})`}
        />
      </g>

      <path className="site-logo-shine" d="M-12 76L72 -8" stroke="rgba(255,255,255,0.46)" strokeWidth="9" strokeLinecap="round" />
      <circle className="site-logo-dot site-logo-dot-blue" cx="20" cy="20" r="2.5" fill="#60a5fa" />
      <circle className="site-logo-dot site-logo-dot-gold" cx="78" cy="76" r="2.5" fill="#facc15" />
    </svg>
  );
}
