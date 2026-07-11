import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold", {
  variants: {
    variant: {
      primary: "border-primary/45 bg-transparent text-primary",
      accent: "border-accent/45 bg-transparent text-accent",
      neutral: "border-white/10 bg-transparent text-zinc-200",
      success: "border-[#21F1A8]/55 bg-[#21F1A8]/15 text-[#21F1A8]",
      danger: "border-[#21F1A8]/60 bg-[#21F1A8]/15 text-[#21F1A8]",
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
