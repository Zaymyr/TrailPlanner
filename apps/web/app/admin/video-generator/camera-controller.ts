import { MercatorCoordinate, type CameraOptions, type Map as MapboxMap } from "mapbox-gl";

import type { VideoRouteBounds } from "../../../lib/video-generator";
import type { CameraPose } from "./route-animation";

export const RESET_CAMERA_PITCH = 55;

export type RouteCameraController = {
  applyAnimationFrame: (frame: CameraPose) => void;
  fitOverview: (duration?: number) => void;
  reset: (duration?: number) => void;
};

const getCameraForBounds = (map: MapboxMap, bounds: VideoRouteBounds): CameraOptions => {
  const isSinglePoint = bounds.minLat === bounds.maxLat && bounds.minLon === bounds.maxLon;
  if (isSinglePoint) {
    return { center: [bounds.minLon, bounds.minLat], zoom: 14 };
  }

  return map.cameraForBounds(
    [
      [bounds.minLon, bounds.minLat],
      [bounds.maxLon, bounds.maxLat],
    ],
    { padding: { top: 72, right: 72, bottom: 72, left: 72 } },
  ) ?? { center: [bounds.minLon, bounds.minLat], zoom: 10 };
};

export const createRouteCameraController = (
  map: MapboxMap,
  getBounds: () => VideoRouteBounds,
): RouteCameraController => ({
  applyAnimationFrame: (frame) => {
    const camera = map.getFreeCameraOptions();
    camera.position = MercatorCoordinate.fromLngLat(
      [frame.camera.lon, frame.camera.lat],
      frame.camera.altitudeM,
    );
    camera.lookAtPoint(
      [frame.target.lon, frame.target.lat],
      [0, 0, 1],
      frame.target.altitudeM,
    );
    map.setFreeCameraOptions(camera);
  },
  fitOverview: (duration = 700) => {
    const camera = getCameraForBounds(map, getBounds());
    map.easeTo({
      ...camera,
      bearing: map.getBearing(),
      pitch: map.getPitch(),
      duration,
    });
  },
  reset: (duration = 700) => {
    const camera = getCameraForBounds(map, getBounds());
    map.easeTo({ ...camera, bearing: 0, pitch: RESET_CAMERA_PITCH, duration });
  },
});
