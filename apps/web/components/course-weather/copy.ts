import type { CourseWeatherAlert, CourseWeatherPointKind } from "@trailplanner/shared";

export type CourseWeatherLocale = "fr" | "en";

export type WeatherGlyphKind = "clear" | "clear_night" | "partly" | "partly_night" | "cloudy" | "fog" | "rain" | "snow" | "storm" | "unknown";

export type CourseWeatherCopy = {
  planTitle: string;
  raceDayTitle: string;
  loading: string;
  error: string;
  tooEarly: string;
  startEstimated: string;
  forecastOn: string;
  windLabel: string;
  gustLabel: string;
  feelsLike: string;
  noData: string;
  pointKind: Record<CourseWeatherPointKind, string>;
  glyph: Record<WeatherGlyphKind, string>;
  alerts: Record<CourseWeatherAlert, string>;
};

// Local copy (fr/en): the block is self-contained and mounted from three screens, so its strings stay
// next to it instead of widening the shared locale files.
export const courseWeatherCopy: Record<CourseWeatherLocale, CourseWeatherCopy> = {
  fr: {
    planTitle: "Météo à vos passages",
    raceDayTitle: "Météo prévue",
    loading: "Chargement de la météo…",
    error: "La météo est momentanément indisponible.",
    tooEarly: "Prévisions météo disponibles à partir du {date}",
    startEstimated: "Heure de départ estimée à {time}",
    forecastOn: "Prévision du {date}",
    windLabel: "Vent",
    gustLabel: "rafales",
    feelsLike: "ressenti",
    noData: "Prévision indisponible",
    pointKind: { start: "Départ", aid_station: "Ravito", summit: "Point culminant", finish: "Arrivée" },
    glyph: {
      clear: "Ciel dégagé",
      clear_night: "Nuit dégagée",
      partly: "Éclaircies",
      partly_night: "Nuit partiellement nuageuse",
      cloudy: "Nuageux",
      fog: "Brouillard",
      rain: "Pluie",
      snow: "Neige ou grésil",
      storm: "Orage",
      unknown: "Météo inconnue",
    },
    alerts: {
      heat: "Chaleur",
      cold: "Froid",
      wind: "Vent fort",
      rain: "Pluie",
      storm: "Orage",
      snow: "Neige",
    },
  },
  en: {
    planTitle: "Weather at your passages",
    raceDayTitle: "Weather forecast",
    loading: "Loading the weather…",
    error: "The weather is temporarily unavailable.",
    tooEarly: "Weather forecasts available from {date}",
    startEstimated: "Start time estimated at {time}",
    forecastOn: "Forecast of {date}",
    windLabel: "Wind",
    gustLabel: "gusts",
    feelsLike: "feels like",
    noData: "No forecast",
    pointKind: { start: "Start", aid_station: "Aid station", summit: "Highest point", finish: "Finish" },
    glyph: {
      clear: "Clear sky",
      clear_night: "Clear night",
      partly: "Partly cloudy",
      partly_night: "Partly cloudy night",
      cloudy: "Cloudy",
      fog: "Fog",
      rain: "Rain",
      snow: "Snow or sleet",
      storm: "Thunderstorm",
      unknown: "Unknown weather",
    },
    alerts: {
      heat: "Heat",
      cold: "Cold",
      wind: "Strong wind",
      rain: "Rain",
      storm: "Thunderstorm",
      snow: "Snow",
    },
  },
};
