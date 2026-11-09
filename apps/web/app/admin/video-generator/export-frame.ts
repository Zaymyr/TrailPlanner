export type FrameSize = { width: number; height: number };

/** The preview frame on a 1080p screen, used when a saved composition has no preview size. */
const DEFAULT_PREVIEW_PORTRAIT: FrameSize = { width: 405, height: 720 };

/**
 * Layout of the frame while exporting. It keeps the preview's CSS size, so the camera covers the
 * same area and the station bubbles (sized in cqmin, offset in pixels) sit where they do in the
 * preview; only the map's pixel density rises so its canvas has the video's resolution. Laying the
 * frame out at the video size instead showed 1.4 to 2.7 times more ground, with smaller map
 * details and misplaced bubbles.
 */
export const getExportFrame = (video: FrameSize, preview: FrameSize | null | undefined) => {
  const landscape = video.width > video.height;
  const fallback = landscape
    ? { width: DEFAULT_PREVIEW_PORTRAIT.height, height: DEFAULT_PREVIEW_PORTRAIT.width }
    : DEFAULT_PREVIEW_PORTRAIT;
  const reference = preview && preview.width >= 120 && preview.height >= 120 ? preview : fallback;
  const width = Math.round(reference.width);
  // The video's exact aspect ratio, whatever the rounding of the measured preview.
  const height = Math.round((width * video.height) / video.width);
  return { width, height, pixelRatio: video.width / width };
};

/**
 * Mapbox sizes its canvas and loads its tiles from window.devicePixelRatio, read on every resize.
 * Overriding it renders the map at the video resolution inside a preview-sized frame. Returns the
 * function that restores the real ratio.
 */
export const overrideDevicePixelRatio = (ratio: number) => {
  const own = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, get: () => ratio });
  return () => {
    if (own) Object.defineProperty(window, "devicePixelRatio", own);
    else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
  };
};
