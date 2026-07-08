/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_APPLE_MAPKIT_TOKEN?: string
  readonly VITE_MAP_PROVIDER?: 'google' | 'apple'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}