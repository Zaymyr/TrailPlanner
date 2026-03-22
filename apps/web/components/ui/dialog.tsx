"use client";

import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../utils";

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

const Dialog = ({ open, onOpenChange, children }: DialogProps) => (
  <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
);

type DialogContentProps = React.HTMLAttributes<HTMLDivElement>;

const DialogContent = ({ className, children, ...props }: DialogContentProps) => {
  const context = React.useContext(DialogContext);

  if (!context?.open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => context.onOpenChange(false)}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "relative z-10 grid w-full max-w-lg gap-4 rounded-lg border border-border bg-card p-6 text-foreground shadow-lg",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const DialogTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h2 className={cn("text-lg font-semibold", className)} {...props} />
);

const DialogDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-sm text-muted-foreground", className)} {...props} />
);

export { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle };
