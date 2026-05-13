import { graphqlHttpUrl } from './graphqlUrl'

export type GraphQLErrorShape = { message: string }

/** Unraid GraphQL expects this header (see unraid/api create-apollo-client). */
export function csrfHeaderValue(): string {
  if (typeof window === 'undefined') return '0000000000000000'
  const fromQuery = new URLSearchParams(window.location.search).get('csrf')
  if (fromQuery) return fromQuery
  const g = globalThis as unknown as { csrf_token?: string }
  if (g.csrf_token) return g.csrf_token
  const m = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  if (m?.[1]) return decodeURIComponent(m[1])
  return '0000000000000000'
}

export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(graphqlHttpUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfHeaderValue(),
    },
    body: JSON.stringify({ query, variables }),
  })
  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new Error(`GraphQL: expected JSON, HTTP ${res.status}`)
  }
  const j = body as {
    data?: T
    errors?: GraphQLErrorShape[]
  }
  if (!res.ok) {
    const msg = j.errors?.map((e) => e.message).join('; ') || res.statusText
    throw new Error(`GraphQL HTTP ${res.status}: ${msg}`)
  }
  if (j.errors?.length) {
    throw new Error(j.errors.map((e) => e.message).join('; '))
  }
  if (j.data === undefined || j.data === null) {
    throw new Error('GraphQL: empty data')
  }
  return j.data
}
