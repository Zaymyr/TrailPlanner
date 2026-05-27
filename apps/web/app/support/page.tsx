import type { Metadata } from "next";
import Link from "next/link";

const supportEmail = "faustin@pace-yourself.com";

export const metadata: Metadata = {
  title: "Support | Pace Yourself",
  description: "Get help with Pace Yourself accounts, race plans, subscriptions, and mobile app issues.",
};

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-4">
      <header className="max-w-2xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Support</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          How can we help?
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          For account access, race plan issues, GPX imports, subscriptions, or anything that feels
          off in the app, contact Pace Yourself support directly.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Email support</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Send a message with the device you use, the screen where the issue happened, and the
            steps that led to it. Screenshots are welcome when they help explain the problem.
          </p>
          <a
            href={`mailto:${supportEmail}?subject=Pace%20Yourself%20support`}
            className="mt-5 inline-flex rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:bg-brand/90"
          >
            {supportEmail}
          </a>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Response time</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            We usually reply within two business days. Urgent account or payment issues are handled
            first.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            You can also send feedback from the mobile app when you are signed in.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground">Useful links</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/sign-in"
            className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            Sign in to your account
          </Link>
          <Link
            href="/legal/privacy"
            className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            Privacy policy
          </Link>
          <Link
            href="/legal/cgu"
            className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            Terms of use
          </Link>
          <Link
            href="/"
            className="rounded-md border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:border-brand hover:text-brand"
          >
            Back to Pace Yourself
          </Link>
        </div>
      </section>
    </div>
  );
}
