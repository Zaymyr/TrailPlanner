import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRenderUrl } from "./render-url.mjs";

const jobId = "11111111-1111-4111-8111-111111111111";

test("reads the job, the video size and the fragment token", () => {
  const render = parseRenderUrl(`https://pace-yourself.com/render/video/${jobId}?w=1080&h=1920#token=123.abc`);
  assert.equal(render.jobId, jobId);
  assert.equal(render.width, 1080);
  assert.equal(render.height, 1920);
  assert.equal(render.token, "123.abc");
  assert.equal(render.reportUrl, `https://pace-yourself.com/api/video-render/jobs/${jobId}`);
});

test("rejects URLs that are not a render page or miss the token or size", () => {
  assert.throws(() => parseRenderUrl(undefined), /missing/);
  assert.throws(() => parseRenderUrl(`https://pace-yourself.com/admin/${jobId}?w=1080&h=1920#token=x`), /render page/);
  assert.throws(() => parseRenderUrl(`https://pace-yourself.com/render/video/${jobId}?w=1080&h=1920`), /token/);
  assert.throws(() => parseRenderUrl(`https://pace-yourself.com/render/video/${jobId}#token=x`), /size/);
});
