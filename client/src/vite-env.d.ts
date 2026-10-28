/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SHOW_DEMO_CREDENTIALS?: string | boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
