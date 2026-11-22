"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Mobile sticky "Estimer mon temps" bar. It stays hidden while the hero's own
 * estimate button (`targetId`) is on screen, so the same call to action is
 * never shown twice, and appears once that button has scrolled away.
 */
export function StickyEstimateBar({ href, targetId }: { href: string; targetId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(!entry?.isIntersecting));
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "pointer-events-none translate-y-full"
      }`}
    >
      <Link
        href={href as Route}
        data-estimate-placement="sticky_bar"
        tabIndex={visible ? undefined : -1}
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5 text-base font-semibold text-brand-foreground transition hover:bg-brand-light"
      >
        Estimer mon temps — gratuit
      </Link>
    </div>
  );
}
