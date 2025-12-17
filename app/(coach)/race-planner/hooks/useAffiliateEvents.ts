"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

const SESSION_STORAGE_KEY = "affiliate_session_id";

type AffiliateEventPayload = {
  eventType: "popup_open" | "click";
  productId: string;
  offerId?: string;
  country?: string | null;
  merchant?: string | null;
};

type AffiliateEventDetails = Omit<AffiliateEventPayload, "eventType">;

type LoggerOptions = {
  accessToken?: string;
};

export const useAffiliateSessionId = () => {
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const generated = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, generated);
    setSessionId(generated);
  }, []);

  return sessionId;
};

export const useAffiliateEventLogger = (options: LoggerOptions) => {
  const mutation = useMutation(async (payload: AffiliateEventPayload & { sessionId: string }) => {
    const response = await fetch("/api/affiliate/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        country: payload.country ?? undefined,
        merchant: payload.merchant ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error("Unable to record affiliate event");
    }
  });

  return useMemo(
    () => ({
      logPopupOpen: (sessionId: string, details: AffiliateEventDetails) =>
        mutation.mutateAsync({ ...details, sessionId, eventType: "popup_open" }),
      logClick: (sessionId: string, details: AffiliateEventDetails) =>
        mutation.mutateAsync({ ...details, sessionId, eventType: "click" }),
      status: mutation.status,
    }),
    [mutation]
  );
};
