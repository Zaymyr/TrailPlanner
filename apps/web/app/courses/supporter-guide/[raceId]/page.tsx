import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_QR_SOURCE, DEMO_REDIRECT_PATH } from "../../../../lib/demo-app-link";
import { SupporterGuideView } from "./SupporterGuideView";

export const metadata: Metadata = {
  title: "Livret supporter | Pace Yourself",
  description: "Programme, points de suivi et informations pratiques pour accompagner les coureurs.",
  robots: { index: false, follow: false },
};

export default function SupporterGuidePage({
  params,
  searchParams,
}: {
  params: { raceId: string };
  searchParams?: { src?: string | string[] };
}) {
  if (!z.string().uuid().safeParse(params.raceId).success) notFound();
  // Brochure QR scanned in a browser: send prospects to the app demo or the organizer pitch, not the runner-facing guide.
  if (searchParams?.src === DEMO_QR_SOURCE) redirect(DEMO_REDIRECT_PATH);
  return <SupporterGuideView raceId={params.raceId} />;
}
