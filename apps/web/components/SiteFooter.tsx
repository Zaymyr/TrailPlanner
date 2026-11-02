"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { supportEmail } from "../app/support/copy";

const linkClass = "flex min-h-11 items-center text-sm transition hover:text-[hsl(var(--success))] dark:hover:text-emerald-200";

export function SiteFooter() {
  const pathname = usePathname();
  const isEnglishPath = pathname === "/en/partners" || pathname.startsWith("/en/");
  const partnersHref = (isEnglishPath ? "/en/partners" : "/partenaires") as Route;
  const partnersLabel = isEnglishPath ? "For brands" : "Espace marques";
  const groups = [
    { title: isEnglishPath ? "Product" : "Produit", links: [[isEnglishPath ? "Races" : "Courses", "/courses"], [isEnglishPath ? "Race planner" : "Planificateur", "/race-planner"], [isEnglishPath ? "Carb calculator" : "Calculateur glucides", "/calculateur-glucides-trail"]] },
    { title: isEnglishPath ? "Resources" : "Ressources", links: [["Blog", "/blog"], [isEnglishPath ? "Methodology" : "Méthodologie", "/methodologie"], [isEnglishPath ? "Organizers" : "Organisateurs", "/organisateurs"]] },
    { title: isEnglishPath ? "Company" : "Entreprise", links: [[isEnglishPath ? "About" : "À propos", "/a-propos"], [partnersLabel, partnersHref], ["Contact", `mailto:${supportEmail}`]] },
    { title: isEnglishPath ? "Legal" : "Légal", links: [[isEnglishPath ? "Legal notice" : "Mentions légales", "/legal/mentions-legales"], ["CGU", "/legal/cgu"], ["CGV", "/legal/cgv"], [isEnglishPath ? "Privacy" : "Confidentialité", "/legal/privacy"]] },
  ] as const;

  return (
    <footer className="border-t border-border pt-6 text-muted-foreground">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Pace Yourself</p>
          <a className={linkClass} href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="text-sm font-semibold text-foreground">{group.title}</p>
            <div className="mt-1 grid">
              {group.links.map(([label, href]) => href.startsWith("mailto:") ? (
                <a key={href} className={linkClass} href={href}>{label}</a>
              ) : (
                <Link key={href} className={linkClass} href={href as Route}>{label}</Link>
              ))}
            </div>
          </nav>
        ))}
      </div>
    </footer>
  );
}
