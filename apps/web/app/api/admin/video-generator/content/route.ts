import { NextRequest } from "next/server";

import { reelContentRequestSchema } from "../../../../../lib/video-narration";
import { authorizeVideoAdmin, renderJson, renderJsonError } from "../../../../../lib/video-render-api";
import { WRITER_NOT_CONFIGURED, writeReelContent } from "../../../../../lib/reel-writer";

// Room for a draft and one low-effort revision.
export const maxDuration = 120;

/** One call for all the text of a highlights reel (core in lib/reel-writer.ts, shared with the automatic reels). */
export async function POST(request: NextRequest) {
  const gate = await authorizeVideoAdmin(request);
  if (!gate.ok) return gate.response;

  if (!process.env.ANTHROPIC_API_KEY) return renderJsonError(WRITER_NOT_CONFIGURED, 503);

  const parsed = reelContentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error("Reel content request rejected", parsed.error.issues.slice(0, 5));
    return renderJsonError(`Requête de contenu invalide (${issue?.path.join(".") || "corps"} : ${issue?.message ?? "format"}).`, 400);
  }

  const result = await writeReelContent(parsed.data);
  if (!result.ok) return renderJsonError(result.message, result.status);
  return renderJson(result.value);
}
