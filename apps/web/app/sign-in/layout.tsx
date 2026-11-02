import { noIndexMetadata } from "../noindex-metadata";

export const metadata = { ...noIndexMetadata, title: "Connexion | Pace Yourself", alternates: {} };

export default function SignInLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
