import * as React from "react";
import { cn } from "../utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-10 w-full rounded-md border border-slate-800 bg-slate-900/80 px-3 text-sm text-slate-50 shadow-sm transition placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400",
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = "Input";
