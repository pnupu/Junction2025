import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary Wolt blue button
        default: "rounded-xl bg-[#029DE2] text-white hover:bg-[#0287C3]",
        // White button (for use on blue backgrounds)
        white: "rounded-xl bg-white text-[#029DE2] hover:bg-white/90",
        // Outline button with Wolt blue
        outline:
          "rounded-xl border-2 border-[#029DE2] bg-white text-[#029DE2] hover:bg-[#029DE2] hover:text-white",
        // Option button (for selectable choices)
        option:
          "rounded-xl border-2 border-[#029DE2] bg-[#EDF7FF] text-[#029DE2] hover:bg-[#029DE2] hover:text-white",
        // Selected option button
        selected: "rounded-xl border-2 border-[#029DE2] bg-[#029DE2] text-white shadow-md",
        // Icon/Close button
        icon: "rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur-sm hover:scale-110 hover:bg-white",
        // Ghost button
        ghost: "hover:bg-slate-100 text-[#0F172B]",
        // Disabled/Success state (green)
        success: "rounded-xl bg-green-600 text-white cursor-not-allowed",
        // Destructive button
        destructive:
          "rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Secondary button
        secondary:
          "rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-12 px-6 text-base",
        sm: "h-7 px-3 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8",
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
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
