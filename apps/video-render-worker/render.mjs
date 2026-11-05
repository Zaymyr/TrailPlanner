import { chromium } from "playwright";

import { backendOrder, chromeArgs, describeNvidiaLibs, isHardwareRenderer, probeWebglRenderer } from "./gpu.mjs";
import { parseRenderUrl } from "./render-url.mjs";

// The render page does the whole job (load, frame-by-frame export, upload, report); this script only
// gives it a browser of the exact video size and waits. WebGL runs on the job's NVIDIA GPU when one is
// attached and Chrome can use it, otherwise on SwiftShader (CPU).
// Stays under the Cloud Run task timeout and MAX_RENDER_HOURS (apps/web/lib/video-render.ts).
const TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS ?? 7.75 * 60 * 60 * 1_000);
const POLL_MS = 5_000;

const reportFailure = async (render, message) => {
  try {
    await fetch(render.reportUrl, {
      method: "POST",
      headers: { Authorization: `Render ${render.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "failed", message: message.slice(0, 500) }),
    });
  } catch (error) {
    console.error("Unable to report the failure", error);
  }
};

/** First backend whose WebGL renderer is really a GPU; SwiftShader is the last resort. */
const launchBestBrowser = async () => {
  const backends = backendOrder({ gpuSetting: process.env.RENDER_GPU });
  if (backends.length > 1) console.log(`NVIDIA driver: ${describeNvidiaLibs()}`);
  for (const backend of backends) {
    let browser;
    try {
      // Google Chrome, not Chromium: it ships the H.264 encoder WebCodecs needs.
      browser = await chromium.launch({ channel: "chrome", headless: true, args: chromeArgs(backend) });
      const probe = await browser.newPage();
      const renderer = await probe.evaluate(probeWebglRenderer).catch(() => null);
      await probe.close();
      if (backend === "swiftshader" || isHardwareRenderer(renderer)) {
        console.log(`WebGL backend: ${backend} (${renderer ?? "no WebGL context"})`);
        return browser;
      }
      console.log(`WebGL backend ${backend} unusable (${renderer ?? "no WebGL context"}), trying the next one`);
    } catch (error) {
      console.log(`WebGL backend ${backend} failed to start: ${error?.message ?? error}`);
    }
    await browser?.close().catch(() => {});
  }
  throw new Error("No WebGL backend could start.");
};

const main = async () => {
  const render = parseRenderUrl(process.env.RENDER_URL);
  console.log(`Rendering job ${render.jobId} at ${render.width}x${render.height}`);

  const browser = await launchBestBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: render.width, height: render.height }, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") console.log(`[page ${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => console.log(`[page error] ${error.message}`));

    await page.goto(render.pageUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForFunction(
      () => window.__videoRender?.status === "done" || window.__videoRender?.status === "failed",
      null,
      { timeout: TIMEOUT_MS, polling: POLL_MS },
    );
    const result = await page.evaluate(() => window.__videoRender);
    if (result?.status !== "done") {
      // The page already reported its failure.
      throw Object.assign(new Error(result?.message ?? "Render failed."), { reported: true });
    }
    console.log(`Job ${render.jobId} done`);
  } catch (error) {
    if (!error?.reported) {
      const timedOut = error?.name === "TimeoutError";
      await reportFailure(render, timedOut ? "Le rendu a dépassé le temps maximum." : `Le moteur de rendu a échoué : ${error?.message ?? error}`);
    }
    throw error;
  } finally {
    await browser.close();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
