import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { Colors } from '../../constants/colors';
import type { ElevationPoint } from './profile-utils';
import { styles } from './styles';

type Props = {
  points: ElevationPoint[];
};

const CHART_HEIGHT = 96;
const AXIS_WIDTH = 34;
const TOP_PADDING = 10;
const RIGHT_PADDING = 8;
const BOTTOM_PADDING = 18;

function samplePoints(points: ElevationPoint[], maxPoints = 72) {
  const step = Math.max(1, Math.ceil(points.length / maxPoints));
  const sampled = points.filter((_, index) => index % step === 0);
  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) sampled.push(lastPoint);
  return sampled;
}

function slopeToGreen(gradePercent: number) {
  const intensity = Math.min(1, Math.abs(gradePercent) / 14);
  const light = { r: 210, g: 236, b: 200 };
  const dark = { r: 31, g: 91, b: 49 };
  const channel = (from: number, to: number) => Math.round(from + (to - from) * intensity);
  return `rgb(${channel(light.r, dark.r)}, ${channel(light.g, dark.g)}, ${channel(light.b, dark.b)})`;
}

function buildTicks(minElevation: number, maxElevation: number) {
  if (maxElevation === minElevation) {
    return [Math.round(minElevation), Math.round(minElevation + 50)];
  }
  return [
    Math.round(maxElevation),
    Math.round((maxElevation + minElevation) / 2),
    Math.round(minElevation),
  ];
}

export const ProfileMiniChart = React.memo(function ProfileMiniChart({ points }: Props) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    const nextWidth = Math.round(event.nativeEvent.layout.width);
    if (nextWidth !== width) setWidth(nextWidth);
  };

  const chart = useMemo(() => {
    if (points.length < 2 || width <= 0) return null;

    const sampled = samplePoints(points);
    const chartWidth = Math.max(1, width - AXIS_WIDTH - RIGHT_PADDING);
    const innerHeight = CHART_HEIGHT - TOP_PADDING - BOTTOM_PADDING;
    const minElevation = Math.min(...sampled.map((point) => point.elevationM));
    const maxElevation = Math.max(...sampled.map((point) => point.elevationM));
    const elevationSpread = Math.max(1, maxElevation - minElevation);
    const maxDistance = Math.max(sampled[sampled.length - 1]?.distanceKm ?? 1, 0.001);

    const xFor = (distanceKm: number) => AXIS_WIDTH + (distanceKm / maxDistance) * chartWidth;
    const yFor = (elevationM: number) =>
      TOP_PADDING + innerHeight - ((elevationM - minElevation) / elevationSpread) * innerHeight;

    const path = sampled
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(point.distanceKm)} ${yFor(point.elevationM)}`)
      .join(' ');

    const areaPath = `${path} L ${xFor(sampled[sampled.length - 1]?.distanceKm ?? 0)} ${TOP_PADDING + innerHeight} L ${AXIS_WIDTH} ${TOP_PADDING + innerHeight} Z`;

    const gradientStops = sampled.slice(1).flatMap((point, index) => {
      const previousPoint = sampled[index] ?? point;
      const deltaDistanceKm = Math.max(point.distanceKm - previousPoint.distanceKm, 0.001);
      const gradePercent = ((point.elevationM - previousPoint.elevationM) / (deltaDistanceKm * 1000)) * 100;
      const color = slopeToGreen(gradePercent);
      const startOffset = `${Math.max(0, Math.min(100, (previousPoint.distanceKm / maxDistance) * 100))}%`;
      const endOffset = `${Math.max(0, Math.min(100, (point.distanceKm / maxDistance) * 100))}%`;

      return [
        <Stop key={`start-${index}`} offset={startOffset} stopColor={color} />,
        <Stop key={`end-${index}`} offset={endOffset} stopColor={color} />,
      ];
    });

    return {
      areaPath,
      gradientStops,
      maxDistance,
      path,
      ticks: buildTicks(minElevation, maxElevation),
      yFor,
    };
  }, [points, width]);

  if (points.length < 2) {
    return <View style={styles.profileChartEmpty} />;
  }

  return (
    <View style={styles.profileChart} onLayout={onLayout}>
      {width > 0 && chart ? (
        <Svg width={width} height={CHART_HEIGHT}>
          <Defs>
            <LinearGradient id="profile-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              {chart.gradientStops}
            </LinearGradient>
            <LinearGradient id="profile-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#A9D6A1" stopOpacity="0.35" />
              <Stop offset="100%" stopColor="#A9D6A1" stopOpacity="0.06" />
            </LinearGradient>
          </Defs>

          {chart.ticks.map((tick) => {
            const y = chart.yFor(tick);
            return (
              <React.Fragment key={tick}>
                <Line
                  x1={AXIS_WIDTH}
                  x2={width - RIGHT_PADDING}
                  y1={y}
                  y2={y}
                  stroke={Colors.border}
                  strokeDasharray="3 4"
                  strokeWidth={1}
                />
                <SvgText x={AXIS_WIDTH - 6} y={y + 4} fill={Colors.textMuted} fontSize="10" textAnchor="end">
                  {tick} m
                </SvgText>
              </React.Fragment>
            );
          })}

          <Path d={chart.areaPath} fill="url(#profile-area-gradient)" />
          <Path d={chart.path} fill="none" stroke="url(#profile-line-gradient)" strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />

          <SvgText x={AXIS_WIDTH} y={CHART_HEIGHT - 4} fill={Colors.textMuted} fontSize="10" textAnchor="start">
            0 km
          </SvgText>
          <SvgText x={width - RIGHT_PADDING} y={CHART_HEIGHT - 4} fill={Colors.textMuted} fontSize="10" textAnchor="end">
            {chart.maxDistance >= 100 ? chart.maxDistance.toFixed(0) : chart.maxDistance.toFixed(1)} km
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}, (prev, next) => {
  if (prev.points.length !== next.points.length) return false;
  return prev.points.every((point, index) => {
    const nextPoint = next.points[index];
    return point.distanceKm === nextPoint.distanceKm && point.elevationM === nextPoint.elevationM;
  });
});
