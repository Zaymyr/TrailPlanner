import { noIndexMetadata } from "../noindex-metadata";

export const metadata = { ...noIndexMetadata, title: "Mon profil | Pace Yourself", alternates: {} };

export default function ProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
