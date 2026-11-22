import type { Metadata } from "next";

import { noIndexMetadata } from "../noindex-metadata";

export const metadata: Metadata = {
  ...noIndexMetadata,
  title: "Créer mon événement | Pace Yourself",
  description: "Créez votre événement et son Livret coureur sur Pace Yourself.",
};

export default function OrganizersLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
