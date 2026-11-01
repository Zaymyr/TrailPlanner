# Connected-device workflow

Use this workflow only when the audit requires a phone or emulator. Keep every interaction scoped to the requested journey.

## 1. Discover the target

Run `adb devices -l`. If more than one distinct device is connected, ask which one to use. Wireless and mDNS entries can identify the same physical phone; when that is clear from model and product values, select one responsive serial and pass `-s <serial>` to every ADB command. Never rely on ADB's implicit target when multiple transports are listed.

Record, without changing settings:

```powershell
adb -s <serial> shell getprop ro.product.model
adb -s <serial> shell getprop ro.build.version.release
adb -s <serial> shell getprop ro.build.version.sdk
adb -s <serial> shell wm size
adb -s <serial> shell wm density
adb -s <serial> shell settings get system font_scale
```

Confirm the intended package before launching it. Production and development builds may coexist:

- production/e2e: `com.paceyourself.app`
- development client: `com.paceyourself.app.dev`

If the package or build type is uncertain, stop and resolve it from `apps/mobile/app.config.ts`, the installed package list, and the audit request.

## 2. Choose the safest journey

Use `apps/mobile/.maestro/flows/authenticated-shell.yaml` for the established login and root-tab audit. Run it through `npm run test:e2e:ux -w @trailplanner/mobile` only with the dedicated test build and test account described in `docs/06-workflows/mobile-ux-audit.md`.

For a physical development client, preserve its Metro session and application state. Pass the documented values explicitly:

```powershell
$env:APP_ID = 'com.paceyourself.app.dev'
$env:CLEAR_STATE = 'false'
$env:SKIP_DEEP_LINK = 'true'
npm run test:e2e:ux -w @trailplanner/mobile
```

Add `SKIP_LOGIN=true` only when an authenticated session is already open. Add `DISMISS_LOGBOX=true` only after the underlying development error has been captured and reported.

Do not use the default `clearState: true` behavior on a personal or development installation. Do not add authentication bypasses or place credentials in commands, screenshots, logs, Git, or `EXPO_PUBLIC_*` variables.

## 3. Capture comparable evidence

Prefer Maestro `takeScreenshot` steps because they name and order the evidence. Reuse the same screen position and state before and after a proposed correction. Keep ad hoc captures under an operating-system temporary directory, not in the repository.

For each relevant screen, capture:

- the initial viewport;
- the first meaningful scroll position;
- focused keyboard behavior for a representative form;
- modal, loading, empty, error, success, and disabled states when safely reachable;
- the transition into the next step and the return path.

Use screen recording only when motion, sticky behavior, gesture response, or transition continuity is material. Avoid collecting unrelated notifications or personal content.

## 4. Inspect and correlate

Visually inspect every named image. Correlate a finding with the closest component and navigation path, but keep device evidence primary for visual claims. Use `adb logcat` only to explain a visible functional problem; a clean log does not prove good UX.

If the device disconnects, the package is missing, Metro is unavailable, authentication is blocked, or required data cannot be reached safely, report the exact coverage gap. Continue with a clearly labeled code-informed review when it still provides value, but do not describe it as a device audit.
