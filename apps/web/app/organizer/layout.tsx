import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function OrganizerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
