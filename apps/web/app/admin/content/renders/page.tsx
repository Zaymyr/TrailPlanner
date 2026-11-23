"use client";

import { RendersQueue } from "../../_components/renders/RendersQueue";
import { useAdminAccessToken } from "../../_components/shell/AdminAccess";

/** Rendus (lot 6): the single render queue (reels manuels et automatiques, survols, carrousels). */
export default function AdminContentRendersPage() {
  return <RendersQueue accessToken={useAdminAccessToken()} />;
}
