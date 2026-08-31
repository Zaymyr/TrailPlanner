import { z } from "zod";

const queryResponseSchema = z.object({
  results: z.array(z.array(z.unknown())),
});

export type PostHogQueryStatus = "available" | "not_configured" | "error";

function getPostHogQueryConfig() {
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  if (!personalApiKey || !projectId || !/^\d+$/.test(projectId)) return null;

  const configuredHost = process.env.POSTHOG_API_HOST?.trim();
  const ingestionHost = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  const apiHost = (configuredHost || ingestionHost || "https://us.posthog.com")
    .replace(".i.posthog.com", ".posthog.com")
    .replace(/\/$/, "");

  return { apiHost, personalApiKey, projectId };
}

export async function queryPostHog(hogql: string): Promise<{
  status: PostHogQueryStatus;
  rows: unknown[][];
}> {
  const config = getPostHogQueryConfig();
  if (!config) return { status: "not_configured", rows: [] };

  try {
    const response = await fetch(`${config.apiHost}/api/projects/${config.projectId}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.personalApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn("PostHog growth query failed", response.status);
      return { status: "error", rows: [] };
    }

    const parsed = queryResponseSchema.safeParse(await response.json());
    return parsed.success
      ? { status: "available", rows: parsed.data.results }
      : { status: "error", rows: [] };
  } catch (error) {
    console.warn("Unable to query PostHog growth analytics", error);
    return { status: "error", rows: [] };
  }
}
