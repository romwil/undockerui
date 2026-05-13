/**
 * URLs coming from Docker / Unraid templates (webUi, project, registry, icons)
 * must not become javascript:, data:, or protocol-relative //evil hosts in href/src.
 */

const BLOCKED_SCHEME = /^(javascript|data|vbscript|file|blob):/i

export function sanitizeUrlForHref(raw: string | null | undefined): string | null {
  const s = raw?.trim()
  if (!s || BLOCKED_SCHEME.test(s)) return null
  if (s.startsWith('#')) return null
  if (s.startsWith('/')) {
    if (s.startsWith('//')) return null
    return s
  }
  try {
    const u = new URL(s)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}

/** Same rules as links; used for <img src> after path normalization. */
export function sanitizeSrcForImg(raw: string | null | undefined): string | null {
  return sanitizeUrlForHref(raw)
}
