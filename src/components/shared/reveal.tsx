import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(className)}
      data-reveal-delay={delay || undefined}
    >
      {children}
    </div>
  );
}
