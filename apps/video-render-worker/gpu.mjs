import { existsSync, readdirSync } from "node:fs";

// Where Cloud Run mounts the NVIDIA driver libraries when the job has a GPU.
export const NVIDIA_LIB_DIR = "/usr/local/nvidia/lib64";

const COMMON_ARGS = [
  "--autoplay-policy=no-user-gesture-required",
  "--disable-background-timer-throttling",
  "--disable-renderer-backgrounding",
  "--disable-backgrounding-occluded-windows",
  "--ignore-gpu-blocklist",
];

/** Chrome flags per WebGL backend: the NVIDIA GPU through Vulkan or EGL, or SwiftShader on the CPU. */
export const BACKEND_ARGS = {
  vulkan: ["--use-angle=vulkan", "--enable-features=Vulkan", "--disable-vulkan-surface", "--enable-gpu-rasterization"],
  egl: ["--use-gl=angle", "--use-angle=gl-egl", "--enable-gpu-rasterization"],
  swiftshader: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
};

export const chromeArgs = (backend) => [...BACKEND_ARGS[backend], ...COMMON_ARGS];

/**
 * Backends to try, best first. RENDER_GPU=off forces the CPU; without the mounted NVIDIA
 * libraries there is no GPU to try.
 */
export const backendOrder = ({ gpuSetting = "auto", hasNvidia = existsSync(NVIDIA_LIB_DIR) } = {}) =>
  gpuSetting === "off" || !hasNvidia ? ["swiftshader"] : ["vulkan", "egl", "swiftshader"];

/** A WebGL renderer string that still names a software rasterizer is not a GPU. */
export const isHardwareRenderer = (renderer) =>
  typeof renderer === "string" && renderer.length > 0 && !/swiftshader|llvmpipe|softpipe|software/i.test(renderer);

/** Short inventory of the mounted driver, logged once to diagnose a missing GPU backend. */
export const describeNvidiaLibs = (dir = NVIDIA_LIB_DIR) => {
  if (!existsSync(dir)) return "no NVIDIA driver mounted";
  const names = readdirSync(dir).filter((name) => /GLX_nvidia|EGL_nvidia|vulkan|nvidia-glcore|libcuda/i.test(name));
  return names.length ? names.join(", ") : `${dir} has no graphics library`;
};

/** Runs in the page: the unmasked WebGL renderer, or null without a context. */
export const probeWebglRenderer = () => {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
  if (!gl) return null;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
};
