import type { PrintAidStationCard, PrintAidStationLineIcon } from "../../lib/print/aidStations";

type PrintAidStationsAssistanceProps = {
  raceName: string;
  raceDate?: string;
  runnerName?: string;
  emergencyNote?: string;
  cards: PrintAidStationCard[];
};

const iconByType: Record<PrintAidStationLineIcon, string> = {
  gel: "🍬",
  iso: "🧃",
  water: "💧",
  salt: "🧂",
  solid: "🍌",
};

/** Convert "T+01:15 · UP" → { duration: "1h 15", terrain: "UP" } */
function parseNextLeg(summary: string): { duration: string; terrain: string } | null {
  if (summary === "Finish") return null;
  const match = summary.match(/T\+(\d{2}):(\d{2})\s*·\s*(\w+)/);
  if (!match) return { duration: summary, terrain: "" };
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const terrain = match[3];
  const duration = hours === 0 ? `${minutes}min` : minutes === 0 ? `${hours}h` : `${hours}h ${minutes}`;
  return { duration, terrain };
}

const terrainLabel: Record<string, string> = {
  UP: "↑ UP",
  DOWN: "↓ DOWN",
  FLAT: "→ FLAT",
};

function CrewCard({ card }: { card: PrintAidStationCard }) {
  const nextLeg = parseNextLeg(card.nextLegSummary);

  return (
    <article className="break-inside-avoid overflow-hidden rounded border border-slate-300 bg-white text-slate-900">
      {/* Header */}
      <div className="flex items-baseline justify-between bg-slate-100 px-3 py-2">
        <h2 className="text-[12pt] font-bold leading-none">{card.name}</h2>
        <span className="ml-2 shrink-0 text-[10pt] font-medium text-slate-500">km {card.km.toFixed(1)}</span>
      </div>

      <div className="px-3 py-2 space-y-2">
        {/* ETA row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10pt]">
          {card.etaTimeOfDay && (
            <span className="font-bold text-slate-900">{card.etaTimeOfDay}</span>
          )}
          <span className="text-slate-600">{card.etaElapsed}</span>
          {card.timeWindow && (
            <span className="text-[9pt] text-slate-400">{card.timeWindow}</span>
          )}
          {card.dPlusCum != null && (
            <span className="ml-auto text-[9pt] text-slate-400">
              D+ {Math.round(card.dPlusCum)}m · D- {Math.round(card.dMinusCum ?? 0)}m
            </span>
          )}
        </div>

        {/* Nutrition list */}
        <ul className="space-y-0.5 text-[10pt]">
          {card.toGive.map((line) => (
            <li key={line.label} className="flex items-baseline gap-1.5 leading-snug">
              <span aria-hidden>{iconByType[line.icon]}</span>
              <span className="text-slate-600">{line.label}</span>
              <span className="ml-auto font-semibold text-slate-900">{line.value}</span>
              {line.note && (
                <span className="text-[8pt] text-slate-400">({line.note})</span>
              )}
            </li>
          ))}
        </ul>

        {/* Next leg */}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-1.5 text-[10pt]">
          {nextLeg ? (
            <>
              <span className="text-[8pt] font-semibold uppercase tracking-wide text-slate-400">Next</span>
              <span className="font-bold">{nextLeg.duration}</span>
              {nextLeg.terrain && (
                <span className="text-slate-600">{terrainLabel[nextLeg.terrain] ?? nextLeg.terrain}</span>
              )}
            </>
          ) : (
            <span className="font-bold text-emerald-700">🏁 Finish</span>
          )}
        </div>
      </div>
    </article>
  );
}

export function PrintAidStationsAssistance({
  raceName,
  raceDate,
  runnerName,
  emergencyNote,
  cards,
}: PrintAidStationsAssistanceProps) {
  return (
    <div className="mx-auto max-w-[210mm] bg-white p-4 text-slate-900 print:p-0">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 11mm;
        }
        @media print {
          body {
            background: #fff;
          }
        }
      `}</style>

      {/* Race header */}
      <header className="mb-4 flex items-start justify-between rounded border border-slate-300 p-3">
        <div>
          <h1 className="text-[14pt] font-bold leading-tight">{raceName}</h1>
          {runnerName && (
            <p className="text-[11pt] text-slate-700">
              Runner: <span className="font-semibold">{runnerName}</span>
            </p>
          )}
          {emergencyNote && (
            <p className="mt-1 text-[10pt] font-bold text-red-700">⚠ Emergency: {emergencyNote}</p>
          )}
        </div>
        <div className="text-right text-[10pt] text-slate-500 shrink-0 ml-4">
          {raceDate && <p>{raceDate}</p>}
          <p className="text-slate-400">{cards.length} aid station{cards.length !== 1 ? "s" : ""}</p>
        </div>
      </header>

      {/* 2-column card grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <CrewCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
