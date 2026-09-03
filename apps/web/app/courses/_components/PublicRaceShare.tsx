"use client";

import { useState, type SVGProps } from "react";

export type ShareStatus = "idle" | "shared" | "copied" | "cancelled" | "error";

function ShareIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="6" cy="12" r="2.4" />
      <circle cx="18" cy="19" r="2.4" />
      <path d="m8.2 10.8 7.5-4.5M8.2 13.2l7.5 4.5" />
    </svg>
  );
}

export async function copyPublicRaceLink(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Copy unavailable");
}

export function getFacebookShareUrl(url: string) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export async function sharePublicRace(title: string, url: string): Promise<ShareStatus> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text: `Découvrez ${title} sur Pace Yourself.`, url });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return "cancelled";
    }
  }

  try {
    await copyPublicRaceLink(url);
    return "copied";
  } catch {
    return "error";
  }
}

export function PublicRaceShare({
  title,
  url,
  variant = "full",
}: {
  title: string;
  url: string;
  variant?: "full" | "icon";
}) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const facebookUrl = getFacebookShareUrl(url);

  const handleShare = async () => {
    setStatus("idle");
    const nextStatus = await sharePublicRace(title, url);
    if (nextStatus !== "cancelled") setStatus(nextStatus);
  };

  const handleCopy = async () => {
    try {
      await copyPublicRaceLink(url);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  if (variant === "icon") {
    return (
      <div className="relative inline-flex">
        <button
          type="button"
          onClick={handleShare}
          aria-label="Partager cette course"
          title="Partager cette course"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition hover:border-brand-border hover:bg-brand-surface"
        >
          <ShareIcon className="h-5 w-5" />
        </button>
        <p className="sr-only" role="status" aria-live="polite">
          {status === "shared" ? "Course partagée." : null}
          {status === "copied" ? "Lien copié." : null}
          {status === "error" ? "Impossible de copier le lien sur ce navigateur." : null}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" aria-label="Partager cette course">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleShare}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground transition hover:bg-brand-light"
        >
          <ShareIcon className="h-5 w-5" />
          Partager
        </button>
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
        >
          Facebook
        </a>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-brand-border hover:bg-brand-surface"
        >
          Copier le lien
        </button>
      </div>
      <p className="min-h-5 text-sm text-muted-foreground" role="status" aria-live="polite">
        {status === "shared" ? "Course partagée." : null}
        {status === "copied" ? "Lien copié." : null}
        {status === "error" ? "Impossible de copier le lien sur ce navigateur." : null}
      </p>
    </div>
  );
}
