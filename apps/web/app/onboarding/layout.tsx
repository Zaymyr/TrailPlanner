import type { ReactNode } from "react";

import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return children;
}
