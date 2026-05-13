/** Same-origin BroadcastChannel so the main UnDocker table can disable updates while a job runs. */
export const UPDATE_PROGRESS_BROADCAST = 'undocker-update-progress-v1'

const VIEW = 'update'

export type UpdateProgressParams =
  | { kind: 'single'; id: string; name: string }
  | { kind: 'all' }

export function isUpdateProgressMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('view') === VIEW
}

export function readUpdateProgressParams(): UpdateProgressParams | null {
  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  if (sp.get('view') !== VIEW) return null
  if (sp.get('mode') === 'all') return { kind: 'all' }
  const id = sp.get('id')?.trim() ?? ''
  const name = sp.get('name')?.trim() || 'Container'
  if (!id) return null
  return { kind: 'single', id, name }
}

function applyCsrf(u: URL): void {
  const csrf =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('csrf')
      : null
  if (csrf) u.searchParams.set('csrf', csrf)
}

export function buildUpdateProgressUrlSingle(id: string, name: string): string {
  const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://local/')
  u.search = ''
  u.searchParams.set('view', VIEW)
  u.searchParams.set('id', id)
  u.searchParams.set('name', name)
  applyCsrf(u)
  return u.toString()
}

export function buildUpdateProgressUrlAll(): string {
  const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://local/')
  u.search = ''
  u.searchParams.set('view', VIEW)
  u.searchParams.set('mode', 'all')
  applyCsrf(u)
  return u.toString()
}
