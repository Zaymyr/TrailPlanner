import Link from "next/link";

import type { PremiumCopy } from "./premium-copy";

const DELIVERABLE_ICONS = ["🖨️", "📱", "🤝"];

export function PremiumSections({ copy }: { copy: PremiumCopy }) {
  return (
    <>
      <section aria-labelledby="premium-comparison" className="space-y-4">
        <h2 id="premium-comparison" className="text-2xl font-semibold">{copy.comparisonTitle}</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-brand-surface text-brand">
              <tr>
                <th scope="col" className="w-[40%] px-3 py-3 sm:px-4"><span className="sr-only">—</span></th>
                <th scope="col" className="px-3 py-3 font-semibold sm:px-4">{copy.comparisonFree}</th>
                <th scope="col" className="px-3 py-3 font-semibold sm:px-4">{copy.comparisonPaid}</th>
              </tr>
            </thead>
            <tbody>
              {copy.comparisonRows.map((row) => (
                <tr key={row.label} className="border-t border-border align-top">
                  <th scope="row" className="break-words px-3 py-3 font-medium sm:px-4">{row.label}</th>
                  <td className="break-words px-3 py-3 text-muted-foreground sm:px-4">{row.free}</td>
                  <td className="break-words px-3 py-3 font-medium text-brand sm:px-4">{row.paid}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="premium-deliverables" className="space-y-4">
        <h2 id="premium-deliverables" className="text-2xl font-semibold">{copy.deliverablesTitle}</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {copy.deliverables.map((item, index) => (
            <article key={item.title} className="space-y-2 rounded-2xl border border-brand-border bg-brand-surface p-5">
              <span aria-hidden="true" className="text-2xl">{DELIVERABLE_ICONS[index]}</span>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="premium-faq" className="space-y-4">
        <h2 id="premium-faq" className="text-2xl font-semibold">{copy.faqTitle}</h2>
        <div className="divide-y divide-border rounded-2xl border border-border bg-card">
          {copy.faq.map((entry) => (
            <details key={entry.q} className="group px-4 py-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium">
                <span>{entry.q}</span>
                <span aria-hidden="true" className="text-brand transition group-open:rotate-45">+</span>
              </summary>
              <p className="pb-2 text-sm text-muted-foreground">{entry.a}</p>
            </details>
          ))}
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        {copy.methodologyText}{" "}
        <Link href="/methodologie" className="font-medium text-brand underline underline-offset-2">
          {copy.methodologyLink}
        </Link>
      </p>
    </>
  );
}
