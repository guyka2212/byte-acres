/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** '1' in the end-to-end test build: enables ?preset= */
  readonly VITE_E2E?: string
}
