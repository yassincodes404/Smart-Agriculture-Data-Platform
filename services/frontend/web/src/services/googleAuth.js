/**
 * googleAuth.js
 * -------------
 * Google Sign-In for web (GIS) and native Capacitor (Credential Manager).
 *
 * Native Android must use:
 *  - package name registered in Firebase / Google Cloud: com.company.smart_agri
 *  - SHA-1 of the APK signing cert (debug.keystore from packages/mobile)
 *  - Web client ID from the SAME Google project as the Android OAuth client
 *    so the ID token audience is accepted by the backend.
 */

import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";

/**
 * Website GIS client (project 596375…).
 * Keep for browser "Sign in with Google" button.
 */
export const GOOGLE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "596375721075-itbl6d2i44kekhniujmmm0g8jovoc9i6.apps.googleusercontent.com";

/**
 * Firebase / Android-linked Web client (project 609875…).
 * Used as serverClientId for native ID tokens so audience matches
 * the OAuth clients tied to package com.company.smart_agri.
 * Backend must list this in GOOGLE_CLIENT_ID or GOOGLE_CLIENT_IDS.
 */
export const GOOGLE_NATIVE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_NATIVE_CLIENT_ID ||
  "609875913005-2od36vgq10osdp1ajohibcap37jab4ho.apps.googleusercontent.com";

const NATIVE_PACKAGE = "com.company.smart_agri";

let nativeInitialized = false;

export function isNativePlatform() {
  return Capacitor.isNativePlatform();
}

export async function initNativeGoogleSignIn() {
  if (!isNativePlatform() || nativeInitialized) return;
  if (!GOOGLE_NATIVE_WEB_CLIENT_ID) {
    throw new Error("Native Google Client ID is not configured.");
  }
  await GoogleSignIn.initialize({
    // Must be a *Web* client ID from the Firebase Google project
    clientId: GOOGLE_NATIVE_WEB_CLIENT_ID,
  });
  nativeInitialized = true;
}

/**
 * @returns {Promise<string>} Google ID token for POST /auth/google
 */
export async function signInWithGoogleNative() {
  await initNativeGoogleSignIn();
  try {
    const result = await GoogleSignIn.signIn();
    if (!result?.idToken) {
      throw new Error(
        "Google did not return an ID token. Ensure Azure accepts the Firebase web client ID."
      );
    }
    return result.idToken;
  } catch (err) {
    const code = err?.code || err?.errorMessage || "";
    const msg = String(err?.message || err || "");

    if (code === "SIGN_IN_CANCELED" || /cancel/i.test(msg)) {
      const e = new Error("Google sign-in was cancelled.");
      e.code = "SIGN_IN_CANCELED";
      throw e;
    }

    if (
      /DEVELOPER_ERROR|ApiException:\s*10|\b10\b|mismatch|SHA|package|audience|client.?id/i.test(
        `${code} ${msg}`
      )
    ) {
      throw new Error(
        `Google Sign-In misconfigured. Package must be ${NATIVE_PACKAGE} ` +
          "and SHA-1 must match Firebase (5E:8F:16:06:…). " +
          "Also set Azure GOOGLE_CLIENT_IDS to include the Firebase web client ID."
      );
    }

    throw new Error(msg || "Google sign-in failed.");
  }
}
