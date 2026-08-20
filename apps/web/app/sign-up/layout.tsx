import { noIndexMetadata } from "../noindex-metadata";

export const metadata = noIndexMetadata;

export default function SignUpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
