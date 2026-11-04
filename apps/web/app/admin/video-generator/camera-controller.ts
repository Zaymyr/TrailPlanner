import { MercatorCoordinate, type CameraOptions, type Map as MapboxMap } from "mapbox-gl";

import type { VideoRouteBounds } from "../../../lib/video-generator";
import type { CameraPose } from "./route-animation";

export const RESET_CAMERA_PITCH = 55;

export type RouteCameraController = {
  applyAnimationFrame: (frame: CameraPose) => void;
  fitOverview: (duration?: number) => void;
  reset: (duration?: number) => void;
};

const METERS_PER_DEGREE_LAT = 111_320;

/** Mapbox pitch (0 = straight down) and bearing (degrees from north) of a camera pose. */
export const getPitchBearing = ({ camera, target }: CameraPose) => {
  const eastM = (target.lon - camera.lon) * METERS_PER_DEGREE_LAT * Math.cos((camera.lat * Math.PI) / 180);
  const northM = (target.lat - camera.lat) * METERS_PER_DEGREE_LAT;
  const groundM = Math.hypot(eastM, northM);
  const dropM = Math.max(1, camera.altitudeM - target.altitudeM);
  return {
    pitch: Math.min(85, (Math.atan2(groundM, dropM) * 180) / Math.PI),
    bearing: groundM > 0 ? (Math.atan2(eastM, northM) * 180) / Math.PI : 0,
  };
};

const getCameraForBounds =(map: MapboxMap, bounds: VideoRouteBounds): CameraOptions => {
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
    // Orientation from our own camera → target vector. `lookAtPoint` re-reads the terrain under
    // the target every frame, so ravines and ridges under a smoothly moving target made the view
    // nod; the pose already carries a smoothed target altitude.
    const { pitch, bearing } = getPitchBearing(frame);
    camera.setPitchBearing(pitch, bearing);
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
