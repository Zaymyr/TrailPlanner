export type FrameSize = { width: number; height: number };

/** The preview frame on a 1080p screen, used when a saved composition has no preview size. */
const DEFAULT_PREVIEW_PORTRAIT: FrameSize = { width: 405, height: 720 };

/**
 * Map pixel density of an export. Mapbox picks its tile level from the frame's CSS size: a frame
 * of video width ÷ 2 CSS pixels at density 2 loads the tile level made for the video resolution
 * (the style's paths, contour lines and streams appear, the relief is finer). The former frame,
 * the preview size (≈ 405 px) at density 2.67, stayed about 0.4 zoom level below and looked
 * unfinished. The camera is placed in metres (free camera), so the framing does not change.
 */
export const EXPORT_MAP_PIXEL_RATIO = 2;

/**
 * Layout of the frame while exporting: the video size ÷ EXPORT_MAP_PIXEL_RATIO in CSS pixels (never
 * smaller than the preview), with `pixelRatio` raising the map canvas to the video resolution.
 * `pxScale` = frame width ÷ preview width: what the map's fixed pixel sizes (route width, station
 * icons, marker offsets, progress dot) are multiplied by so they keep their size relative to the
 * picture; the overlay and the bubbles are sized in cqmin and follow on their own.
 */
export const getExportFrame = (video: FrameSize, preview: FrameSize | null | undefined) => {
  const landscape = video.width > video.height;
  const fallback = landscape
    ? { width: DEFAULT_PREVIEW_PORTRAIT.height, height: DEFAULT_PREVIEW_PORTRAIT.width }
    : DEFAULT_PREVIEW_PORTRAIT;
  const reference = preview && preview.width >= 120 && preview.height >= 120 ? preview : fallback;
  const width = Math.max(Math.round(reference.width), Math.round(video.width / EXPORT_MAP_PIXEL_RATIO));
  // The video's exact aspect ratio, whatever the rounding of the measured preview.
  const height = Math.round((width * video.height) / video.width);
  return { width, height, pixelRatio: video.width / width, pxScale: width / reference.width };
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
