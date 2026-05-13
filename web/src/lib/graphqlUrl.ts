/**
 * GraphQL HTTP URL used by the browser.
 *
 * - **Development:** always `/graphql` so requests hit the Vite dev server; the proxy target
 *   and optional API key come from repo-root `.env` (`UNRAID_*`) in `vite.config.ts` only.
 * - **Production:** same-origin `/graphql` unless `VITE_GRAPHQL_URL` was set at **build** time.
 */
export function graphqlHttpUrl(): string {
  if (import.meta.env.DEV) return '/graphql'
  const fromEnv = import.meta.env.VITE_GRAPHQL_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return '/graphql'
}
