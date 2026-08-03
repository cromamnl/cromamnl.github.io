/* ============================================================================
   App configuration — fill these two in after you deploy the backend.
   (See README steps 2 and 4.)
   ========================================================================== */
window.CROMA = {
  // Apps Script Web App URL (ends in /exec). Wired 2026-07-22 to the deployed
  // "Croma MNL Community" backend. Blank would fall back to DEMO MODE.
  API_URL: 'https://script.google.com/macros/s/AKfycbyA6I8qMw68hmlWv6CSCzdEnt-7O7WosmMZtlQT23s0d5gxzGm91TmlVWqOr_yByGlgxg/exec',

  // Google OAuth **Web** client ID (…apps.googleusercontent.com) from Google
  // Cloud Console. Leave blank to hide the "Continue with Google" button and
  // use email/phone + password only.
  GOOGLE_CLIENT_ID: '987250068595-p54sq4e8miglir5nn7f5an9e2m7og9u4.apps.googleusercontent.com',

  APP_NAME: 'Croma MNL Community',
  VERSION: 'v2',   // bump on every client change; shown in Profile beside the backend's

  // --- Push notifications (Firebase Cloud Messaging) ---------------------------------------
  // All PUBLIC values (safe in the client). Fill from Firebase Console → Project settings →
  // "Your apps" (Web). Leave FIREBASE.projectId BLANK to keep push fully disabled.
  // The SENDING side uses a service account set as Script Properties on the backend (see Push.gs).
  FIREBASE: {
    apiKey: 'AIzaSyA7YIoMx2WmyLgMY2AQ3sBQIEPonR2stv8',
    authDomain: 'croma-mnl-community.firebaseapp.com',
    projectId: 'croma-mnl-community',
    storageBucket: 'croma-mnl-community.firebasestorage.app',
    messagingSenderId: '987250068595',
    appId: '1:987250068595:web:10a033acea3a0080b52e06',
    // Realtime Database — used as the READ REPLICA (see backend/Mirror.gs), not for push. Public
    // by design: the only data mirrored there is the menu, which every member already sees, and
    // the database rules allow read-only access to /public. Blank disables the replica and the
    // app falls back to reading everything through Apps Script.
    databaseURL: 'https://croma-mnl-community-default-rtdb.asia-southeast1.firebasedatabase.app',
  },
  // Cloud Messaging → Web Push certificates → "Key pair" (the long public VAPID key).
  FIREBASE_VAPID_KEY: 'BNEHS4rmte0ooDbZirMiwSfw-7tJ2LrA3soAKbdvcUrO4Jf6WrCD25DaibyuMyF1Gmclb5kjii01bcuQVLpI4oo',
};
