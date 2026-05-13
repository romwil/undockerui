/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set at build time only; dev always uses `/graphql` via the Vite proxy. */
  readonly VITE_GRAPHQL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
