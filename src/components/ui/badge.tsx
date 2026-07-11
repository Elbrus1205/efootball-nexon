import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      primary: "border-primary/45 bg-transparent text-primary",
      accent: "border-accent/45 bg-transparent text-accent",
      neutral: "border-white/10 bg-transparent text-zinc-200",
      success: "border-emerald-400/50 bg-emerald-400/10 text-emerald-200",
      danger: "border-rose-400/50 bg-rose-400/10 text-rose-200",
    },
  },
  defaultVariants: {
    variant: "neutral",
  },
});

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
