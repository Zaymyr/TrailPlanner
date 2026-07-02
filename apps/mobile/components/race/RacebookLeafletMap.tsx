import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Colors } from '../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../lib/gpx';

type RacebookLeafletMapProps = {
  points: MobileGpxPreviewPoint[];
  height?: number;
};

function buildMapHtml(points: MobileGpxPreviewPoint[]) {
  const routePoints = points.map((point) => [point.lat, point.lng]);
  const routeJson = JSON.stringify(routePoints);

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
        color: '#B45309',
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

      map.fitBounds(route.getBounds(), { padding: [24, 24] });
    </script>
  </body>
</html>`;
}

export function RacebookLeafletMap({ points, height = 260 }: RacebookLeafletMapProps) {
  const source = useMemo(() => ({ html: buildMapHtml(points) }), [points]);

  return (
    <View style={[styles.frame, { height }]}>
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
});
