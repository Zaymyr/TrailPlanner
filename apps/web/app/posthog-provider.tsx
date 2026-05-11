"use client";

import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { useVerifiedSession } from "./hooks/useVerifiedSession";
import { canLoadAnalytics, COOKIE_CONSENT_EVENT } from "../lib/cookies/consent";
import {
  ensurePostHogBrowserInit,
  getPostHogBrowserClient,
  hasPostHogBrowserKey,
  isPostHogBrowserReady,
} from "../lib/posthog-browser";
import { buildSanitizedAnalyticsPath } from "../lib/posthog-config";

function PostHogPageView({ isAnalyticsEnabled }: { isAnalyticsEnabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const ph = usePostHog();

  useEffect(() => {
    if (!pathname || !ph || !isAnalyticsEnabled) return;

    const sanitizedPath = buildSanitizedAnalyticsPath(pathname, searchParams);
    const currentUrl =
      typeof window === "undefined"
        ? sanitizedPath
        : `${window.location.origin}${sanitizedPath}`;

    ph.capture("$pageview", { $current_url: currentUrl });
  }, [isAnalyticsEnabled, pathname, searchParams, ph]);

  return null;
}

function PostHogConsentManager({
  onConsentChange,
}: {
  onConsentChange: (isEnabled: boolean) => void;
}) {
  const ph = usePostHog();

  useEffect(() => {
    const handleConsentChange = () => {
      const isEnabled = canLoadAnalytics();
      onConsentChange(isEnabled);

      if (!ph || !isPostHogBrowserReady()) {
        return;
      }

      if (isEnabled) {
        ph.opt_in_capturing();
      } else {
        ph.opt_out_capturing();
      }
    };

    handleConsentChange();
    window.addEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, handleConsentChange);
  }, [onConsentChange, ph]);

  return null;
}

function PostHogSessionSync() {
  const ph = usePostHog();
  const { session, isLoading } = useVerifiedSession();
  const identifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ph || isLoading) {
      return;
    }

    if (session?.id && !session.isAnonymous) {
      ph.identify(session.id, {
        email: session.email,
        role: session.role,
      });
      identifiedUserIdRef.current = session.id;
      return;
    }

    if (identifiedUserIdRef.current !== null) {
      ph.reset();
      identifiedUserIdRef.current = null;
    }
  }, [isLoading, ph, session?.email, session?.id, session?.isAnonymous, session?.role]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const [isAnalyticsEnabled, setIsAnalyticsEnabled] = useState(() => canLoadAnalytics());
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    if (!isAnalyticsEnabled) {
      setIsClientReady(false);
      return;
    }

    const initialized = ensurePostHogBrowserInit(isAnalyticsEnabled);
    setIsClientReady(initialized);
  }, [isAnalyticsEnabled]);

  if (!hasPostHogBrowserKey()) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={getPostHogBrowserClient()}>
      <PostHogConsentManager onConsentChange={setIsAnalyticsEnabled} />
      <PostHogSessionSync />
      <Suspense fallback={null}>
        <PostHogPageView isAnalyticsEnabled={isAnalyticsEnabled && isClientReady} />
      </Suspense>
      {children}
    </PHProvider>
  );
}
