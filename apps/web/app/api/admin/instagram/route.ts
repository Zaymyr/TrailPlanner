import { getInstagramAccount, toPublicAccount } from "../../../../lib/instagram/accounts";
import { getInstagramAppConfig, isInstagramPublishDryRun } from "../../../../lib/instagram/config";
import { getSocialTokenKey } from "../../../../lib/instagram/crypto";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../lib/video-render-api";

/** Connection card: the connected account (never its token) and the publishing mode. */
export async function GET(request: Request) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  try {
    const account = await getInstagramAccount(gate.value.supabase);
    return renderJson({
      account: toPublicAccount(account),
      dryRun: isInstagramPublishDryRun(),
      appConfigured: getInstagramAppConfig() !== null,
      encryptionConfigured: getSocialTokenKey() !== null,
    });
  } catch (error) {
    console.error("Instagram account read failed", error instanceof Error ? error.message : error);
    return renderJsonError("Le compte Instagram n’a pas pu être lu.", 502);
  }
}
