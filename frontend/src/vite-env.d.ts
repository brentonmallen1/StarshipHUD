/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_ROLE_SWITCHER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Global version constant injected at build time via Vite define
declare const __APP_VERSION__: string;
