import assert from "node:assert/strict";
import { test } from "node:test";

import { backendOrder, chromeArgs, isHardwareRenderer } from "./gpu.mjs";

test("tries the GPU backends first only when the NVIDIA driver is mounted", () => {
  assert.deepEqual(backendOrder({ hasNvidia: true }), ["vulkan", "egl", "swiftshader"]);
  assert.deepEqual(backendOrder({ hasNvidia: false }), ["swiftshader"]);
  assert.deepEqual(backendOrder({ gpuSetting: "off", hasNvidia: true }), ["swiftshader"]);
});

test("tells a GPU renderer from a software one", () => {
  assert.equal(isHardwareRenderer("ANGLE (NVIDIA, Vulkan 1.3.277 (NVIDIA L4 (0x000027B8)), NVIDIA)"), true);
  assert.equal(isHardwareRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)"), false);
  assert.equal(isHardwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)"), false);
  assert.equal(isHardwareRenderer(null), false);
});

test("keeps the background-throttling flags on every backend", () => {
  for (const backend of ["vulkan", "egl", "swiftshader"]) {
    assert.ok(chromeArgs(backend).includes("--disable-background-timer-throttling"));
  }
  assert.ok(chromeArgs("swiftshader").includes("--use-angle=swiftshader"));
});
