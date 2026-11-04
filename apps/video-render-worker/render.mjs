import { chromium } from "playwright";

import { parseRenderUrl } from "./render-url.mjs";

// The render page does the whole job (load, frame-by-frame export, upload, report); this script only
// gives it a browser of the exact video size and waits. Without a GPU, WebGL runs on SwiftShader.
const TIMEOUT_MS = Number(process.env.RENDER_TIMEOUT_MS ?? 165 * 60 * 1_000);
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

const main = async () => {
  const render = parseRenderUrl(process.env.RENDER_URL);
  console.log(`Rendering job ${render.jobId} at ${render.width}x${render.height}`);

  const browser = await chromium.launch({
    // Google Chrome, not Chromium: it ships the H.264 encoder WebCodecs needs.
    channel: "chrome",
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--autoplay-policy=no-user-gesture-required",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
    ],
  });
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
