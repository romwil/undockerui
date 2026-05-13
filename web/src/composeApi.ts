import { csrfHeaderValue } from './lib/graphql'

/** Same folder as `index.html` (see build step copying `compose_api.php` into `plugin/dist/`). */
export function composeApiUrl(): string {
  if (typeof window === 'undefined') return '/plugins/undockerui/dist/compose_api.php'
  return new URL('./compose_api.php', window.location.href).pathname
}

export type ComposeApiReadResponse = { ok: true; content: string; path: string }

export type ComposeApiExecResponse = {
  ok: boolean
  log: string
  exitCode?: number
  path?: string
}

export type ComposeListDirEntry = { name: string; path: string; type: 'dir' | 'file' }

export type ComposeListDirOk = { ok: true; path: string; entries: ComposeListDirEntry[] }

export type ComposeApiErrorResponse = { ok: false; error: string }

export type ComposeApiResponse =
  | ComposeApiReadResponse
  | ComposeApiExecResponse
  | ComposeListDirOk
  | ComposeApiErrorResponse

export async function composeApiRequest(body: Record<string, unknown>): Promise<ComposeApiResponse> {
  const res = await fetch(composeApiUrl(), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfHeaderValue(),
    },
    body: JSON.stringify({ ...body, csrf: csrfHeaderValue() }),
  })
  const text = await res.text()
  let j: unknown
  try {
    j = text ? JSON.parse(text) : null
  } catch {
    const hint = text.trim().slice(0, 200).replace(/\s+/g, ' ')
    throw new Error(
      `Compose API returned non-JSON (HTTP ${res.status}) from ${composeApiUrl()}${hint ? `: ${hint}` : ''}`,
    )
  }
  const o = j as ComposeApiResponse
  if (!res.ok && !(typeof o === 'object' && o && 'ok' in o)) {
    const msg =
      typeof o === 'object' && o && 'error' in o ? String((o as { error?: string }).error) : text.slice(0, 200)
    throw new Error(`Compose API HTTP ${res.status}: ${msg}`)
  }
  return o
}
