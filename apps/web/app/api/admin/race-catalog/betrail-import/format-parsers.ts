export const parseDistanceKm = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*km/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
};

export const parseElevationM = (text: string): number | null => {
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*d\s*\+/i);
  if (!match) return null;
  return Number(match[1].replace(",", "."));
};
