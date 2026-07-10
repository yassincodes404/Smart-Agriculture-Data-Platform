# AgriData Egypt — Android Mobile App

Full mobile client for the Smart Agriculture Data Platform. Same features as the web app at [https://smartagri.azurewebsites.net/](https://smartagri.azurewebsites.net/), talking to the live Azure backend.

## Architecture (recommended)

| Layer | Technology |
|-------|------------|
| UI | Existing React + Vite web app (`services/frontend/web`) |
| Native shell | **Capacitor 8** → Android project |
| Build | Android Studio SDK / Gradle |
| Backend | `https://smartagri.azurewebsites.net/api/v1` |

Capacitor packages the production web build into a native Android WebView app. **CapacitorHttp** is enabled so API calls work without browser CORS limits.

> There is also a React Native / Expo app under `packages/mobile` (native screens). Prefer Capacitor when you need **full feature parity** with the website.

## What works on mobile

- Login / Register (email + password)
- Dashboard, lands list, land detail
- Add land (map draw + discovery pipeline)
- Satellite imagery, NDVI, climate / soil / water
- AI insights, crop health, harvest prediction
- Compare lands, profile, admin logs (if admin)
- Excel export (where the web UI exposes it)

### Google Sign-In on mobile

Native Google Sign-In uses `@capawesome/capacitor-google-sign-in` and your **Firebase** Android app.

| Setting | Value |
|---------|--------|
| Package name | `com.company.smart_agri` |
| Debug SHA-1 | `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` |
| Native Web client ID (token audience) | `609875913005-2od36vgq10osdp1ajohibcap37jab4ho.apps.googleusercontent.com` |
| Website GIS client ID | `596375721075-itbl6d2i44kekhniujmmm0g8jovoc9i6.apps.googleusercontent.com` |

**Azure App Service environment variables (required):**

```env
GOOGLE_CLIENT_ID=596375721075-itbl6d2i44kekhniujmmm0g8jovoc9i6.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=609875913005-2od36vgq10osdp1ajohibcap37jab4ho.apps.googleusercontent.com
```

`GOOGLE_CLIENT_IDS` is critical: native Android ID tokens use the **Firebase** web client as audience. Without it, Google appears to work on the phone then fails on the server.

Restart the Azure app after changing env vars. Backend code must include multi-audience support (`GOOGLE_CLIENT_IDS` in `google_auth.py`).

Email/password login works without Google Cloud setup.

## Prerequisites

1. **Node.js** 18+
2. **Android Studio** with Android SDK (API 24+)
3. **Java 17+** (bundled JBR from Android Studio is fine)
4. Environment variable `ANDROID_HOME` (or `local.properties` is written automatically by the build script)

## Build APK (one command)

From the **repo root**:

```powershell
# Debug APK (easiest to install / sideload)
.\scripts\build_android_apk.ps1

# Signed release APK
.\scripts\build_android_apk.ps1 -Release

# Build + open project in Android Studio
.\scripts\build_android_apk.ps1 -OpenStudio
```

### Output locations

| Variant | Path |
|---------|------|
| Debug | `services/frontend/web/android/app/build/outputs/apk/debug/app-debug.apk` |
| Release | `services/frontend/web/android/app/build/outputs/apk/release/app-release.apk` |

Install on a device:

```powershell
adb install -r services\frontend\web\android\app\build\outputs\apk\debug\app-debug.apk
```

## Open in Android Studio

```powershell
cd services\frontend\web
npx.cmd cap open android
```

Or open the folder:

`services/frontend/web/android`

Then use **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

## Production API configuration

File: `services/frontend/web/.env.production`

```env
VITE_API_BASE_URL=https://smartagri.azurewebsites.net/api/v1
```

Capacitor config (`capacitor.config.json`):

- `allowNavigation`: `smartagri.azurewebsites.net`
- `CapacitorHttp.enabled`: `true`
- Android `INTERNET` permission + cleartext allowed for local dev if needed

**Do not put Azure management credentials** (client secret, subscription keys) in the mobile app. The app only needs the public HTTPS API URL. Users authenticate with their own email/password JWT.

## React Native alternative (`packages/mobile`)

Native Expo / React Native screens (Dashboard, Lands, Add Land, Compare, Profile, Land Detail).

```powershell
cd packages\mobile
# API already defaults to Azure via app.json extra.apiBaseUrl
npx.cmd expo prebuild
# or use scripts\build_mobile.ps1
```

Point `app.json` → `expo.extra.apiBaseUrl` at Azure or a local backend as needed.

## Security notes

1. **Never embed** Azure `clientSecret`, subscription keys, or DB passwords in the APK.
2. If a client secret was shared in chat or git, **rotate it** in Azure AD immediately.
3. Mobile auth uses the same backend JWT flow as the website (`/auth/login`, refresh tokens in localStorage / SecureStore).
