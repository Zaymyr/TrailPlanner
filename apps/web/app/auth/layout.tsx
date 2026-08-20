import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
