import { z } from "zod";

import { type TrialStatus } from "./trial";

const trialRowSchema = z.array(
  z.object({
    trial_started_at: z.string().nullable().optional(),
    trial_ends_at: z.string().nullable().optional(),
    trial_welcome_seen_at: z.string().nullable().optional(),
  })
);

type TrialRow = z.infer<typeof trialRowSchema>[number];

type TrialStorageParams = {
  supabaseUrl: string;
  supabaseKey: string;
  token: string;
  userId: string;
};

const buildHeaders = (supabaseKey: string, token: string, contentType = "application/json") => ({
  apikey: supabaseKey,
  Authorization: `Bearer ${token}`,
  ...(contentType ? { "Content-Type": contentType } : {}),
});

const fetchTrialRow = async ({ supabaseUrl, supabaseKey, token, userId }: TrialStorageParams): Promise<TrialRow | null> => {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/user_profiles?select=trial_started_at,trial_ends_at,trial_welcome_seen_at&user_id=eq.${encodeURIComponent(
      userId
    )}&limit=1`,
    {
      headers: buildHeaders(supabaseKey, token, undefined),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to load trial profile");
  }

  return trialRowSchema.parse(await response.json())?.[0] ?? null;
};

const mapTrialRow = (row: TrialRow | null): TrialStatus => ({
  trialStartedAt: row?.trial_started_at ?? null,
  trialEndsAt: row?.trial_ends_at ?? null,
  trialWelcomeSeenAt: row?.trial_welcome_seen_at ?? null,
});

// Historical trials remain readable. Missing dates must never start a new trial.
export const ensureTrialStatus = async (params: TrialStorageParams): Promise<TrialStatus> => {
  return mapTrialRow(await fetchTrialRow(params));
};

export const markTrialWelcomeSeen = async (
  params: TrialStorageParams,
  timestamp = new Date()
): Promise<string> => {
  const seenAt = timestamp.toISOString();
  const response = await fetch(
    `${params.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(
      params.userId
    )}&trial_welcome_seen_at=is.null`,
    {
      method: "PATCH",
      headers: {
        ...buildHeaders(params.supabaseKey, params.token),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ trial_welcome_seen_at: seenAt }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to mark trial welcome as seen");
  }

  return seenAt;
};

export const markTrialExpiredSeen = async (
  params: TrialStorageParams,
  timestamp = new Date()
): Promise<string> => {
  const seenAt = timestamp.toISOString();
  const response = await fetch(
    `${params.supabaseUrl}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(params.userId)}`,
    {
      method: "PATCH",
      headers: {
        ...buildHeaders(params.supabaseKey, params.token),
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ trial_expired_seen_at: seenAt }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Unable to mark trial expired as seen");
  }

  return seenAt;
};
