import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { SupporterGuideView } from "./SupporterGuideView";

export const metadata: Metadata = {
  title: "Livret accompagnateur | Pace Yourself",
  description: "Programme, points de suivi et informations pratiques pour accompagner les coureurs.",
  robots: { index: false, follow: false },
};

export default function SupporterGuidePage({ params }: { params: { raceId: string } }) {
  if (!z.string().uuid().safeParse(params.raceId).success) notFound();
  return <SupporterGuideView raceId={params.raceId} />;
}
