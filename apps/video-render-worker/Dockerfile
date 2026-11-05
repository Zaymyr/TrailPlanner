# Cloud Run job image: Playwright's Ubuntu base (fonts, system libraries) plus Google Chrome, whose
# WebCodecs H.264 encoder the export needs (Chromium builds have none).
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npx playwright install --with-deps chrome

# GPU jobs: Cloud Run mounts the NVIDIA driver in /usr/local/nvidia/lib64. The Vulkan loader and the
# Vulkan/EGL vendor files point Chrome's ANGLE at it; without a GPU they are unused and gpu.mjs falls
# back to SwiftShader.
RUN apt-get update \
  && apt-get install -y --no-install-recommends libvulkan1 libegl1 \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /etc/vulkan/icd.d /usr/share/glvnd/egl_vendor.d \
  && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libGLX_nvidia.so.0","api_version":"1.3"}}' > /etc/vulkan/icd.d/nvidia_icd.json \
  && echo '{"file_format_version":"1.0.0","ICD":{"library_path":"libEGL_nvidia.so.0"}}' > /usr/share/glvnd/egl_vendor.d/10_nvidia.json
ENV LD_LIBRARY_PATH=/usr/local/nvidia/lib64

COPY gpu.mjs render-url.mjs render.mjs ./

USER pwuser
CMD ["node", "render.mjs"]
