/** Opened from the main UndockerUI SPA; same path + query selects the logs-only view. */
export function isLogsWindowMode(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('view') === 'logs'
}

export function readLogsParams(): { id: string; name: string; tail: number } {
  const sp = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const id = sp.get('id')?.trim() ?? ''
  const name = sp.get('name')?.trim() || 'Container'
  const raw = Number(sp.get('tail'))
  const tail = Number.isFinite(raw) && raw > 0 ? Math.min(10_000, Math.floor(raw)) : 300
  return { id, name, tail }
}

/** Same document URL with view=logs; preserves csrf from the parent page when present. */
export function buildLogsWindowUrl(id: string, name: string, tail = 300): string {
  const csrf =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('csrf')
      : null
  const u = new URL(typeof window !== 'undefined' ? window.location.href : 'http://local/')
  u.search = ''
  u.searchParams.set('view', 'logs')
  u.searchParams.set('id', id)
  u.searchParams.set('name', name)
  u.searchParams.set('tail', String(tail))
  if (csrf) u.searchParams.set('csrf', csrf)
  return u.toString()
}
