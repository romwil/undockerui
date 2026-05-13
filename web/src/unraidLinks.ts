/**
 * Unraid stock Docker UI URL patterns (see dynamix.docker.manager/javascript/docker.js).
 */

/** CA / user template paths on Unraid; reject odd schemes and obvious traversal. */
function isLikelyUnraidTemplatePath(p: string): boolean {
  if (p.length > 512 || /[\0\n\r]/.test(p)) return false
  if (/^(https?|javascript|data|file|blob):/i.test(p)) return false
  return (
    p.startsWith('/boot/config/') ||
    p.startsWith('/mnt/user/') ||
    /^\/mnt\/disk[0-9]+\//.test(p)
  )
}

export function buildDockerEditContainerUrl(templatePath: string | null | undefined): string | null {
  const path = templatePath?.trim()
  if (!path || !isLikelyUnraidTemplatePath(path)) return null
  const u = new URL('/Docker/UpdateContainer', window.location.origin)
  u.searchParams.set('xmlTemplate', `edit:${path}`)
  return u.toString()
}

/** Opens ttyd / logterminal flow from Unraid core JS (HeadInlineJS / dynamix). */
const SAFE_SHELLS = new Set(['bash', 'sh', 'ash', '/bin/bash', '/bin/sh', '/bin/ash'])

export function openUnraidContainerTerminal(containerName: string, shell?: string | null): void {
  const name = containerName.replace(/^\//, '')
  if (/[;&|`$()<>\n\r\\]/.test(name)) {
    window.alert('UndockerUI: unsupported characters in container name for console.')
    return
  }
  const shRaw = shell?.trim() || 'bash'
  const sh = SAFE_SHELLS.has(shRaw) ? shRaw : 'bash'
  const topWin = window.top as Window & { openTerminal?: (tag: string, n: string, more: string) => void }
  if (typeof topWin.openTerminal === 'function') {
    topWin.openTerminal('docker', name, sh)
  } else {
    window.alert(
      'Container console is only available when UndockerUI runs inside the Unraid web UI (openTerminal).',
    )
  }
}
