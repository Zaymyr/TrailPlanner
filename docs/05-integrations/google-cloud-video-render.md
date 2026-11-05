---
title: Google Cloud Background Reel Render
scope: integration
last_verified: 2026-11-04
ai_priority: medium
related_files:
  - apps/web/app/api/admin/video-generator/render-jobs/[id]/route.test.ts
  - apps/web/app/api/admin/video-generator/render-jobs/[id]/route.ts
  - apps/web/app/admin/video-generator/export-frame.test.ts
  - apps/web/app/admin/video-generator/export-frame.ts
  - apps/video-render-worker/package.json
  - apps/video-render-worker/package-lock.json
  - apps/video-render-worker/Dockerfile
  - apps/video-render-worker/render.mjs
  - apps/video-render-worker/render-url.mjs
  - apps/video-render-worker/render-url.test.mjs
  - apps/video-render-worker/gpu.mjs
  - apps/video-render-worker/gpu.test.mjs
  - .github/workflows/video-render-worker.yml
  - apps/web/lib/video-render.ts
  - apps/web/lib/video-render.test.ts
  - apps/web/lib/video-render-api.ts
  - apps/web/app/api/admin/video-generator/render-jobs/route.ts
  - apps/web/app/api/admin/video-generator/render-jobs/[id]/start/route.ts
  - apps/web/app/api/video-render/jobs/[id]/route.ts
  - apps/web/app/render/video/[id]/page.tsx
  - apps/web/app/render/video/[id]/RenderVideoClient.tsx
  - apps/web/app/admin/video-generator/BackgroundRenderPanel.tsx
  - apps/web/app/admin/video-generator/render-snapshot.ts
  - apps/web/app/admin/video-generator/video-export.ts
  - supabase/migrations/20261104140000_add_video_render_jobs.sql
related_tables:
  - video_render_jobs
---

# Google Cloud Background Reel Render

## Purpose

The admin 3D reel can be exported in the browser, which needs the tab open and visible for the whole render. "Générer en arrière-plan" renders the same composition on Google Cloud instead: the admin can close the tab and downloads the MP4 later from the same panel.

## Flow

1. The admin clicks "Générer en arrière-plan". The browser posts `{ raceId, raceTitle, width, height }` to `POST /api/admin/video-generator/render-jobs`, which inserts a `video_render_jobs` row (`uploading`) and returns a 15-minute signed PUT URL.
2. The browser uploads the composition snapshot (`render-snapshot.ts`: route points, stations, settings, edited narration, summit names, generated voice clips) straight to Cloud Storage as `jobs/<id>/input.json`. It can weigh several megabytes, more than a serverless request body allows.
3. `POST /api/admin/video-generator/render-jobs/<id>/start` checks the snapshot exists, then runs one execution of the Cloud Run job `video-render` with a single env override, `RENDER_URL`: `https://<app>/render/video/<id>?w=<width>&h=<height>#token=<job token>`. The row becomes `queued`.
4. The job (`apps/video-render-worker`) opens that URL in headless Google Chrome with a window of exactly the video size and waits for `window.__videoRender.status` to be `done` or `failed` (55 min at most, `RENDER_TIMEOUT_MS`, set by the deploy). WebGL runs on the job's NVIDIA L4: `gpu.mjs` tries ANGLE on Vulkan, then on EGL, keeps the first whose unmasked WebGL renderer is not a software rasterizer, and falls back to SwiftShader (CPU); the chosen backend, its renderer string and the mounted driver libraries are logged. `RENDER_GPU=off` forces SwiftShader.
5. The render page (`/render/video/[id]`, standalone, noindex) calls `GET /api/video-render/jobs/<id>` with the token. That call marks the job `running` and returns a signed GET URL of the snapshot and a signed PUT URL for `jobs/<id>/reel.mp4` valid `MAX_RENDER_HOURS` (8 h). It then mounts the normal viewer in render mode: the saved settings, narration, landmarks and clips seed its state, no panel is shown, the Tilequery peak lookup is skipped and the export starts as soon as the map is ready. The snapshot carries the editor's `previewSize` (CSS size of the preview frame; 405 × 720, or 720 × 405 in 16:9, for snapshots saved before): the page forces `window.devicePixelRatio` to video width ÷ preview width before creating the map, so the render frames the map exactly like the preview, at the video resolution.
6. Progress is reported every 5 s (`POST … { status: "running", progress }`). At the end the page uploads the MP4 and reports `done`; the route checks the object size before marking the job `done`. Errors are reported as `failed` with their message. If the page never reports (crash, timeout), the worker reports the failure itself.
7. `GET /api/admin/video-generator/render-jobs` lists the last 8 jobs with a 1-hour signed download URL for finished ones (attachment named after the race). The panel polls every 10 s while a job is active. An active job is marked `failed` when it has not reported for 15 minutes (`updated_at`, refreshed by every 5-s progress report) or is older than `MAX_RENDER_HOURS` + 1 h (`isRenderJobStale`). Before, a job was failed 2 hours after its creation even while still reporting, which cut long CPU renders.

## Security

- Vercel reaches Google through OIDC federation: the `x-vercel-oidc-token` request header (or `VERCEL_OIDC_TOKEN` locally) is exchanged at Google STS for a federated token, then for an access token of `vercel-trigger@<project>` (`generateAccessToken`). No Google key exists. The workload identity pool `vercel` trusts the issuer `https://oidc.vercel.com/zaymyrs-projects` and only the subjects `owner:zaymyrs-projects:project:trail-planner:environment:production|preview`.
- `vercel-trigger` can only run the job with overrides (`roles/run.jobsExecutorWithOverrides`), act as the runtime account, read and write render objects and sign URLs for itself (`signBlob`).
- GitHub deploys through the pool `github`, restricted to the repository `Zaymyr/TrailPlanner`, as `github-deployer` (`run.developer`, `artifactregistry.writer`).
- The job runs as `video-render-runtime`, which has no project role: the container never holds a Supabase or Google credential. It only knows the render URL.
- The job token is an HMAC (`VIDEO_RENDER_TOKEN_SECRET`) of the job id and an expiry (3 hours), checked in constant time. It is bound to one job, travels in the URL fragment (never sent to a server or logged) and is presented as `Authorization: Render <token>`. It is visible to project viewers in the execution env override, like the optional `VERCEL_AUTOMATION_BYPASS_SECRET` added for protected preview deployments.
- `video_render_jobs` has RLS on and no policy; only the service role reads and writes it.

## Configuration

Vercel (server-only): `GCP_PROJECT_ID`, `GCP_PROJECT_NUMBER`, `GCP_SERVICE_ACCOUNT_EMAIL` (`vercel-trigger@…`), optional `GCP_WORKLOAD_IDENTITY_POOL_ID` / `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` (default `vercel`), optional `GCP_REGION` (default `europe-west1`), `VIDEO_RENDER_BUCKET`, optional `VIDEO_RENDER_JOB_NAME` (default `video-render`), `VIDEO_RENDER_TOKEN_SECRET` (32+ random characters, Sensitive), optional `VIDEO_RENDER_APP_ORIGIN` to force the origin the renderer opens. "Secure backend access with OIDC federation" must be enabled on the project (team issuer). When a variable is missing, the admin routes answer 503 and the panel says the background render is not configured.

Google Cloud project `flowing-lead-513714-t2`, region `europe-west1`: Artifact Registry repository `video-render`, the Cloud Run job `video-render` (4 vCPU, 16 GiB, 1 NVIDIA L4 without zonal redundancy, 1-hour task timeout, no retry), and a Storage bucket with CORS for browser PUT/GET and a 30-day lifecycle delete.

The workflow `.github/workflows/video-render-worker.yml` tests the worker, builds the image (Playwright Ubuntu base plus Google Chrome, whose WebCodecs H.264 encoder the export needs) and deploys the job on every push to `main` touching the worker, or by hand.

## Gotchas

- Storage is on Google Cloud, not Supabase: the Supabase free plan caps a file at 50 MB, while a 2-minute 1080p reel is about 150 MB.
- Chrome on Linux has no native WebCodecs AAC encoder: `video-export.ts` registers `@mediabunny/aac-encoder` (WASM build of FFmpeg's AAC encoder, loaded only when needed) when `canEncodeAudio("aac")` is false. The same fallback serves Firefox.
- Software WebGL is slow: expect a render to take several times the reel length. Try 540p first.
- The render page must stay a pure replay: anything the viewer fetches or randomizes at runtime would make the render differ from the preview. Summit names are saved in the snapshot for that reason.

The render snapshot also carries the start and finish names shown on the map (`placeNames`), resolved in the editor, so the Cloud Run render does not query Mapbox for them. Snapshots saved before this field default to no labels.

The job list (`GET /api/admin/video-generator/render-jobs`) also returns `startedAt` and `finishedAt`; the panel shows the computing time ("rendu en 6 min 12 s") with the total including the queue, or the elapsed time of a running job. `authorizeRenderAdmin` now builds on `authorizeVideoAdmin` (admin session and Supabase service role, no Google configuration), which the saved-narration routes use alone.

## GPU

The job requests one NVIDIA L4 (`--gpu 1 --gpu-type nvidia-l4 --no-gpu-zonal-redundancy`, which needs at least 4 CPU and 16 GiB). Cloud Run mounts the driver in `/usr/local/nvidia/lib64`; the image adds the Vulkan loader, `libegl1`, a Vulkan ICD file (`libGLX_nvidia.so.0`) and a GLVND EGL vendor file (`libEGL_nvidia.so.0`), and sets `LD_LIBRARY_PATH`. The first GPU deployment in a region gets an automatic quota of 3 L4; a Free Trial billing account cannot use GPUs and must be upgraded to a paid account (the remaining trial credit stays usable). A GPU task over 1 hour is the Preview feature "Long running GPU jobs": the GA `gcloud run jobs deploy` rejects it (`FAILED_PRECONDITION … declared launch stage`), and Google advises 1 hour at most for GPU jobs because GPU tasks are not live migrated. The job therefore keeps a 1-hour task timeout and the worker stops at 55 min. `MAX_RENDER_HOURS` (8 h, `apps/web/lib/video-render.ts`) only bounds the page token, the upload URL lifetime and the stale rule.

Whether Chrome can drive the L4 depends on the graphics libraries in the mounted driver: check the "WebGL backend:" line of the first execution's logs. A fallback to `swiftshader` keeps rendering on the CPU, only slower (a 1080p reel took over 3 hours on 4 vCPU).

## Deleting a video

Each finished or failed render in the panel has a "Supprimer" action (with a confirmation): `DELETE /api/admin/video-generator/render-jobs/<id>` deletes `jobs/<id>/reel.mp4` and `jobs/<id>/input.json` with the Google access token (`deleteStorageObject`, a 404 counts as deleted), then the row (`deleteRenderJob`, limited to `done`/`failed`). A render still `uploading`, `queued` or `running` answers 409. When the bucket refuses the object deletion (the `vercel-trigger` account may lack `storage.objects.delete`), the row is still deleted and the response says `filesDeleted: false`: the 30-day lifecycle removes the files. Dropping the row also lowers the race's video count in the race picker.
