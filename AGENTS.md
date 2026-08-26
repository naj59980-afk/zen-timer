# AGENTS.md

This file documents the scaffolding and agent decisions made while preparing the project for Android dialer/SMS and the segmented leisure timer.

TanStack CLI used (planned):

npx @tanstack/cli@latest create my-tanstack-app --agent --package-manager pnpm --tailwind --add-ons tanstack-query,better-auth

Follow-up intent commands (planned):

npx @tanstack/intent@latest install
npx @tanstack/intent@latest list

Notes:
- The repository currently uses npm (package.json). The TanStack scaffold was requested with pnpm; the project will continue using npm to avoid large-scale changes. If you prefer pnpm, run `pnpm import` and `pnpm install` and update workflows accordingly.

Android build / CI
- A GitHub Actions workflow was added at .github/workflows/android-build.yml. It builds the web app (npm run build) and attempts to assemble an Android release APK via Gradle.
- Required (optional) secrets for signing:
  - ANDROID_KEYSTORE_BASE64: base64-encoded keystore bytes (optional; if not provided the build runs but signing may be skipped)
  - KEYSTORE_PASSWORD
  - KEY_ALIAS
  - KEY_PASSWORD
- The workflow uploads build artifacts (apk) to the workflow run artifacts.

Lovable integration
- Client-side placeholder added at src/integrations/lovable.ts. Do NOT store LOVABLE_API_KEY in client code. Provide a server-side endpoint (/api/lovable/suggest) that proxies requests to Lovable with the key stored in server secrets.

Android native
- The project already contains an Android Capacitor subproject. AndroidManifest.xml includes CALL_PHONE and SMS permissions and an ExitGuardService and BootReceiver.
- To fully support default-dialer and default-sms behavior, the app will request RoleManager roles at runtime. A Capacitor plugin or small native bridge will be added in a follow-up change to expose role requests and secure storage APIs.

Next steps (recommended)
1. Test the web build: `npm ci && npm run build`.
2. Open the Android project and test on device: `npx cap sync android` then open Android Studio.
3. Implement a Capacitor native plugin to request RoleManager roles and store PIN/emergency password securely in Android Keystore.
4. Configure GitHub Secrets if you want CI to sign APKs automatically.
