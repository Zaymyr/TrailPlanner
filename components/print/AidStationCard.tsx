import type { PrintAidStationCard } from "../../lib/print/aidStations";

const iconByType = {
  gel: "🍬",
  iso: "🧃",
  water: "💧",
  salt: "🧂",
  solid: "🍌",
} as const;

export function AidStationCard({ card }: { card: PrintAidStationCard }) {
  return (
    <article className="aid-card mb-3 break-inside-avoid rounded-md border border-slate-300 bg-white p-3 text-slate-900">
      <header className="mb-2 border-b border-slate-200 pb-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15pt] font-bold leading-tight">{card.name}</h3>
          <p className="text-[12pt] font-semibold">km {card.km.toFixed(1)}</p>
        </div>
        <p className="text-[11pt]">
          {card.etaTimeOfDay ? `${card.etaTimeOfDay} · ` : ""}
          {card.etaElapsed}
          {card.timeWindow ? ` (${card.timeWindow})` : ""}
        </p>
        {(card.dPlusCum || card.dMinusCum) ? (
          <p className="text-[10pt] text-slate-600">D+ {Math.round(card.dPlusCum ?? 0)}m · D- {Math.round(card.dMinusCum ?? 0)}m</p>
        ) : null}
      </header>

      <section className="mb-2">
        <h4 className="text-[12pt] font-bold uppercase">TO GIVE</h4>
        <ul className="space-y-0.5 text-[11pt]">
          {card.toGive.map((line) => (
            <li key={`${line.label}-${line.value}`} className="leading-tight">
              <span className="mr-1" aria-hidden>
                {iconByType[line.icon]}
              </span>
              <span className="font-semibold">{line.label}:</span> {line.value}
              {line.note ? <span className="text-[10pt] text-slate-500"> ({line.note})</span> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-2 text-[11pt]">
        <h4 className="text-[12pt] font-bold uppercase">TO REFILL / PREP</h4>
        <p>{card.toRefill.join(" · ")}</p>
      </section>

      <section className="mb-2 text-[11pt]">
        <h4 className="text-[12pt] font-bold uppercase">LEAVE WITH</h4>
        <p>{card.leaveWith.join(" · ")}</p>
      </section>

      <section className="text-[11pt]">
        <h4 className="text-[12pt] font-bold uppercase">NEXT LEG</h4>
        <p>{card.nextLegSummary}</p>
      </section>
    </article>
  );
}
