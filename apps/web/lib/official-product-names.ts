import { defaultFuelType, type FuelType } from "./fuel-types";

type HarmonizeOfficialProductNameArgs = {
  brand?: string | null;
  fuelType?: string | null;
  officialName: string;
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const ensureGramSpacing = (value: string) => value.replace(/(\d)\s*g\b/gi, "$1 g");

const normalizeBrandKey = (brand?: string | null) =>
  String(brand ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .trim();

const capitalizeFirst = (value: string) => (value ? `${value.slice(0, 1).toUpperCase()}${value.slice(1)}` : value);

const replaceFlavorDelimiters = (value: string) =>
  normalizeWhitespace(value).replace(/\s*-\s*/g, " / ");

const normalizeBaouwFlavor = (value: string) =>
  replaceFlavorDelimiters(value)
    .replace(/\bCitron Vert\b/g, "Citron vert")
    .replace(/\bFruits Rouges\b/g, "Fruits rouges")
    .replace(/\bThé Matcha\b/g, "Thé matcha")
    .replace(/\bCari de Légumes\b/g, "Cari de légumes");

const stripTrailingSize = (value: string) => {
  const match = ensureGramSpacing(value).match(/^(.*?)(?:\s+(\d+\s*g))$/i);
  return {
    label: normalizeWhitespace(match?.[1] ?? value),
    size: match?.[2] ?? null,
  };
};

const extractMulebarFlavor = (value: string) => {
  const normalized = ensureGramSpacing(normalizeWhitespace(value));
  if (normalized.includes("/")) {
    return normalized.split("/").slice(1).join("/").trim();
  }

  const afterBrand = normalized.match(/Mulebar\s+(.*)$/i)?.[1]?.trim();
  return afterBrand ? capitalizeFirst(afterBrand) : normalized;
};

const harmonizeBaouwName = (officialName: string, fuelType: FuelType) => {
  const normalized = normalizeBaouwFlavor(ensureGramSpacing(normalizeWhitespace(officialName)));

  switch (fuelType) {
    case "gel":
      return `Gel ${normalized}`;
    case "bar":
      return `Barre ${normalized}`;
    case "real_food":
      return `Purée ${normalized}`;
    case "electrolyte":
      return `Pastilles ${normalized}`;
    case "drink_mix": {
      const { label, size } = stripTrailingSize(normalized);
      return `Boisson ${label}${size ? ` - ${size}` : ""}`;
    }
    default:
      return normalized;
  }
};

const harmonizeMulebarName = (officialName: string, fuelType: FuelType) => {
  const flavor = extractMulebarFlavor(officialName);

  switch (fuelType) {
    case "gel":
      return `Gel ${flavor}`;
    case "bar":
      return `Barre ${flavor}`;
    case "real_food":
      return `Purée ${flavor}`;
    case "drink_mix":
      return `Boisson effort ${flavor}`;
    case "electrolyte":
      return `Hydratation ${flavor}`;
    default:
      return flavor;
  }
};

const harmonizePrecisionName = (officialName: string) =>
  normalizeWhitespace(officialName.replace(/^Precision Fuel\s+/i, ""));

const harmonizeAptoniaName = (officialName: string) =>
  ensureGramSpacing(normalizeWhitespace(officialName)).replace(/\((\d+\s*g)\)$/i, "- $1");

export function harmonizeOfficialProductName({
  brand,
  fuelType,
  officialName,
}: HarmonizeOfficialProductNameArgs) {
  const normalizedOfficialName = ensureGramSpacing(normalizeWhitespace(officialName));
  const normalizedFuelType = (fuelType ?? defaultFuelType) as FuelType;
  const brandKey = normalizeBrandKey(brand);

  if (!normalizedOfficialName) {
    return normalizedOfficialName;
  }

  if (brandKey === "baouw") {
    return harmonizeBaouwName(normalizedOfficialName, normalizedFuelType);
  }

  if (brandKey === "mulebar") {
    return harmonizeMulebarName(normalizedOfficialName, normalizedFuelType);
  }

  if (brandKey === "precision fuel and hydration") {
    return harmonizePrecisionName(normalizedOfficialName);
  }

  if (brandKey === "aptonia") {
    return harmonizeAptoniaName(normalizedOfficialName);
  }

  return normalizedOfficialName;
}
