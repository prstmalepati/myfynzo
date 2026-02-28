/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  readonly VITE_TWELVE_DATA_KEY?: string;
  readonly VITE_EXCHANGE_RATE_API_KEY?: string;
  readonly VITE_ENABLE_COUPLES_TIER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
