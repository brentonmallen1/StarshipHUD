/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SHOW_ROLE_SWITCHER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
