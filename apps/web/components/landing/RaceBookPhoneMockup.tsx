"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type RaceBookPhoneMockupProps = {
  /** Wrapper sizing classes (max width, alignment). */
  className?: string;
  /** Adds the overlapping Livret supporter card (organizer page). */
  showSupporterCard?: boolean;
};

const supporterPreviewRows = [
  { tag: "Départ · Programme", title: "Départ de l’ultra" },
  { tag: "Ravito · km 18", title: "Ravito du col" },
  { tag: "Suivi · km 24", title: "Point de suivi" },
] as const;

export function RaceBookPhoneMockup({
  className = "mx-auto w-full max-w-[260px]",
  showSupporterCard = false,
}: RaceBookPhoneMockupProps) {
  const [isHeroVideoPlaying, setIsHeroVideoPlaying] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => {
      if (reducedMotion.matches) {
        heroVideoRef.current?.pause();
        setIsHeroVideoPlaying(false);
      }
    };
    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);
    return () => reducedMotion.removeEventListener("change", syncMotionPreference);
  }, []);

  const toggleHeroVideo = () => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play().catch(() => setIsHeroVideoPlaying(false));
    } else {
      video.pause();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative overflow-hidden rounded-[2.2rem] border border-foreground/10 bg-foreground p-2.5 shadow-2xl shadow-[rgba(45,80,22,0.22)] dark:border-emerald-300/15 dark:bg-emerald-950">
        <div className="flex items-center justify-between px-3 py-2 text-background dark:text-emerald-50">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-background/60 dark:text-emerald-100/60">Aperçu réel</p>
            <p className="text-sm font-semibold">Trail TST</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-background/10 px-2.5 py-1 text-[0.68rem] font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Livret coureur
          </span>
        </div>
        <div className="relative aspect-[540/1212] overflow-hidden rounded-[1.55rem] bg-card">
          <Image
            src="/landing/organisateurs/racebook-demo-poster.webp"
            alt="Aperçu du Livret coureur Trail TST affichant le tracé de l’Ultra des Cimes"
            fill
            priority
            sizes="(min-width: 1024px) 290px, (min-width: 768px) 260px, 280px"
            className="object-cover"
          />
          <video
            ref={heroVideoRef}
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/landing/organisateurs/racebook-demo-poster.webp"
            aria-label="Démonstration du Livret coureur Trail TST, du catalogue aux informations de course"
            onPlay={() => setIsHeroVideoPlaying(true)}
            onPause={() => setIsHeroVideoPlaying(false)}
          >
            <source src="/landing/organisateurs/racebook-demo.mp4" type="video/mp4" />
          </video>
          <button
            type="button"
            onClick={toggleHeroVideo}
            className="absolute bottom-3 right-3 inline-flex min-h-9 items-center justify-center rounded-full border border-white/30 bg-slate-950/75 px-3 text-xs font-semibold text-white shadow-lg backdrop-blur transition hover:bg-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            aria-label={isHeroVideoPlaying ? "Mettre en pause la démonstration" : "Lire la démonstration"}
          >
            {isHeroVideoPlaying ? "Pause" : "Lire"}
          </button>
        </div>
      </div>

      {showSupporterCard ? (
        <figure
          className="absolute -bottom-6 -left-6 w-[64%] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-[rgba(45,80,22,0.25)] sm:-left-12 md:-left-16"
          aria-label="Illustration du Livret supporter : programme, ravitos et points de suivi"
        >
          <div className="bg-brand px-3 pb-2.5 pt-3 text-brand-foreground dark:bg-emerald-800 dark:text-emerald-50">
            <p className="text-[0.55rem] font-semibold uppercase tracking-[0.16em] opacity-80">Livret supporter</p>
            <p className="text-sm font-semibold leading-tight">Suivre la course</p>
          </div>
          <ol className="space-y-1.5 p-2.5">
            {supporterPreviewRows.map((row) => (
              <li key={row.tag} className="rounded-lg border border-border bg-background/70 px-2 py-1.5">
                <span className="block text-[0.55rem] font-semibold uppercase tracking-wide text-brand dark:text-emerald-200">{row.tag}</span>
                <span className="block truncate text-xs font-semibold text-foreground">{row.title}</span>
              </li>
            ))}
          </ol>
          <figcaption className="border-t border-border px-2.5 py-1.5 text-[0.6rem] font-medium text-muted-foreground">Partagé par lien ou QR code</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
