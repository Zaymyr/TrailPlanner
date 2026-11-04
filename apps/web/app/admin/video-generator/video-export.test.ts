// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportVideo, ExportUnsupportedError, type ExportFrameDriver } from "./video-export";

const media = vi.hoisted(() => ({
  canEncodeVideo: vi.fn(async () => true),
  canEncodeAudio: vi.fn(async () => true),
  added: [] as Array<{ timestamp: number; duration: number }>,
  started: vi.fn(),
  finalized: vi.fn(),
  cancelled: vi.fn(),
  formatOptions: null as unknown,
}));

vi.mock("mediabunny", () => {
  class BufferTarget {
    buffer: ArrayBuffer | null = null;
  }
  class Mp4OutputFormat {
    constructor(options: unknown) {
      media.formatOptions = options;
    }
  }
  class CanvasSource {
    async add(timestamp: number, duration: number) {
      media.added.push({ timestamp, duration });
    }
  }
  class AudioBufferSource {
    async add() {}
  }
  class Output {
    constructor(private readonly options: { target: BufferTarget }) {}
    addVideoTrack() {}
    addAudioTrack() {}
    async start() {
      media.started();
    }
    async finalize() {
      media.finalized();
      this.options.target.buffer = new ArrayBuffer(16);
    }
    async cancel() {
      media.cancelled();
    }
  }
  return {
    AudioBufferSource,
    BufferTarget,
    CanvasSource,
    Mp4OutputFormat,
    Output,
    canEncodeAudio: media.canEncodeAudio,
    canEncodeVideo: media.canEncodeVideo,
  };
});

vi.mock("html-to-image", () => ({
  getFontEmbedCSS: vi.fn(async () => ""),
  toCanvas: vi.fn(async () => document.createElement("canvas")),
}));

const driver = (renderFrame = vi.fn(async () => undefined)): ExportFrameDriver & { renderFrame: typeof renderFrame } => ({
  renderFrame,
  mapCanvas: () => document.createElement("canvas"),
  frameElement: () => document.createElement("div"),
});

describe("exportVideo", () => {
  beforeEach(() => {
    media.added.length = 0;
    media.canEncodeVideo.mockResolvedValue(true);
    vi.stubGlobal("VideoEncoder", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
    }) as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders every frame at index / fps and writes a fast-start MP4", async () => {
    const frames = driver();
    const blob = await exportVideo({
      width: 540, height: 960, fps: 30, totalMs: 1_000, driver: frames, narration: null, onProgress: vi.fn(), signal: new AbortController().signal,
    });
    expect(blob.type).toBe("video/mp4");
    expect(frames.renderFrame).toHaveBeenCalledTimes(30);
    expect(frames.renderFrame.mock.calls[15][0]).toBeCloseTo(500, 6);
    expect(media.added[29]).toEqual({ timestamp: 29 / 30, duration: 1 / 30 });
    expect(media.formatOptions).toEqual({ fastStart: "in-memory" });
    expect(media.finalized).toHaveBeenCalled();
  });

  it("stops and discards the file when cancelled", async () => {
    const controller = new AbortController();
    const frames = driver(vi.fn(async () => {
      if (media.added.length === 3) controller.abort();
    }));
    await expect(exportVideo({
      width: 540, height: 960, fps: 30, totalMs: 2_000, driver: frames, narration: null, onProgress: vi.fn(), signal: controller.signal,
    })).rejects.toThrow("Export annulé.");
    expect(media.cancelled).toHaveBeenCalled();
    expect(media.added.length).toBeLessThan(10);
  });

  it("explains when the browser cannot encode H.264", async () => {
    media.canEncodeVideo.mockResolvedValue(false);
    await expect(exportVideo({
      width: 1_080, height: 1_920, fps: 30, totalMs: 1_000, driver: driver(), narration: null, onProgress: vi.fn(), signal: new AbortController().signal,
    })).rejects.toBeInstanceOf(ExportUnsupportedError);
  });
});
