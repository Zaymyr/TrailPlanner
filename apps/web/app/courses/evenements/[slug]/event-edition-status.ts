const franceDateFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/Paris",
});

const toFranceDateKey = (date: Date) => {
  const parts = franceDateFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

export const isEventEditionPast = (endDate: string, now = new Date()) => (
  /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate < toFranceDateKey(now)
);
