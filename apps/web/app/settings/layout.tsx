import { noIndexMetadata } from "../noindex-metadata";

export const metadata = { ...noIndexMetadata, title: "Liste nutrition | Pace Yourself", alternates: {} };

export default function SettingsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
