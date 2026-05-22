import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "border border-primary bg-transparent text-white hover:bg-primary hover:text-black",
        secondary: "border border-white/10 bg-[#111111] text-white hover:border-primary/60",
        outline: "border border-primary/70 bg-transparent text-white hover:bg-primary hover:text-black",
        accent: "border border-accent bg-transparent text-white hover:bg-accent hover:text-black",
        ghost: "text-white hover:bg-white/[0.04] hover:text-primary",
      },
      size: {
        default: "h-11",
        sm: "h-10 rounded-md px-3",
        lg: "h-12 rounded-md px-6 text-base",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
