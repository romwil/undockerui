import { sanitizeUrlForHref } from './safeUrl'

export const CONTAINERS_QUERY = /* GraphQL */ `
  query UndockerContainers {
    docker {
      containers(skipCache: false) {
        id
        names
        state
        status
        image
        imageId
        ports {
          ip
          privatePort
          publicPort
          type
        }
        templatePorts {
          ip
          privatePort
          publicPort
          type
        }
        autoStart
        autoStartOrder
        autoStartWait
        labels
        networkSettings
        isOrphaned
        isUpdateAvailable
        isRebuildReady
        webUiUrl
        templatePath
        created
        mounts
        lanIpPorts
        projectUrl
        supportUrl
        registryUrl
        shell
        iconUrl
      }
      containerUpdateStatuses {
        name
        updateStatus
      }
    }
  }
`

export const DOCKER_REMOVE_CONTAINER = /* GraphQL */ `
  mutation UndockerRemoveContainer($id: PrefixedID!, $withImage: Boolean) {
    docker {
      removeContainer(id: $id, withImage: $withImage)
    }
  }
`

export const DOCKER_AUTOSTART = /* GraphQL */ `
  mutation UndockerAutostart(
    $entries: [DockerAutostartEntryInput!]!
    $persistUserPreferences: Boolean
  ) {
    docker {
      updateAutostartConfiguration(
        entries: $entries
        persistUserPreferences: $persistUserPreferences
      )
    }
  }
`

export const DOCKER_START = /* GraphQL */ `
  mutation UndockerStart($id: PrefixedID!) {
    docker {
      start(id: $id) {
        id
        state
        status
      }
    }
  }
`

export const DOCKER_STOP = /* GraphQL */ `
  mutation UndockerStop($id: PrefixedID!) {
    docker {
      stop(id: $id) {
        id
        state
        status
      }
    }
  }
`

export const DOCKER_PAUSE = /* GraphQL */ `
  mutation UndockerPause($id: PrefixedID!) {
    docker {
      pause(id: $id) {
        id
        state
        status
      }
    }
  }
`

export const DOCKER_UNPAUSE = /* GraphQL */ `
  mutation UndockerUnpause($id: PrefixedID!) {
    docker {
      unpause(id: $id) {
        id
        state
        status
      }
    }
  }
`

export const DOCKER_UPDATE_CONTAINER = /* GraphQL */ `
  mutation UndockerUpdateContainer($id: PrefixedID!) {
    docker {
      updateContainer(id: $id) {
        id
        state
        status
        image
        isUpdateAvailable
      }
    }
  }
`

export const DOCKER_UPDATE_ALL = /* GraphQL */ `
  mutation UndockerUpdateAll {
    docker {
      updateAllContainers {
        id
        state
        status
      }
    }
  }
`

/** Lightweight list poll while update mutations run (parallel to the blocking request). */
export const CONTAINERS_POLL_QUERY = /* GraphQL */ `
  query UndockerPollContainers {
    docker {
      containers(skipCache: false) {
        id
        names
        state
        status
        image
        isUpdateAvailable
      }
    }
  }
`

export const DOCKER_LOGS_QUERY = /* GraphQL */ `
  query UndockerContainerLogs($id: PrefixedID!, $tail: Int) {
    docker {
      logs(id: $id, tail: $tail) {
        containerId
        cursor
        lines {
          timestamp
          message
        }
      }
    }
  }
`

export type DockerLogLine = {
  timestamp: string
  message: string
}

export type DockerLogsQueryData = {
  docker: {
    logs: {
      containerId: string
      cursor: string | null
      lines: DockerLogLine[]
    }
  }
}

export type ContainerPort = {
  ip: string | null
  privatePort: number | null
  publicPort: number | null
  type: string
}

export type DockerContainerRow = {
  id: string
  names: string[]
  state: 'RUNNING' | 'EXITED' | 'PAUSED' | string
  status: string
  image: string
  imageId?: string
  ports: ContainerPort[]
  templatePorts?: ContainerPort[] | null
  autoStart: boolean
  autoStartOrder?: number | null
  autoStartWait?: number | null
  labels: unknown
  networkSettings: unknown
  isOrphaned?: boolean
  isUpdateAvailable?: boolean | null
  isRebuildReady?: boolean | null
  webUiUrl?: string | null
  templatePath?: string | null
  /** Docker “Created” unix time (seconds unless unusually large). */
  created?: number | null
  mounts?: unknown[] | null
  lanIpPorts?: string[] | null
  projectUrl?: string | null
  supportUrl?: string | null
  registryUrl?: string | null
  shell?: string | null
  /** Template / CA icon (path, URL, or Font Awesome class string). */
  iconUrl?: string | null
}

/** Unraid CA / template icon stored on the container (see DockerClient.php). */
const UNRAID_DOCKER_ICON_LABEL_KEYS = ['net.unraid.docker.icon', 'org.unraid.docker.icon'] as const

function labelsAsRecord(labels: unknown): Record<string, unknown> | null {
  if (!labels) return null
  if (typeof labels === 'object' && !Array.isArray(labels)) {
    return labels as Record<string, unknown>
  }
  if (typeof labels === 'string') {
    try {
      const v = JSON.parse(labels) as unknown
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }
  return null
}

/** Prefer GraphQL `iconUrl`, then Docker labels (GraphQL often omits iconUrl). */
export function pickTemplateIconSource(c: DockerContainerRow): string | null {
  const fromField = c.iconUrl?.trim()
  if (fromField) return fromField
  const rec = labelsAsRecord(c.labels)
  if (!rec) return null
  for (const key of UNRAID_DOCKER_ICON_LABEL_KEYS) {
    const v = rec[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

/** True if the string is clearly a URL or path to an image file (not FA / icon-*). */
export function looksLikeTemplateIconImage(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (/^https?:\/\//i.test(t)) return true
  if (t.startsWith('/usr/local/emhttp')) return true
  if (t.startsWith('/')) return true
  if (/\.(png|jpe?g|gif|svg|webp|ico)(\?|#|$)/i.test(t)) return true
  return false
}

export function isTemplateIconClassString(raw: string): boolean {
  if (looksLikeTemplateIconImage(raw)) return false
  const t = raw.trim()
  if (t.startsWith('icon-')) return true
  if (/^fa[bsslr]?(\s|$)/i.test(t)) return true
  return t.split(/\s+/).some((p) => p === 'fa' || p.startsWith('fa-'))
}

/** Map Unraid filesystem paths to same-origin URLs the browser can load. */
export function normalizeTemplateIconSrc(raw: string): string {
  const t = raw.trim()
  if (!t) return t
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/usr/local/emhttp')) {
    const rest = t.slice('/usr/local/emhttp'.length)
    return rest.startsWith('/') ? rest : `/${rest}`
  }
  if (t.startsWith('/')) return t
  return `/${t.replace(/^\/+/, '')}`
}

export type UpdateStatusEnum = 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'REBUILD_READY' | 'UNKNOWN'

export type ExplicitStatusItem = {
  name: string
  updateStatus: UpdateStatusEnum
}

export type ContainersQueryData = {
  docker: {
    containers: DockerContainerRow[]
    containerUpdateStatuses: ExplicitStatusItem[]
  }
}

export type DockerPollRow = {
  id: string
  names: string[]
  state: string
  status: string
  image: string
  isUpdateAvailable?: boolean | null
}

export type ContainersPollQueryData = {
  docker: {
    containers: DockerPollRow[]
  }
}

export function normalizeContainerLookupKey(name: string): string {
  return name.replace(/^\//, '').trim().toLowerCase()
}

export function containerDisplayName(c: DockerContainerRow): string {
  const n = c.names?.[0]
  if (!n) return c.id
  return n.replace(/^\//, '')
}

/** Same naming as Unraid’s `containerUpdateStatuses` list (stock Docker page). */
export function explicitStatusMap(items: ExplicitStatusItem[] | undefined): Map<string, UpdateStatusEnum> {
  const m = new Map<string, UpdateStatusEnum>()
  for (const it of items ?? []) {
    m.set(normalizeContainerLookupKey(it.name), it.updateStatus)
  }
  return m
}

export function explicitStatusFor(
  map: Map<string, UpdateStatusEnum>,
  c: DockerContainerRow,
): UpdateStatusEnum | undefined {
  for (const n of c.names?.length ? c.names : [containerDisplayName(c)]) {
    const hit = map.get(normalizeContainerLookupKey(n))
    if (hit) return hit
  }
  return map.get(normalizeContainerLookupKey(containerDisplayName(c)))
}

/** True when stock UI would show an actionable update (registry or template). */
export function hasPendingUpdate(
  explicit: UpdateStatusEnum | undefined,
  c: DockerContainerRow,
): boolean {
  if (explicit === 'UP_TO_DATE') return false
  if (explicit === 'UPDATE_AVAILABLE' || explicit === 'REBUILD_READY') return true
  if (explicit === 'UNKNOWN') return c.isUpdateAvailable === true || c.isRebuildReady === true
  return c.isUpdateAvailable === true || c.isRebuildReady === true
}

/** Convert Docker `created` to milliseconds (handles sec vs ms heuristically). */
export function createdToMs(created: number): number {
  return created > 0 && created < 10_000_000_000 ? created * 1000 : created
}

/** Short relative age, e.g. "3d", "2h", "12m". */
export function formatCreatedAge(created: number | undefined | null): string {
  if (created == null || !Number.isFinite(created)) return '—'
  const ms = createdToMs(created)
  const diff = Date.now() - ms
  if (diff < 0 || !Number.isFinite(diff)) return '—'
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 60) return `${d}d`
  const mo = Math.floor(d / 30)
  if (mo < 24) return `${mo}mo`
  return `${Math.floor(d / 365)}y`
}

/** Prefer Docker status “Up …” for running/paused; otherwise em dash. */
export function formatUptimeFromStatus(c: DockerContainerRow): string {
  if (c.state !== 'RUNNING' && c.state !== 'PAUSED') return '—'
  const st = (c.status || '').trim()
  if (!st) return '—'
  if (/^up\s+/i.test(st)) return st
  return st.length > 40 ? `${st.slice(0, 37)}…` : st
}

/** Prefer live ports; when stopped, fall back to template-defined ports (Unraid Docker parity). */
export function portsForDisplay(c: DockerContainerRow): ContainerPort[] {
  if (c.ports?.length) return c.ports
  return c.templatePorts ?? []
}

export function formatPorts(c: DockerContainerRow, maxLen = 48): string {
  const list = portsForDisplay(c)
  if (!list.length) return '—'
  const parts = list.map((p) => {
    const pub = p.publicPort != null ? String(p.publicPort) : ''
    const priv = p.privatePort != null ? String(p.privatePort) : ''
    const arrow = pub && priv ? `${pub}→${priv}` : pub || priv || '?'
    return `${arrow}/${(p.type || 'tcp').toLowerCase()}`
  })
  const s = parts.join(', ')
  return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
}

export function pickContainerIp(networkSettings: unknown): string {
  if (!networkSettings || typeof networkSettings !== 'object') return '—'
  const ns = networkSettings as Record<string, unknown>
  const networks = ns.Networks
  if (!networks || typeof networks !== 'object') return '—'
  for (const k of Object.keys(networks as Record<string, unknown>)) {
    const entry = (networks as Record<string, Record<string, unknown>>)[k]
    const ip = entry?.IPAddress
    if (typeof ip === 'string' && ip.trim()) return ip.trim()
  }
  return '—'
}

/**
 * Unraid Web UI entries often use `http://[IP]:port/`. Replace `[IP]` with the
 * container’s primary Docker network IP (same source as the IP column).
 */
export function resolveWebUiUrl(c: DockerContainerRow): string | null {
  const raw = c.webUiUrl?.trim()
  if (!raw) return null
  let resolved = raw
  if (/\[IP]/i.test(raw)) {
    const ip = pickContainerIp(c.networkSettings)
    if (!ip || ip === '—') return null
    resolved = raw.replace(/\[IP]/gi, ip)
  }
  return sanitizeUrlForHref(resolved)
}

/** All non-empty container IPs keyed by Docker network name (when available). */
export function containerNetworkIpLines(networkSettings: unknown): string[] {
  if (!networkSettings || typeof networkSettings !== 'object') return []
  const ns = networkSettings as Record<string, unknown>
  const networks = ns.Networks
  if (!networks || typeof networks !== 'object') return []
  const lines: string[] = []
  for (const k of Object.keys(networks as Record<string, unknown>)) {
    const entry = (networks as Record<string, Record<string, unknown>>)[k]
    const ip = entry?.IPAddress
    if (typeof ip === 'string' && ip.trim()) {
      lines.push(`${k}: ${ip.trim()}`)
    }
  }
  return lines
}

/** Human-readable volume mapping lines for details / clipboard. */
export function formatMountsMultiline(mounts: unknown): string {
  if (!Array.isArray(mounts) || mounts.length === 0) return ''
  const rows: string[] = []
  for (const m of mounts) {
    if (!m || typeof m !== 'object') continue
    const o = m as Record<string, unknown>
    const src = String(o.Source ?? o.source ?? '').trim()
    const dst = String(o.Destination ?? o.destination ?? '').trim()
    const rw = o.RW === false ? 'ro' : 'rw'
    if (src && dst) rows.push(`${src}  →  ${dst}  (${rw})`)
    else rows.push(JSON.stringify(m))
  }
  return rows.join('\n')
}

/** LAN host:ports, container IPs, and port mapping summary for details / clipboard. */
export function formatNetworkPortsDetailBlock(c: DockerContainerRow): string {
  const parts: string[] = []
  const netLines = containerNetworkIpLines(c.networkSettings)
  if (netLines.length) {
    parts.push('Container networks / IP')
    parts.push(...netLines.map((l) => `  ${l}`))
    parts.push('')
  }
  const lan = (c.lanIpPorts ?? []).filter((s) => s?.trim())
  if (lan.length) {
    parts.push('LAN (host:port)')
    parts.push(...lan.map((p) => `  ${p.trim()}`))
    parts.push('')
  }
  const portStr = formatPorts(c, 9999)
  if (portStr && portStr !== '—') {
    parts.push('Published / template port mappings')
    parts.push(`  ${portStr}`)
  }
  return parts.join('\n').trim()
}

export function statusLabel(c: DockerContainerRow): string {
  if (c.state === 'RUNNING') return 'Running'
  if (c.state === 'EXITED') return 'Exited'
  if (c.state === 'PAUSED') return 'Paused'
  return c.state || c.status || 'Unknown'
}

/** Standard Docker Compose v2 labels on containers. */
export const COMPOSE_LABEL_PROJECT = 'com.docker.compose.project'
export const COMPOSE_LABEL_SERVICE = 'com.docker.compose.service'
export const COMPOSE_LABEL_CONFIG_FILES = 'com.docker.compose.project.config_files'
export const COMPOSE_LABEL_WORKING_DIR = 'com.docker.compose.project.working_dir'

export type ComposeMeta = {
  project: string
  service?: string
  configFiles: string[]
  workingDir?: string
}

export function parseComposeMeta(labels: unknown): ComposeMeta | null {
  if (!labels || typeof labels !== 'object') return null
  const L = labels as Record<string, unknown>
  const projectRaw = L[COMPOSE_LABEL_PROJECT]
  const project = typeof projectRaw === 'string' ? projectRaw.trim() : ''
  if (!project) return null
  const cfRaw = L[COMPOSE_LABEL_CONFIG_FILES]
  const cfStr = typeof cfRaw === 'string' ? cfRaw.trim() : ''
  const configFiles = cfStr ? cfStr.split(',').map((s) => s.trim()).filter(Boolean) : []
  const svcRaw = L[COMPOSE_LABEL_SERVICE]
  const wdRaw = L[COMPOSE_LABEL_WORKING_DIR]
  return {
    project,
    service: typeof svcRaw === 'string' && svcRaw.trim() ? svcRaw.trim() : undefined,
    configFiles,
    workingDir: typeof wdRaw === 'string' && wdRaw.trim() ? wdRaw.trim() : undefined,
  }
}

export function isComposeContainer(labels: unknown): boolean {
  return parseComposeMeta(labels) != null
}

export function formatComposeDetailBlock(meta: ComposeMeta): string {
  const lines: string[] = [`Project: ${meta.project}`]
  if (meta.service) lines.push(`Service: ${meta.service}`)
  if (meta.workingDir) lines.push(`Working directory: ${meta.workingDir}`)
  if (meta.configFiles.length) {
    lines.push('Compose file(s):')
    for (const f of meta.configFiles) lines.push(`  ${f}`)
  }
  return lines.join('\n')
}
