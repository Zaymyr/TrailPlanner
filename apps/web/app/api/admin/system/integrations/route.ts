import { buildIntegrationServices, integrationsResponseSchema } from "../../../../../lib/admin-integrations";
import { loadEmailActivity, loadPaymentActivity } from "../../../../../lib/admin-system-health-server";
import { listCarouselRenderActivityRows, listReelRenderActivityRows, toCarouselRenderActivity, toReelRenderActivity } from "../../../../../lib/render-activity";
import { getVideoRenderConfig } from "../../../../../lib/video-render";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";

export const dynamic = "force-dynamic";

const settle = async <T>(promise: Promise<T>): Promise<T | null> => {
  try {
    return await promise;
  } catch (error) {
    console.error("Admin integrations source failed", error instanceof Error ? error.message : error);
    return null;
  }
};

/**
 * Intégrations (admin console, lot 3): per service, whether each configuration variable is present
 * (true / false, never a value), and the activity the journals already hold (e-mails, Stripe events,
 * latest renders). Instagram keeps its own route (`/api/admin/instagram`).
 */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;
  try {
    const now = new Date();
    const [emails, payments, renders] = await Promise.all([
      settle(loadEmailActivity(gate.value.supabase, now)),
      settle(loadPaymentActivity(gate.value.supabase, now)),
      settle((async () => {
        const [reels, carousels] = await Promise.all([listReelRenderActivityRows(gate.value.supabase), listCarouselRenderActivityRows(gate.value.supabase)]);
        return [...reels.map(toReelRenderActivity), ...carousels.map(toCarouselRenderActivity)]
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 5)
          .map(({ id, kind, title, status, stage, createdAt, finishedAt }) => ({ id, kind, title, status, stage, createdAt, finishedAt }));
      })()),
    ]);
    return renderJson(integrationsResponseSchema.parse({
      generatedAt: now.toISOString(),
      services: buildIntegrationServices({ env: process.env, renderConfigured: getVideoRenderConfig() !== null, emails, payments }),
      emails,
      payments,
      renders,
    }));
  } catch (error) {
    console.error("Admin integrations failed", error instanceof Error ? error.message : error);
    return renderJsonError("Les intégrations n’ont pas pu être lues.", 502);
  }
}
