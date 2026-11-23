import { createSocialPostSchema } from "../../../lib/social-posts";

/**
 * « Créer un brouillon avec ce texte » of the studio: the same request as the « Nouveau brouillon » of
 * Publications (`POST /api/admin/social-posts`), built from the text of the Instagram panel and a finished
 * render of the race. Checked here with the server's own schema so a text over the Instagram limits is
 * reported before the call. Nothing is published by it.
 */

export type StudioDraftSource = {
  /** The finished render of the race the draft is made from. */
  jobId: string;
  /** Render date, for the label. */
  finishedAt: string | null;
  /** A draft or post already made from this render. */
  post: { id: string; status: string } | null;
};

/** Latest finished render of a race among the listed ones (the list is newest first), with its draft. */
export const pickStudioDraftSource = (
  jobs: Array<{ id: string; raceId?: string | null; status: string; finishedAt?: string | null; post?: { id: string; status: string } | null }>,
  raceId: string | undefined,
): StudioDraftSource | null => {
  if (!raceId) return null;
  const job = jobs.find((candidate) => candidate.raceId === raceId && candidate.status === "done");
  return job ? { jobId: job.id, finishedAt: job.finishedAt ?? null, post: job.post ?? null } : null;
};

export type StudioDraftRequest = { ok: true; body: { videoJobId: string; caption: string; hashtags: string[]; coverText?: string | null } } | { ok: false; message: string };

export const buildStudioDraftRequest = ({ jobId, caption, hashtags, coverText }: { jobId: string; caption: string; hashtags: string[]; coverText?: string }): StudioDraftRequest => {
  if (!caption.trim()) return { ok: false, message: "Écris d’abord la description." };
  const body = { videoJobId: jobId, caption: caption.trim(), hashtags, ...(coverText !== undefined ? { coverText: coverText.trim() || null } : {}) };
  const parsed = createSocialPostSchema.safeParse(body);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Le texte ne respecte pas les limites d’Instagram." };
  return { ok: true, body };
};
