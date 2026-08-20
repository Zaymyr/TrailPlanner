import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
