import * as React from "react";
import { cn } from "../utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClass = {
      default:
        "bg-emerald-500 text-slate-950 hover:bg-emerald-400 focus-visible:outline-emerald-300",
      outline:
        "border border-emerald-300 text-emerald-100 hover:bg-emerald-950/60 focus-visible:outline-emerald-300",
      ghost: "text-emerald-200 hover:bg-emerald-900/40 focus-visible:outline-emerald-300",
    }[variant];

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
          variantClass,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
