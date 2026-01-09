import * as React from "react";
import { cn } from "../utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "ghost";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClass = {
      default:
        "bg-[hsl(var(--brand))] text-[hsl(var(--brand-foreground))] hover:bg-[hsl(var(--brand)/0.9)] dark:bg-emerald-500 dark:text-foreground dark:hover:bg-emerald-400",
      outline:
        "border border-border text-[hsl(var(--success))] hover:bg-muted hover:text-foreground dark:text-emerald-100 dark:hover:bg-emerald-950/60",
      ghost:
        "text-[hsl(var(--success))] hover:bg-muted hover:text-foreground dark:text-emerald-200 dark:hover:bg-emerald-900/40",
    }[variant];

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          variantClass,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
