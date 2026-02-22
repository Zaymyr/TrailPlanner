import type { PrintAidStationCard } from "../../lib/print/aidStations";
import { AidStationCard } from "./AidStationCard";

type PrintAidStationsAssistanceProps = {
  raceName: string;
  raceDate?: string;
  runnerName?: string;
  emergencyNote?: string;
  cards: PrintAidStationCard[];
};

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
          .assistance-grid {
            column-count: 2;
            column-gap: 10mm;
          }
          .aid-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <header className="mb-4 rounded-md border border-slate-300 p-3">
        <h1 className="text-[16pt] font-bold">Assistance · Aid Station Cards</h1>
        <p className="text-[12pt] font-semibold">{raceName}</p>
        <p className="text-[11pt] text-slate-700">
          {raceDate ? `Date: ${raceDate}` : ""}
          {runnerName ? ` · Runner: ${runnerName}` : ""}
        </p>
        {emergencyNote ? <p className="mt-1 text-[11pt] font-semibold">Emergency: {emergencyNote}</p> : null}
      </header>

      <section className="assistance-grid">
        {cards.map((card) => (
          <AidStationCard key={card.id} card={card} />
        ))}
      </section>
    </div>
  );
}
