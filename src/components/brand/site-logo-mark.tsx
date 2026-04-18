import { cn } from "@/lib/utils";

type SiteLogoMarkProps = {
  className?: string;
};

export function SiteLogoMark({ className }: SiteLogoMarkProps) {
  return (
    <span
      role="img"
      aria-label="eFootball Nexon"
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center font-display text-lg font-black leading-none tracking-normal text-white sm:h-11 sm:w-11 sm:text-xl",
        className,
      )}
    >
      EN
    </span>
  );
}
