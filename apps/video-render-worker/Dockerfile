# Cloud Run job image: Playwright's Ubuntu base (fonts, system libraries) plus Google Chrome, whose
# WebCodecs H.264 encoder the export needs (Chromium builds have none).
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npx playwright install --with-deps chrome

COPY render-url.mjs render.mjs ./

USER pwuser
CMD ["node", "render.mjs"]
