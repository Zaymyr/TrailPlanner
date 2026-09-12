"use client";

import { useEffect, useId, useRef, useState } from "react";

import { COOKIE_CONSENT_EVENT, getCookieConsent } from "../../lib/cookies/consent";
import {
  clampSpotlightRect,
  getOnboardingModalTop,
  SPOTLIGHT_OVERLAY_ATTRIBUTE,
  SPOTLIGHT_OVERLAY_EVENT,
} from "../../lib/spotlight-overlay";
import { Button } from "../ui/button";

export type OnboardingOverlayCopy = {
  closeLabel: string;
  stepOf: string;
  next: string;
  previous: string;
  finish: string;
  steps: ReadonlyArray<{ title: string; description: string }>;
};

type SpotlightRect = { x: number; y: number; width: number; height: number };

type Props = {
  open: boolean;
  step: number;
  copy: OnboardingOverlayCopy;
  targetId: string | null;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  secondaryFinishAction?: { label: string; onClick: () => void };
};

const PAD = 12;
const SETTLE_MS = 430;
export function OnboardingOverlay({
  open,
  step,
  copy,
  targetId,
  onClose,
  onNext,
  onPrevious,
  secondaryFinishAction,
}: Props) {
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [dialogHeight, setDialogHeight] = useState(290);
  const [isConsentReady, setIsConsentReady] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isPresented = open && isConsentReady;

  useEffect(() => {
    if (!open) {
      setIsConsentReady(false);
      return;
    }
    const updateConsent = () => setIsConsentReady(getCookieConsent() !== null);
    updateConsent();
    window.addEventListener(COOKIE_CONSENT_EVENT, updateConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, updateConsent);
  }, [open]);

  useEffect(() => {
    if (!isPresented) return;
    document.documentElement.setAttribute(SPOTLIGHT_OVERLAY_ATTRIBUTE, "open");
    window.dispatchEvent(new CustomEvent(SPOTLIGHT_OVERLAY_EVENT, { detail: { open: true } }));
    return () => {
      document.documentElement.removeAttribute(SPOTLIGHT_OVERLAY_ATTRIBUTE);
      window.dispatchEvent(new CustomEvent(SPOTLIGHT_OVERLAY_EVENT, { detail: { open: false } }));
    };
  }, [isPresented]);

  useEffect(() => {
    if (!isPresented) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isPresented, onClose]);

  useEffect(() => {
    if (!isPresented) return;
    const focusTimer = window.setTimeout(() => titleRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [isPresented, step]);

  useEffect(() => {
    if (!isPresented || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const updateHeight = () => {
      const nextHeight = Math.ceil(dialog.getBoundingClientRect().height);
      setDialogHeight((current) => current === nextHeight ? current : nextHeight);
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(dialog);
    return () => observer.disconnect();
  }, [isPresented, spotlight, step]);

  useEffect(() => {
    if (!isPresented) {
      setSpotlight(null);
      return;
    }
    setSpotlight(null);
    let timer: ReturnType<typeof setTimeout> | null = null;
    let targetObserver: ResizeObserver | null = null;

    const findVisible = (id: string): Element | null => {
      for (const node of Array.from(document.querySelectorAll(`[id="${id}"]`))) {
        const rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) return node;
      }
      return null;
    };
    const resolveTarget = () => targetId ? findVisible(targetId) : null;
    const measure = (target: Element) => {
      const rect = target.getBoundingClientRect();
      setSpotlight(clampSpotlightRect({
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        dialogHeight,
      }));
    };

    const rafId = requestAnimationFrame(() => {
      const target = resolveTarget();
      if (!target) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      const rect = target.getBoundingClientRect();
      const visiblePadding = 100;
      const isInViewport = rect.top >= visiblePadding && rect.bottom <= window.innerHeight - visiblePadding;
      if (!isInViewport) {
        target.scrollIntoView({
          behavior: "smooth",
          block: rect.height > window.innerHeight - visiblePadding * 2 ? "start" : "center",
        });
      }
      timer = setTimeout(() => {
        const visible = resolveTarget();
        if (!visible) return;
        measure(visible);
        targetObserver = new ResizeObserver(() => measure(visible));
        targetObserver.observe(visible);
      }, SETTLE_MS);
    });

    const handleViewportChange = () => {
      const target = resolveTarget();
      if (target) measure(target);
    };
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    return () => {
      cancelAnimationFrame(rafId);
      if (timer !== null) clearTimeout(timer);
      targetObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
    };
  }, [dialogHeight, isPresented, step, targetId]);

  if (!isPresented) return null;

  const totalSteps = copy.steps.length;
  const currentStep = copy.steps[step];
  const isFirst = step === 0;
  const isLast = step === totalSteps - 1;
  const stepLabel = copy.stepOf.replace("{current}", String(step + 1)).replace("{total}", String(totalSteps));
  const modalTop = spotlight ? getOnboardingModalTop({ spotlight, viewportHeight: window.innerHeight, dialogHeight }) : null;
  const cardClass = "pointer-events-auto relative w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900/90";
  const cardContent = (
    <>
      <div className="mb-4 flex items-center justify-between pr-8">
        <span className="text-xs font-medium text-muted-foreground">{stepLabel}</span>
        <Button type="button" variant="ghost" className="absolute right-2 top-2 h-8 w-8 p-0 text-lg text-foreground dark:text-slate-200" aria-label={copy.closeLabel} title={copy.closeLabel} onClick={onClose}>&times;</Button>
      </div>
      <h2 ref={titleRef} tabIndex={-1} id={titleId} className="text-xl font-semibold text-foreground outline-none dark:text-slate-50">{currentStep.title}</h2>
      <p id={descriptionId} className="mt-3 text-sm leading-relaxed text-muted-foreground">{currentStep.description}</p>
      <div className="mt-6 flex items-center justify-center gap-2" aria-hidden="true">
        {copy.steps.map((_, index) => <span key={index} className={`h-2 w-2 rounded-full transition-colors ${index === step ? "bg-primary" : index < step ? "bg-primary/40" : "bg-muted-foreground/30"}`} />)}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div>{!isFirst ? <Button type="button" variant="ghost" onClick={onPrevious}>{copy.previous}</Button> : null}</div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isLast && secondaryFinishAction ? <Button type="button" variant="outline" onClick={onNext}>{copy.finish}</Button> : null}
          <Button type="button" onClick={isLast && secondaryFinishAction ? secondaryFinishAction.onClick : onNext}>
            {isLast && secondaryFinishAction ? secondaryFinishAction.label : isLast ? copy.finish : copy.next}
          </Button>
        </div>
      </div>
    </>
  );
  const dialog = <div ref={dialogRef} className={cardClass} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}>{cardContent}</div>;

  return (
    <>
      <div className="fixed inset-0 z-50" aria-hidden="true" />
      <svg className="pointer-events-none fixed inset-0 z-50 h-full w-full" aria-hidden="true">
        {spotlight ? <defs><mask id="tutorial-spotlight-mask"><rect width="100%" height="100%" fill="white" /><rect x={spotlight.x - PAD} y={spotlight.y - PAD} width={spotlight.width + PAD * 2} height={spotlight.height + PAD * 2} rx="8" fill="black" /></mask></defs> : null}
        <rect width="100%" height="100%" fill="rgba(15, 23, 42, 0.38)" mask={spotlight ? "url(#tutorial-spotlight-mask)" : undefined} />
      </svg>
      {spotlight ? <div aria-hidden="true" className="pointer-events-none fixed z-50 rounded-lg tutorial-spotlight-ring" style={{ left: spotlight.x - PAD, top: spotlight.y - PAD, width: spotlight.width + PAD * 2, height: spotlight.height + PAD * 2 }} /> : null}
      {spotlight
        ? <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ top: modalTop ?? 0 }}>{dialog}</div>
        : <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-4">{dialog}</div>}
    </>
  );
}
