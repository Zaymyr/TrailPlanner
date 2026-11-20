/**
 * Reads the render page URL handed to the Cloud Run job:
 * `https://app/render/video/<job id>?w=1080&h=1920[&bypass…]#token=<job token>`, or the carousel
 * page `https://app/render/carousel/<job id>?w=1080&h=1350#token=…` (JPEG slides, same protocol).
 */
export const parseRenderUrl = (value) => {
  if (!value) throw new Error("RENDER_URL is missing.");
  const url = new URL(value);
  const match = url.pathname.match(/^\/render\/(video|carousel)\/([0-9a-f-]{36})$/i);
  if (!match) throw new Error("RENDER_URL is not a render page URL.");
  const width = Number(url.searchParams.get("w"));
  const height = Number(url.searchParams.get("h"));
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 160 || height < 160 || width > 4096 || height > 4096) {
    throw new Error("RENDER_URL has no valid video size.");
  }
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  if (!token) throw new Error("RENDER_URL has no job token.");
  const kind = match[1].toLowerCase();
  const jobId = match[2];
  return {
    kind,
    jobId,
    width,
    height,
    token,
    reportUrl: new URL(kind === "carousel" ? `/api/carousel-render/jobs/${jobId}` : `/api/video-render/jobs/${jobId}`, url.origin).toString(),
    pageUrl: url.toString(),
  };
};
