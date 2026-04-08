export type GpxPoint = {
  lat: number;
  lng: number;
  ele: number | null;
  time?: string | null;
  distKmCum: number;
};

export type GpxWaypoint = {
  lat: number;
  lng: number;
  name?: string | null;
  desc?: string | null;
};

export type GpxStats = {
  distanceKm: number;
  gainM: number;
  lossM: number;
  minAltM: number | null;
  maxAltM: number | null;
  startLat: number | null;
  startLng: number | null;
  boundsMinLat: number | null;
  boundsMinLng: number | null;
  boundsMaxLat: number | null;
  boundsMaxLng: number | null;
};

export type ParsedGpx = {
  points: GpxPoint[];
  waypoints: GpxWaypoint[];
  stats: GpxStats;
  name?: string | null;
  pointSource: "track" | "route" | "waypoint";
};

const toNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const decodeEntities = (text: string | null | undefined) => {
  if (!text) return "";
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

const readAttribute = (attributes: string, name: string): string | null => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'>/]+))`, "i")
  );
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
};

const readTagText = (content: string, name: string): string | null => {
  const match = content.match(new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${name}>`, "i"));
  return match?.[1] ?? null;
};

export const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const parseGpx = (content: string): ParsedGpx => {
  const points: GpxPoint[] = [];
  let totalMeters = 0;
  let gainM = 0;
  let lossM = 0;
  let minAltM: number | null = null;
  let maxAltM: number | null = null;
  let boundsMinLat: number | null = null;
  let boundsMinLng: number | null = null;
  let boundsMaxLat: number | null = null;
  let boundsMaxLng: number | null = null;
  const elevationThreshold = 1;
  let previousEle: number | null = null;
  const trackNameMatch =
    content.match(/<metadata>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/metadata>/i) ??
    content.match(/<trk>[\s\S]*?<name>([\s\S]*?)<\/name>/i);
  const trackName = decodeEntities(trackNameMatch?.[1]) || null;

  const appendPoint = (lat: number, lng: number, ele: number | null, time: string | null) => {
    if (points.length > 0) {
      const prev = points[points.length - 1];
      totalMeters += haversineMeters(prev.lat, prev.lng, lat, lng);
    }

    if (ele !== null) {
      minAltM = minAltM === null ? ele : Math.min(minAltM, ele);
      maxAltM = maxAltM === null ? ele : Math.max(maxAltM, ele);

      if (previousEle !== null) {
        const diff = ele - previousEle;
        if (diff > elevationThreshold) {
          gainM += diff;
        } else if (diff < -elevationThreshold) {
          lossM += Math.abs(diff);
        }
      }
      previousEle = ele;
    }

    boundsMinLat = boundsMinLat === null ? lat : Math.min(boundsMinLat, lat);
    boundsMaxLat = boundsMaxLat === null ? lat : Math.max(boundsMaxLat, lat);
    boundsMinLng = boundsMinLng === null ? lng : Math.min(boundsMinLng, lng);
    boundsMaxLng = boundsMaxLng === null ? lng : Math.max(boundsMaxLng, lng);

    points.push({
      lat,
      lng,
      ele,
      time,
      distKmCum: Number((totalMeters / 1000).toFixed(3)),
    });

    if (points.length === 1) {
      boundsMinLat = lat;
      boundsMaxLat = lat;
      boundsMinLng = lng;
      boundsMaxLng = lng;
    }
  };

  const appendPointElements = (tagName: "trkpt" | "rtept" | "wpt") => {
    const pointRegex = new RegExp(
      `<(?:[\\w.-]+:)?${tagName}\\b([^>]*)(?:>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}>|\\s*\\/>)`,
      "gi"
    );
    let pointMatch: RegExpExecArray | null = null;
    let count = 0;

    while ((pointMatch = pointRegex.exec(content))) {
      const attributes = pointMatch[1];
      const inner = pointMatch[2] ?? "";
      const lat = toNumber(readAttribute(attributes, "lat"));
      const lng = toNumber(readAttribute(attributes, "lon"));

      if (lat === null || lng === null) continue;

      const ele = toNumber(readTagText(inner, "ele"));
      const time = readTagText(inner, "time");
      appendPoint(lat, lng, ele, time);
      count += 1;
    }

    return count;
  };

  let pointSource: ParsedGpx["pointSource"] = "track";
  const parsedTrackPointCount = appendPointElements("trkpt");

  if (parsedTrackPointCount === 0) {
    pointSource = "route";
    appendPointElements("rtept");
  }

  if (points.length === 0) {
    pointSource = "waypoint";
    appendPointElements("wpt");
  }

  if (points.length === 0) {
    throw new Error("No track, route, or waypoint coordinates found in GPX.");
  }

  const waypoints: GpxWaypoint[] = [];
  const wptRegex = /<(?:[\w.-]+:)?wpt\b([^>]*)(?:>([\s\S]*?)<\/(?:[\w.-]+:)?wpt>|\s*\/>)/gi;
  let wptMatch: RegExpExecArray | null = null;
  while ((wptMatch = wptRegex.exec(content))) {
    const attributes = wptMatch[1];
    const inner = wptMatch[2] ?? "";
    const lat = toNumber(readAttribute(attributes, "lat"));
    const lng = toNumber(readAttribute(attributes, "lon"));
    if (lat === null || lng === null) continue;
    const name = decodeEntities(readTagText(inner, "name")) || null;
    const desc = decodeEntities(readTagText(inner, "desc")) || null;
    waypoints.push({ lat, lng, name, desc });
  }

  return {
    points,
    waypoints,
    stats: {
      distanceKm: Number((totalMeters / 1000).toFixed(2)),
      gainM: Number(gainM.toFixed(1)),
      lossM: Number(lossM.toFixed(1)),
      minAltM: minAltM === null ? null : Number(minAltM.toFixed(1)),
      maxAltM: maxAltM === null ? null : Number(maxAltM.toFixed(1)),
      startLat: points[0]?.lat ?? null,
      startLng: points[0]?.lng ?? null,
      boundsMinLat,
      boundsMinLng,
      boundsMaxLat,
      boundsMaxLng,
    },
    name: trackName || null,
    pointSource,
  };
};
