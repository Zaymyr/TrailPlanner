import type { Metadata } from "next";
import "./globals.css";
import React from "react";

export const metadata: Metadata = {
  title: "Race Fuel Planner",
  description: "Estimate aid-station timing and fueling needs for your next race.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
          <header className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-[0.2em] text-emerald-300">
                TrailPlanner
              </p>
              <h1 className="text-2xl font-semibold leading-tight text-slate-50">
                Race Fuel Planner
              </h1>
              <p className="text-sm text-slate-300">
                Plan your aid-station timing, fueling targets, and pacing for race day.
              </p>
            </div>
          </header>
          <main className="pb-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
