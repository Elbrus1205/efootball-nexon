import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      primary: "bg-primary/15 text-primary",
      accent: "bg-accent/15 text-accent",
      neutral: "bg-white/10 text-zinc-200",
      success: "bg-emerald-500/15 text-emerald-400",
      danger: "bg-rose-500/15 text-rose-400",
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
