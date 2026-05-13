"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { ThemeToggle } from "../components/ThemeToggle";
import { HeaderAuth } from "./header-auth";
import { HeaderTabs } from "./header-tabs";
import { LanguageToggle } from "./language-toggle";

const STANDALONE_PATHS = new Set(["/links", "/en/links"]);

type RootChromeProps = {
  children: ReactNode;
};

export function RootChrome({ children }: RootChromeProps) {
  const pathname = usePathname();

  if (STANDALONE_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:gap-8 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-shrink-0 items-center gap-4">
          <Link href="/" aria-label="Go to home" className="inline-flex flex-shrink-0">
            <Image
              src="/branding/logo-horizontal-v2.png"
              alt="Pace Yourself"
              width={213}
              height={50}
              priority
              unoptimized
              className="h-10 w-auto sm:h-15"
            />
          </Link>
          <HeaderTabs />
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          <LanguageToggle />
          <ThemeToggle />
          <HeaderAuth />
        </div>
      </header>
      <main className="pb-6 sm:pb-8 lg:pb-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
