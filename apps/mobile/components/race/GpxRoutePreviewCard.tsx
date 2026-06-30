import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { Colors } from '../../constants/colors';
import type { MobileGpxPreviewPoint } from '../../lib/gpx';
import { Text } from '../themed/Text';

type GpxRoutePreviewCardProps = {
  points: MobileGpxPreviewPoint[];
  height?: number;
};

type ProjectedPoint = {
  x: number;
  y: number;
};

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 180;
const PADDING = 18;

function projectPoints(points: MobileGpxPreviewPoint[]): ProjectedPoint[] {
  if (points.length === 0) return [];

  const latitudes = points.map((point) => point.lat);
  const longitudes = points.map((point) => point.lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.000001);
  const lngRange = Math.max(maxLng - minLng, 0.000001);
  const usableWidth = VIEWBOX_WIDTH - PADDING * 2;
  const usableHeight = VIEWBOX_HEIGHT - PADDING * 2;
  const scale = Math.min(usableWidth / lngRange, usableHeight / latRange);
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  return points.map((point) => ({
    x: VIEWBOX_WIDTH / 2 + (point.lng - centerLng) * scale,
    y: VIEWBOX_HEIGHT / 2 - (point.lat - centerLat) * scale,
  }));
}

export function GpxRoutePreviewCard({ points, height = 184 }: GpxRoutePreviewCardProps) {
  const projectedPoints = projectPoints(points);
  const polylinePoints = projectedPoints.map((point) => `${point.x},${point.y}`).join(' ');
  const startPoint = projectedPoints[0] ?? null;
  const finishPoint = projectedPoints[projectedPoints.length - 1] ?? null;
  const hasRoute = projectedPoints.length >= 2;

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapFrame, { height }]}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
          {hasRoute ? (
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={Colors.brandPrimary}
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {startPoint ? <Circle cx={startPoint.x} cy={startPoint.y} r={6} fill={Colors.brandLight} /> : null}
          {finishPoint ? <Circle cx={finishPoint.x} cy={finishPoint.y} r={6} fill={Colors.warning} /> : null}
        </Svg>

        {!hasRoute && startPoint ? (
          <View style={styles.singlePointOverlay}>
            <Text style={styles.singlePointText}>1 point</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.brandLight }]} />
          <Text style={styles.legendText}>Depart</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
          <Text style={styles.legendText}>Arrivee</Text>
        </View>
        <Text style={styles.legendHint}>{points.length} points</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  mapFrame: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
  },
  singlePointOverlay: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  singlePointText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  legendHint: {
    marginLeft: 'auto',
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
});
