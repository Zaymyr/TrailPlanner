import { NextRequest } from "next/server";

import { jsonError, requireOrganizerAuth } from "../../../../lib/organizer";

export async function POST(request: NextRequest) {
  const auth = await requireOrganizerAuth(request);
  if ("error" in auth) return auth.error;

  return jsonError("Les nouvelles publications passent désormais par l’offre RaceBook de l’édition.", 410);
}
