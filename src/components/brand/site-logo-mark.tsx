import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <svg
      aria-label="eFootball Nexon"
      role="img"
      viewBox="0 0 120 72"
      className={cn(
        "h-10 w-14 shrink-0 text-white sm:h-11 sm:w-16",
        className,
      )}
    >
      <path fill="currentColor" d="M4 8H56V22H22V30H50V43H22V50H58V64H4V8Z" />
      <path fill="currentColor" d="M66 8H82L104 42V8H116V64H100L78 30V64H66V8Z" />
    </svg>
  );
}
