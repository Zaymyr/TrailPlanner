import type { FormValues } from "../types";

export function minutesPerKm(values: FormValues) {
  if (values.paceType === "speed") {
    return 60 / values.speedKph;
  }
  return values.paceMinutes + values.paceSeconds / 60;
}

export function paceToSpeedKph(paceMinutes: number, paceSeconds: number) {
  const totalMinutes = paceMinutes + paceSeconds / 60;
  if (totalMinutes <= 0) return null;
  return 60 / totalMinutes;
}

export function speedToPace(speedKph: number) {
  if (speedKph <= 0) return null;
  const totalMinutes = 60 / speedKph;
  const minutes = Math.floor(totalMinutes);
  let seconds = Math.round((totalMinutes - minutes) * 60);
  if (seconds === 60) {
    return { minutes: minutes + 1, seconds: 0 };
  }
  return { minutes, seconds };
}
