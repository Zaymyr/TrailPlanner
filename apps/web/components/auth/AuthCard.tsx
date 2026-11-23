import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import { Button } from "../ui/button";

/**
 * Shared layout of the account pages (sign-in, sign-up, forgot/reset password, OAuth callback).
 * Light theme tokens only: a narrow card, a bold title and readable status colors on the cream background.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  /** Secondary navigation under the card body (e.g. « Pas encore de compte ? Créer un compte »). */
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md">
      <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-6 text-foreground shadow-sm sm:p-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold leading-tight text-foreground">{title}</h1>
          {description ? <p className="text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </header>
        {children}
      </section>
      {footer ? <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div> : null}
    </div>
  );
}

/** Field-level or form-level error, readable on a white card. */
export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm font-medium text-pace-semantic-danger">
      {children}
    </p>
  );
}

/** Positive feedback (account created, email sent, redirecting…). */
export function AuthSuccess({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="text-sm font-medium text-brand">
      {children}
    </p>
  );
}

/** Highlighted block for a state that blocks the form (invalid link, failed OAuth return). */
export function AuthNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-pace-semantic-warning/40 bg-pace-semantic-warningSurface p-4 text-sm text-foreground">
      {children}
    </div>
  );
}

export function AuthTextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href as Route} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function OAuthButtons({
  googleLabel,
  appleLabel,
  onGoogle,
  onApple,
  error,
}: {
  googleLabel: string;
  appleLabel: string;
  onGoogle: () => void;
  onApple: () => void;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="h-12 rounded-xl bg-card text-sm font-semibold" onClick={onGoogle}>
        {googleLabel}
      </Button>
      <Button
        type="button"
        className="h-12 rounded-xl bg-foreground text-sm font-semibold text-background hover:bg-foreground/90"
        onClick={onApple}
      >
        {appleLabel}
      </Button>
      {error ? <AuthError>{error}</AuthError> : null}
    </div>
  );
}

/** Class names for the inputs and the primary submit button of the auth forms (16 px text: no iOS zoom). */
export const authInputClassName = "h-12 rounded-xl text-base sm:text-sm";
export const authSubmitClassName = "h-12 w-full rounded-xl text-base font-semibold";
