import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RakutenTest123",
  description: "Rakuten Advertising domain ownership verification page for Pace Yourself.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RakutenVerificationPage() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">RakutenTest123</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        This page confirms that Pace Yourself controls the pace-yourself.com domain.
      </p>
    </div>
  );
}
