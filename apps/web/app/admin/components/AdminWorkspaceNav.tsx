import type { Route } from "next";
import Link from "next/link";

const STEPS = [
  { key: "generate", href: "/admin/video-generator", label: "1 · Générer une vidéo" },
  { key: "publish", href: "/admin/publications", label: "2 · Publier" },
] as const;

/** Switch between the two reel steps (video generator, Instagram publications), plus the way back. */
export function AdminWorkspaceNav({ current }: { current: (typeof STEPS)[number]["key"] }) {
  return (
    <nav aria-label="Étapes du reel" className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-full border border-border bg-card p-1">
        {STEPS.map((step) => (
          <Link
            key={step.key}
            href={step.href as Route}
            aria-current={step.key === current ? "page" : undefined}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              step.key === current ? "bg-brand text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {step.label}
          </Link>
        ))}
      </div>
      <Link href={"/admin" as Route} className="text-sm font-medium text-brand underline-offset-4 hover:underline dark:text-emerald-200">
        Administration
      </Link>
    </nav>
  );
}
