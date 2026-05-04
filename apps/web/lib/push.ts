import { createClient } from "@supabase/supabase-js";

import { getSupabaseServiceConfig } from "./supabase";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const INACTIVITY_REMINDER_DELAY_MS = 72 * 60 * 60 * 1000;
const UNFINISHED_PLAN_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;
const EXPO_PUSH_CHUNK_SIZE = 100;

type PushPlatform = "ios" | "android";
type PushLocale = "fr" | "en";
type PushNotificationKind = "inactive-user" | "unfinished-plan";

type PushDeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: PushPlatform;
  locale: PushLocale;
  app_version: string | null;
  notifications_enabled: boolean;
  last_seen_at: string;
};

type PushPlanRow = {
  id: string;
  user_id: string;
  name: string;
  updated_at: string;
  planner_values: PlannerValuesLike | null;
};

type PlannerSupply = {
  productId?: string;
  quantity?: number;
};

type PlannerAidStation = {
  supplies?: PlannerSupply[] | null;
};

type PlannerValuesLike = {
  startSupplies?: PlannerSupply[] | null;
  aidStations?: PlannerAidStation[] | null;
};

type PushRegisterInput = {
  userId: string;
  expoPushToken: string;
  platform: PushPlatform;
  locale: string;
  appVersion?: string | null;
  notificationsEnabled: boolean;
};

type PendingReminder = {
  userId: string;
  pushDeviceId: string;
  expoPushToken: string;
  dedupeKey: string;
  kind: PushNotificationKind;
  planId?: string;
  href: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
};

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  data: Record<string, unknown>;
};

type ExpoPushResult = {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
};

type ReminderRunSummary = {
  disabledDeviceCount: number;
  sentCount: number;
  skippedDuplicateCount: number;
  totalCandidateCount: number;
};

function getServiceClient() {
  const supabaseService = getSupabaseServiceConfig();
  if (!supabaseService) {
    return null;
  }

  return createClient(supabaseService.supabaseUrl, supabaseService.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeLocale(locale: string): PushLocale {
  return locale.startsWith("fr") ? "fr" : "en";
}

function getPlannerSupplyCount(plannerValues?: PlannerValuesLike | null) {
  const startSupplies = Array.isArray(plannerValues?.startSupplies) ? plannerValues.startSupplies : [];
  const aidStations = Array.isArray(plannerValues?.aidStations) ? plannerValues.aidStations : [];

  return startSupplies.length + aidStations.reduce((sum, station) => {
    const supplies = Array.isArray(station?.supplies) ? station.supplies : [];
    return sum + supplies.length;
  }, 0);
}

function isIncompletePlan(plannerValues?: PlannerValuesLike | null) {
  return getPlannerSupplyCount(plannerValues) === 0;
}

function chunkArray<T>(items: T[], chunkSize: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildInactiveReminderCopy(locale: PushLocale) {
  if (locale === "fr") {
    return {
      title: "Ton prochain plan t attend",
      body: "Cela fait quelques jours. Reviens voir ton plan et reprendre ta preparation.",
    };
  }

  return {
    title: "Your next plan is waiting",
    body: "It has been a few days. Come back to review your plan and keep your build going.",
  };
}

function buildUnfinishedPlanReminderCopy(locale: PushLocale, planName: string) {
  if (locale === "fr") {
    return {
      title: "Ton plan n est pas termine",
      body: `Reviens finaliser ${planName} et ajouter tes ravitos.`,
    };
  }

  return {
    title: "Your plan is not finished yet",
    body: `Come back to finish ${planName} and add your fueling.`,
  };
}

async function fetchExistingDedupes(pushDeviceIds: string[], dedupeKeys: string[]) {
  if (pushDeviceIds.length === 0 || dedupeKeys.length === 0) {
    return new Set<string>();
  }

  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { data, error } = await client
    .from("push_notification_events")
    .select("push_device_id,dedupe_key")
    .in("push_device_id", pushDeviceIds)
    .in("dedupe_key", dedupeKeys);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ push_device_id: string; dedupe_key: string }>;
  return new Set(
    rows.map((row) => `${row.push_device_id}:${row.dedupe_key}`)
  );
}

async function storeNotificationEvents(
  reminders: PendingReminder[],
  results: ExpoPushResult[]
) {
  if (reminders.length === 0) {
    return 0;
  }

  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const rows = reminders.flatMap((reminder, index) => {
    const result = results[index];
    if (result?.status !== "ok") {
      return [];
    }

    return [
      {
        user_id: reminder.userId,
        push_device_id: reminder.pushDeviceId,
        plan_id: reminder.planId ?? null,
        notification_kind: reminder.kind,
        dedupe_key: reminder.dedupeKey,
        payload: reminder.payload,
        expo_ticket_id: result.id ?? null,
      },
    ];
  });

  if (rows.length === 0) {
    return 0;
  }

  const { error } = await client.from("push_notification_events").upsert(rows, {
    onConflict: "push_device_id,dedupe_key",
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }

  return rows.length;
}

async function disableDevicesByToken(tokens: string[]) {
  if (tokens.length === 0) {
    return 0;
  }

  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { error } = await client
    .from("push_devices")
    .update({ notifications_enabled: false })
    .in("expo_push_token", tokens);

  if (error) {
    throw error;
  }

  return tokens.length;
}

async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim() || null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const results: ExpoPushResult[] = [];
  for (const chunk of chunkArray(messages, EXPO_PUSH_CHUNK_SIZE)) {
    const response = await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(chunk),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unable to read Expo push error.");
      console.error("Expo push send failed", errorText);
      results.push(
        ...chunk.map(() => ({
          status: "error" as const,
          message: errorText,
        }))
      );
      continue;
    }

    const payload = (await response.json().catch(() => null)) as { data?: ExpoPushResult[] } | null;
    const chunkResults = Array.isArray(payload?.data) ? payload.data : [];

    if (chunkResults.length !== chunk.length) {
      results.push(
        ...chunk.map(() => ({
          status: "error" as const,
          message: "Unexpected Expo push response shape.",
        }))
      );
      continue;
    }

    results.push(...chunkResults);
  }

  return results;
}

async function fetchInactiveDevices(cutoffIso: string) {
  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { data, error } = await client
    .from("push_devices")
    .select("id,user_id,expo_push_token,platform,locale,app_version,notifications_enabled,last_seen_at")
    .eq("notifications_enabled", true)
    .lte("last_seen_at", cutoffIso);

  if (error) {
    throw error;
  }

  return (data ?? []) as PushDeviceRow[];
}

async function fetchLatestIncompletePlans(cutoffIso: string) {
  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { data, error } = await client
    .from("race_plans")
    .select("id,user_id,name,updated_at,planner_values")
    .lte("updated_at", cutoffIso)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const latestByUserId = new Map<string, PushPlanRow>();
  for (const row of (data ?? []) as PushPlanRow[]) {
    if (latestByUserId.has(row.user_id)) {
      continue;
    }

    if (!isIncompletePlan(row.planner_values)) {
      continue;
    }

    latestByUserId.set(row.user_id, row);
  }

  return [...latestByUserId.values()];
}

async function fetchEnabledDevicesForUsers(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }

  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { data, error } = await client
    .from("push_devices")
    .select("id,user_id,expo_push_token,platform,locale,app_version,notifications_enabled,last_seen_at")
    .eq("notifications_enabled", true)
    .in("user_id", userIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as PushDeviceRow[];
}

async function buildPendingReminders() {
  const inactivityCutoffIso = new Date(Date.now() - INACTIVITY_REMINDER_DELAY_MS).toISOString();
  const unfinishedPlanCutoffIso = new Date(Date.now() - UNFINISHED_PLAN_REMINDER_DELAY_MS).toISOString();

  const inactiveDevices = await fetchInactiveDevices(inactivityCutoffIso);
  const incompletePlans = await fetchLatestIncompletePlans(unfinishedPlanCutoffIso);
  const usersWithIncompletePlans = new Set(incompletePlans.map((plan) => plan.user_id));
  const devicesForIncompletePlans = await fetchEnabledDevicesForUsers(incompletePlans.map((plan) => plan.user_id));
  const devicesByUserId = new Map<string, PushDeviceRow[]>();

  devicesForIncompletePlans.forEach((device) => {
    const current = devicesByUserId.get(device.user_id) ?? [];
    current.push(device);
    devicesByUserId.set(device.user_id, current);
  });

  const pendingReminders: PendingReminder[] = [];

  inactiveDevices.forEach((device) => {
    if (usersWithIncompletePlans.has(device.user_id)) {
      return;
    }

    const locale = normalizeLocale(device.locale);
    const copy = buildInactiveReminderCopy(locale);
    pendingReminders.push({
      userId: device.user_id,
      pushDeviceId: device.id,
      expoPushToken: device.expo_push_token,
      dedupeKey: `inactive-user:${device.last_seen_at}`,
      kind: "inactive-user",
      href: "/(app)/plans",
      title: copy.title,
      body: copy.body,
      payload: {
        href: "/(app)/plans",
        kind: "inactive-user",
        lastSeenAt: device.last_seen_at,
      },
    });
  });

  incompletePlans.forEach((plan) => {
    const devices = devicesByUserId.get(plan.user_id) ?? [];
    devices.forEach((device) => {
      const locale = normalizeLocale(device.locale);
      const copy = buildUnfinishedPlanReminderCopy(locale, plan.name);
      pendingReminders.push({
        userId: device.user_id,
        pushDeviceId: device.id,
        expoPushToken: device.expo_push_token,
        dedupeKey: `unfinished-plan:${plan.id}:${plan.updated_at}`,
        kind: "unfinished-plan",
        planId: plan.id,
        href: `/(app)/plan/${plan.id}/edit`,
        title: copy.title,
        body: copy.body,
        payload: {
          href: `/(app)/plan/${plan.id}/edit`,
          kind: "unfinished-plan",
          planId: plan.id,
          planUpdatedAt: plan.updated_at,
        },
      });
    });
  });

  return pendingReminders;
}

export async function upsertPushDevice(input: PushRegisterInput) {
  const client = getServiceClient();
  if (!client) {
    throw new Error("Supabase service configuration is missing.");
  }

  const { data, error } = await client
    .from("push_devices")
    .upsert(
      {
        user_id: input.userId,
        expo_push_token: input.expoPushToken,
        platform: input.platform,
        locale: normalizeLocale(input.locale),
        app_version: input.appVersion ?? null,
        notifications_enabled: input.notificationsEnabled,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "expo_push_token",
      }
    )
    .select("id,user_id,expo_push_token,platform,locale,app_version,notifications_enabled,last_seen_at")
    .single();

  if (error) {
    throw error;
  }

  return data as PushDeviceRow;
}

export async function sendScheduledPushReminders(): Promise<ReminderRunSummary> {
  const candidates = await buildPendingReminders();
  const existingDedupes = await fetchExistingDedupes(
    candidates.map((candidate) => candidate.pushDeviceId),
    candidates.map((candidate) => candidate.dedupeKey)
  );

  const remindersToSend = candidates.filter(
    (candidate) => !existingDedupes.has(`${candidate.pushDeviceId}:${candidate.dedupeKey}`)
  );

  if (remindersToSend.length === 0) {
    return {
      disabledDeviceCount: 0,
      sentCount: 0,
      skippedDuplicateCount: candidates.length,
      totalCandidateCount: candidates.length,
    };
  }

  const results = await sendExpoPushMessages(
    remindersToSend.map<ExpoPushMessage>((reminder) => ({
      to: reminder.expoPushToken,
      title: reminder.title,
      body: reminder.body,
      sound: "default",
      data: reminder.payload,
    }))
  );

  const invalidTokens = remindersToSend.flatMap((reminder, index) => {
    const result = results[index];
    if (result?.status === "error" && result.details?.error === "DeviceNotRegistered") {
      return [reminder.expoPushToken];
    }
    return [];
  });

  const [sentCount, disabledDeviceCount] = await Promise.all([
    storeNotificationEvents(remindersToSend, results),
    disableDevicesByToken([...new Set(invalidTokens)]),
  ]);

  return {
    disabledDeviceCount,
    sentCount,
    skippedDuplicateCount: candidates.length - remindersToSend.length,
    totalCandidateCount: candidates.length,
  };
}
