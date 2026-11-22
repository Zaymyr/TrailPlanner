"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SiteFooter } from "../components/SiteFooter";
import { HeaderAuth } from "./header-auth";
import { HeaderMenu } from "./header-menu";
import { HeaderTabs } from "./header-tabs";
import { useI18n } from "./i18n-provider";

// The admin console draws its own frame (AdminShell: sidebar + top bar), so the site header and footer stay out.
const STANDALONE_PATHS = new Set(["/links", "/en/links", "/admin"]);
const STANDALONE_PREFIXES = ["/share/plan/", "/render/", "/admin/"];

type RootChromeProps = {
  children: ReactNode;
};

export function RootChrome({ children }: RootChromeProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  const skipLinkRef = useRef<HTMLAnchorElement>(null);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);

  useEffect(() => {
    const showSkipLinkForKeyboardInput = (event: KeyboardEvent) => {
      if (event.key === "Tab") setKeyboardNavigation(true);
    };
    const hideSkipLinkAfterPointerInput = () => {
      setKeyboardNavigation(false);
      skipLinkRef.current?.blur();
    };
    document.addEventListener("keydown", showSkipLinkForKeyboardInput, true);
    document.addEventListener("pointerdown", hideSkipLinkAfterPointerInput, true);
    return () => {
      document.removeEventListener("keydown", showSkipLinkForKeyboardInput, true);
      document.removeEventListener("pointerdown", hideSkipLinkAfterPointerInput, true);
    };
  }, []);

  if (STANDALONE_PATHS.has(pathname) || STANDALONE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:gap-8 lg:py-10">
      <a
        ref={skipLinkRef}
        href="#main-content"
        onFocus={(event) => {
          if (!keyboardNavigation) event.currentTarget.blur();
        }}
        className={`fixed left-4 top-4 z-[100] rounded-md bg-brand px-4 py-3 font-semibold text-brand-foreground shadow-lg transition ${keyboardNavigation ? "focus-visible:translate-y-0 focus-visible:opacity-100" : "pointer-events-none -translate-y-24 opacity-0"}`}
      >
        {t.navigation.skipToContent}
      </a>
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label={t.navigation.home} className="inline-flex flex-shrink-0">
            <Image
              src="/branding/logo-horizontal-v2.png"
              alt="Pace Yourself"
              width={213}
              height={50}
              priority
              className="h-9 w-auto sm:h-10 xl:h-15"
            />
          </Link>
          <div className="hidden min-w-0 xl:block">
            <HeaderTabs />
          </div>
        </div>
        <div className="hidden flex-shrink-0 items-center gap-4 xl:flex">
          <HeaderAuth />
        </div>
        <div className="flex flex-shrink-0 xl:hidden">
          <HeaderMenu />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="pb-6 sm:pb-8 lg:pb-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
