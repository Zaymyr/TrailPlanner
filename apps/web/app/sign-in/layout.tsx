import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
