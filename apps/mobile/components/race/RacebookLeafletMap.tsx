import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../lib/gpx';
import type { RacebookAidStation } from '../../lib/racebook';
import { elevationProfileFromRoute, getCourseProgressAtDistance, projectDistanceOnRoute } from '../../lib/racebookCourseVisuals';

type RacebookLeafletMapProps = {
  points: MobileGpxPreviewPoint[];
  height?: number;
  routeColor?: string;
  aidStations?: RacebookAidStation[];
  locale?: 'fr' | 'en';
  fullscreen?: boolean;
};

function buildMapHtml(
  points: MobileGpxPreviewPoint[],
  routeColor: string,
  aidStations: RacebookAidStation[],
  locale: 'fr' | 'en',
) {
  const routePoints = points.map((point) => [point.lat, point.lng]);
  const routeJson = JSON.stringify(routePoints);
  const elevationProfile = elevationProfileFromRoute(points);
  const stationJson = JSON.stringify(
    aidStations.flatMap((station) => {
      const routeStartKm = points[0]?.distanceKm ?? 0;
      const routeEndKm = points[points.length - 1]?.distanceKm ?? routeStartKm;
      if (station.km < routeStartKm || station.km > routeEndKm) return [];
      const projected = projectDistanceOnRoute(points, station.km);
      if (!projected) return [];
      const progress = getCourseProgressAtDistance(elevationProfile, station.km);
      return [{
        lat: projected.lat,
        lng: projected.lng,
        name: station.name,
        km: station.km,
        water: station.waterAvailable,
        solid: station.solidAvailable,
        assistance: station.assistanceAllowed,
        cutoff: station.organizerDetails.cutoffTime,
        note: station.organizerDetails.organizerNote ?? station.notes,
        cumulativeGain: station.organizerDetails.cumulativeElevationGainM ?? progress?.elevationGainM ?? null,
        cumulativeLoss: station.organizerDetails.cumulativeElevationLossM ?? progress?.elevationLossM ?? null,
      }];
    }),
  ).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
    />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        background: #f4f1ea;
      }

      .leaflet-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f4f1ea;
      }

      .aid-popup { min-width: 180px; color: #1f2933; }
      .aid-popup__eyebrow { color: #667085; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
      .aid-popup__title { margin-top: 3px; font-size: 15px; font-weight: 800; }
      .aid-popup__stats { display: flex; gap: 7px; margin-top: 8px; }
      .aid-popup__stat { flex: 1; min-width: 0; padding: 7px 8px; border-radius: 9px; background: #f4f1ea; }
      .aid-popup__stat-label { color: #667085; font-size: 9px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
      .aid-popup__stat-value { margin-top: 2px; color: #1f2933; font-size: 14px; font-weight: 800; }
      .aid-popup__meta { margin-top: 7px; color: #475467; font-size: 12px; line-height: 1.45; }
      .aid-popup__note { margin-top: 7px; padding-top: 7px; border-top: 1px solid #e7e2d8; color: #344054; font-size: 12px; line-height: 1.4; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const points = ${routeJson};
      const aidStations = ${stationJson};
      const locale = '${locale}';
      const startPoint = points[0];
      const finishPoint = points[points.length - 1];

      const map = L.map('map', {
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      const route = L.polyline(points, {
        color: '${routeColor}',
        weight: 4,
        opacity: 0.92,
      }).addTo(map);

      if (startPoint) {
        L.circleMarker(startPoint, {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: '#D97706',
          fillOpacity: 1,
        }).addTo(map);
      }

      if (finishPoint) {
        L.circleMarker(finishPoint, {
          radius: 6,
          color: '#ffffff',
          weight: 2,
          fillColor: '#DC2626',
          fillOpacity: 1,
        }).addTo(map);
      }

      const serviceLabel = (station) => [
        station.water ? (locale === 'fr' ? 'Eau' : 'Water') : null,
        station.solid ? (locale === 'fr' ? 'Solide' : 'Food') : null,
        station.assistance ? (locale === 'fr' ? 'Assistance' : 'Crew') : null,
      ].filter(Boolean).join(' · ');

      aidStations.forEach((station) => {
        L.circleMarker([station.lat, station.lng], {
          radius: 7,
          color: '#ffffff',
          weight: 3,
          fillColor: '${routeColor}',
          fillOpacity: 1,
          interactive: false,
        }).addTo(map);

        const hitTarget = L.circleMarker([station.lat, station.lng], {
          radius: 22,
          stroke: false,
          fillColor: '#000000',
          fillOpacity: 0.01,
          bubblingMouseEvents: false,
        }).addTo(map);

        const popup = document.createElement('div');
        popup.className = 'aid-popup';
        const eyebrow = document.createElement('div');
        eyebrow.className = 'aid-popup__eyebrow';
        eyebrow.textContent = locale === 'fr' ? 'Ravitaillement' : 'Aid station';
        const title = document.createElement('div');
        title.className = 'aid-popup__title';
        title.textContent = station.name;
        const stats = document.createElement('div');
        stats.className = 'aid-popup__stats';
        const addStat = (label, value) => {
          const stat = document.createElement('div');
          stat.className = 'aid-popup__stat';
          const statLabel = document.createElement('div');
          statLabel.className = 'aid-popup__stat-label';
          statLabel.textContent = label;
          const statValue = document.createElement('div');
          statValue.className = 'aid-popup__stat-value';
          statValue.textContent = value;
          stat.append(statLabel, statValue);
          stats.append(stat);
        };
        addStat(locale === 'fr' ? 'Distance cumulée' : 'Distance', station.km.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 1 }) + ' km');
        addStat(locale === 'fr' ? 'D+ cumulé' : 'Gain so far', station.cumulativeGain === null ? '—' : Math.round(station.cumulativeGain).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US') + ' m');
        const meta = document.createElement('div');
        meta.className = 'aid-popup__meta';
        meta.textContent = [serviceLabel(station), station.cumulativeLoss === null ? null : 'D- ' + Math.round(station.cumulativeLoss).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US') + ' m', station.cutoff ? (locale === 'fr' ? 'Barrière ' : 'Cutoff ') + station.cutoff : null].filter(Boolean).join(' · ');
        popup.append(eyebrow, title, stats);
        if (meta.textContent) popup.append(meta);
        if (station.note) {
          const note = document.createElement('div');
          note.className = 'aid-popup__note';
          note.textContent = station.note;
          popup.append(note);
        }
        hitTarget.bindPopup(popup, { closeButton: true, offset: [0, -4] });
      });

      map.fitBounds(route.getBounds(), { padding: [24, 24] });
    </script>
  </body>
</html>`;
}

export function RacebookLeafletMap({
  points,
  height = 260,
  routeColor = '#B45309',
  aidStations = [],
  locale = 'fr',
  fullscreen = false,
}: RacebookLeafletMapProps) {
  const safeRouteColor = /^#[0-9A-Fa-f]{6}$/.test(routeColor) ? routeColor : '#B45309';
  const source = useMemo(
    () => ({ html: buildMapHtml(points, safeRouteColor, aidStations, locale) }),
    [aidStations, locale, points, safeRouteColor],
  );

  return (
    <View style={[styles.frame, fullscreen && styles.fullscreenFrame, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={source}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        setSupportMultipleWindows={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  webview: {
    backgroundColor: Colors.surfaceSecondary,
  },
  fullscreenFrame: {
    borderRadius: 0,
    borderWidth: 0,
  },
});
