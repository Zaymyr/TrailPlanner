import * as DocumentPicker from 'expo-document-picker';

import type { MobileTranslations } from '../locales/types';
import { ensureAppSession } from './appSession';
import {
  MobileGpxParseError,
  parseGpxForRaceImport,
  type MobileGpxParseResult,
} from './gpx';
import { supabase } from './supabase';
import { WEB_API_BASE_URL } from './webApi';

export type GpxFeedback = {
  tone: 'success' | 'warning';
  message: string;
};

export type ImportedGpxDocument = {
  content: string;
  fileName: string;
  parsed: MobileGpxParseResult;
  feedback: GpxFeedback;
  suggestedRaceName: string;
};

export type RaceImportAidStation = {
  name: string;
  distanceKm: number;
  waterRefill: boolean;
};

export type ImportedRace = {
  id: string;
  name: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m?: number | null;
  location_text?: string | null;
  is_public: boolean;
  created_by?: string | null;
  gpx_storage_path?: string | null;
};

type CreatePrivateRaceInput = {
  name: string;
  distanceKm: number;
  elevationGainM: number;
  elevationLossM?: number | null;
  locationText?: string | null;
  raceDate?: string | null;
  aidStations?: RaceImportAidStation[];
  gpxContent?: string | null;
};

const GPX_DOCUMENT_TYPES = [
  'application/gpx+xml',
  'application/gpx',
  'application/xml',
  'text/xml',
  'text/plain',
  'application/octet-stream',
];

const sanitizeImportedRaceName = (value: string | null | undefined) =>
  (value ?? '')
    .replace(/\.gpx$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const buildGpxFeedback = (
  parsed: MobileGpxParseResult,
  translations: MobileTranslations,
): GpxFeedback => {
  const base =
    parsed.pointSource === 'route'
      ? translations.races.gpxRouteFallback
      : parsed.pointSource === 'waypoint'
        ? translations.races.gpxWaypointFallback
        : translations.races.gpxImportSuccess;

  const message = base
    .replace('{points}', String(parsed.pointCount))
    .replace('{distance}', String(parsed.stats.distanceKm));

  if (!parsed.hasElevation) {
    return { tone: 'warning', message: `${message} ${translations.races.gpxNoElevation}` };
  }

  return {
    tone: parsed.pointSource === 'track' ? 'success' : 'warning',
    message,
  };
};

export const buildGpxImportErrorMessage = (
  error: unknown,
  translations: MobileTranslations,
) => {
  if (!(error instanceof MobileGpxParseError)) {
    return translations.races.gpxImportFailedDetails;
  }

  switch (error.code) {
    case 'empty_file':
      return translations.races.gpxImportEmpty;
    case 'invalid_encoding':
      return translations.races.gpxImportInvalidEncoding;
    case 'unsupported_kml':
    case 'unsupported_tcx':
      return translations.races.gpxImportUnsupportedFormat;
    case 'invalid_coordinates':
      return translations.races.gpxImportInvalidCoordinates;
    case 'no_coordinates':
      return translations.races.gpxImportNoPoints;
    case 'not_gpx':
      return translations.races.gpxImportInvalidFile;
    default:
      return translations.races.gpxImportFailedDetails;
  }
};

export async function pickAndParseGpxDocument(
  translations: MobileTranslations,
): Promise<ImportedGpxDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: GPX_DOCUMENT_TYPES,
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets?.[0];
  if (!asset?.uri) {
    return null;
  }

  const response = await fetch(asset.uri);
  const content = await response.text();
  const parsed = parseGpxForRaceImport(content);
  const feedback = buildGpxFeedback(parsed, translations);
  const suggestedRaceName =
    sanitizeImportedRaceName(parsed.name) ||
    sanitizeImportedRaceName(asset.name) ||
    translations.races.gpxFallbackRaceName;

  return {
    content,
    fileName: asset.name ?? `${suggestedRaceName}.gpx`,
    parsed,
    feedback,
    suggestedRaceName,
  };
}

export async function createPrivateRace(
  input: CreatePrivateRaceInput,
): Promise<{ race: ImportedRace; aidStations: RaceImportAidStation[] }> {
  const session = await ensureAppSession();
  const token = session?.access_token;
  const userId = session?.user?.id;

  if (!token || !userId) {
    throw new Error('Session expired.');
  }

  const response = await fetch(`${WEB_API_BASE_URL}/api/races`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: input.name.trim(),
      distance_km: input.distanceKm,
      elevation_gain_m: input.elevationGainM,
      elevation_loss_m: input.elevationLossM ?? null,
      location_text: input.locationText ?? null,
      race_date: input.raceDate ?? null,
      aid_stations: input.aidStations ?? [],
      gpx_content: input.gpxContent ?? null,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { message?: string; race?: ImportedRace; aidStations?: RaceImportAidStation[] }
    | null;

  if (!response.ok || !payload?.race) {
    throw new Error(payload?.message ?? 'Unable to create race.');
  }

  await supabase
    .from('races')
    .update({
      is_public: false,
      is_live: false,
      is_published: false,
      created_by: userId,
      event_id: null,
    })
    .eq('id', payload.race.id);

  return {
    race: payload.race,
    aidStations: payload.aidStations ?? [],
  };
}
