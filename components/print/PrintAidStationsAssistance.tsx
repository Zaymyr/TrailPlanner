import type { PrintAidStationCard } from "../../lib/print/aidStations";

type PrintAidStationsAssistanceProps = {
  raceName: string;
  raceDate?: string;
  runnerName?: string;
  emergencyNote?: string;
  cards: PrintAidStationCard[];
};

const toEatSummary = (card: PrintAidStationCard) => {
  const details = card.toGive
    .filter((line) => line.label === "Gels" || line.label === "Solid / extras")
    .map((line) => `${line.label}: ${line.value}`);

  if (details.length > 0) {
    return details.join(" · ");
  }

  return card.toGive.map((line) => `${line.label}: ${line.value}`).join(" · ");
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
        }
      `}</style>

      <header className="mb-4 rounded-md border border-slate-300 p-3">
        <h1 className="text-[16pt] font-bold">Assistance · Condensed Print</h1>
        <p className="text-[12pt] font-semibold">{raceName}</p>
        <p className="text-[11pt] text-slate-700">
          {raceDate ? `Date: ${raceDate}` : ""}
          {runnerName ? ` · Runner: ${runnerName}` : ""}
        </p>
        {emergencyNote ? <p className="mt-1 text-[11pt] font-semibold">Emergency: {emergencyNote}</p> : null}
      </header>

      <section className="overflow-hidden rounded-md border border-slate-300">
        <table className="w-full border-collapse text-[11pt] leading-6">
          <thead className="bg-slate-50 text-left text-slate-900">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Ravito</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">ETA</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">km</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">Time</th>
              <th className="border-b border-slate-200 px-3 py-2 font-semibold">What to eat</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card, index) => {
              const rowBorder = index === cards.length - 1 ? "" : "border-b border-slate-200";
              return (
                <tr key={card.id} className="align-top">
                  <td className={`${rowBorder} px-3 py-2 font-semibold`}>{card.name}</td>
                  <td className={`${rowBorder} px-3 py-2`}>{card.etaTimeOfDay ?? "-"}</td>
                  <td className={`${rowBorder} px-3 py-2`}>{card.km.toFixed(1)}</td>
                  <td className={`${rowBorder} px-3 py-2`}>{card.etaElapsed}</td>
                  <td className={`${rowBorder} px-3 py-2`}>{toEatSummary(card)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
