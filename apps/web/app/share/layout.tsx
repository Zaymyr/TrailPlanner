import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function ShareLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
