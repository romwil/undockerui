/** GraphQL HTTP endpoint: dev uses Vite proxy; prod uses same origin as the SPA (WebGUI port). */
export function graphqlHttpUrl(): string {
  if (import.meta.env.DEV) return '/graphql'
  const fromEnv = import.meta.env.VITE_GRAPHQL_URL
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim()
  return '/graphql'
}
