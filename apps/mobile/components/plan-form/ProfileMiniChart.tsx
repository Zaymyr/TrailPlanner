import React from 'react';
import { View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { ElevationPoint } from './profile-utils';
import { styles } from './styles';

type Props = {
  points: ElevationPoint[];
};

export const ProfileMiniChart = React.memo(function ProfileMiniChart({ points }: Props) {
  if (points.length < 2) {
    return <View style={styles.profileChartEmpty} />;
  }

  const getSlopeColor = (slopePct: number) => {
    if (slopePct >= 10) return '#D8A290';
    if (slopePct >= 4) return '#E4C39E';
    if (slopePct > -4) return Colors.brandBorder;
    if (slopePct > -10) return '#A9C2C9';
    return '#8FAEBC';
  };

  const maxBars = 36;
  const step = Math.max(1, Math.ceil(points.length / maxBars));
  const sampled = points.filter((_, index) => index % step === 0);
  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) sampled.push(lastPoint);

  const minElevation = Math.min(...sampled.map((point) => point.elevationM));
  const maxElevation = Math.max(...sampled.map((point) => point.elevationM));
  const spread = Math.max(1, maxElevation - minElevation);

  return (
    <View style={styles.profileChart}>
      {sampled.map((point, index) => {
        const ratio = (point.elevationM - minElevation) / spread;
        const barHeight = Math.max(8, Math.round(12 + ratio * 36));
        const previousPoint = sampled[Math.max(0, index - 1)] ?? point;
        const nextPoint = sampled[Math.min(sampled.length - 1, index + 1)] ?? point;
        const deltaDistanceKm = nextPoint.distanceKm - previousPoint.distanceKm;
        const deltaElevationM = nextPoint.elevationM - previousPoint.elevationM;
        const slopePct = deltaDistanceKm > 0 ? (deltaElevationM / (deltaDistanceKm * 1000)) * 100 : 0;

        return (
          <View
            key={`${point.distanceKm}-${index}`}
            style={[styles.profileChartBar, { height: barHeight, backgroundColor: getSlopeColor(slopePct), opacity: 0.82 }]}
          />
        );
      })}
    </View>
  );
}, (prev, next) => {
  if (prev.points.length !== next.points.length) return false;
  return prev.points.every((point, index) => {
    const nextPoint = next.points[index];
    return point.distanceKm === nextPoint.distanceKm && point.elevationM === nextPoint.elevationM;
  });
});
