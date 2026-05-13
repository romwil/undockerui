import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CONTAINERS_QUERY,
  DOCKER_AUTOSTART,
  DOCKER_PAUSE,
  DOCKER_REMOVE_CONTAINER,
  DOCKER_START,
  DOCKER_STOP,
  DOCKER_UNPAUSE,
  type ContainersQueryData,
  type DockerContainerRow,
  type UpdateStatusEnum,
  containerDisplayName,
  createdToMs,
  explicitStatusFor,
  explicitStatusMap,
  formatComposeDetailBlock,
  formatCreatedAge,
  formatMountsMultiline,
  formatNetworkPortsDetailBlock,
  formatPorts,
  formatUptimeFromStatus,
  hasPendingUpdate,
  isComposeContainer,
  isTemplateIconClassString,
  normalizeTemplateIconSrc,
  parseComposeMeta,
  pickContainerIp,
  pickTemplateIconSource,
  resolveWebUiUrl,
  statusLabel,
} from './lib/docker'
import { graphqlRequest } from './lib/graphql'
import { buildLogsWindowUrl } from './logsUrl'
import {
  buildUpdateProgressUrlAll,
  buildUpdateProgressUrlSingle,
  UPDATE_PROGRESS_BROADCAST,
} from './updateProgressUrl'
import { buildDockerEditContainerUrl, openUnraidContainerTerminal } from './unraidLinks'
import { sanitizeSrcForImg, sanitizeUrlForHref } from './lib/safeUrl'
import ComposeWorkspaceModal from './ComposeWorkspaceModal'

const QK = ['docker', 'containers'] as const

const btnBase =
  'rounded px-2 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

/** Generic Docker mark when no template icon is available. */
function FallbackDockerGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="2" y="14" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="6.5" y="14" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="11" y="14" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="15.5" y="14" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="6.5" y="9.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="11" y="9.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="15.5" y="9.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
      <rect x="15.5" y="5" width="3.5" height="3.5" rx="0.5" fill="currentColor" />
    </svg>
  )
}

/** Unraid template icon: image URL/path, Font Awesome, or stock `icon-*` glyph. */
function ContainerTemplateIcon({ c }: { c: DockerContainerRow }) {
  const raw = pickTemplateIconSource(c)?.trim() ?? ''
  const [imgFailed, setImgFailed] = useState(false)

  useEffect(() => {
    setImgFailed(false)
  }, [raw])

  if (!raw || imgFailed) {
    return <FallbackDockerGlyph className="h-4 w-4 shrink-0 text-sky-500/90" />
  }

  if (isTemplateIconClassString(raw)) {
    return (
      <i
        className={`${raw} shrink-0 text-[15px] leading-none text-zinc-300`.trim()}
        aria-hidden
      />
    )
  }

  const src = sanitizeSrcForImg(normalizeTemplateIconSrc(raw))
  if (!src) {
    return <FallbackDockerGlyph className="h-4 w-4 shrink-0 text-sky-500/90" />
  }

  return (
    <img
      src={src}
      alt=""
      className="h-4 w-4 shrink-0 rounded-sm object-contain opacity-95"
      onError={() => setImgFailed(true)}
    />
  )
}

function filterContainers(
  list: DockerContainerRow[],
  q: string,
  updatesOnly: boolean,
  composeOnly: boolean,
  statusMap: Map<string, UpdateStatusEnum>,
): DockerContainerRow[] {
  let rows = list
  if (updatesOnly) {
    rows = rows.filter((c) => hasPendingUpdate(explicitStatusFor(statusMap, c), c))
  }
  if (composeOnly) {
    rows = rows.filter((c) => isComposeContainer(c.labels))
  }
  const s = q.trim().toLowerCase()
  if (!s) return rows
  return rows.filter((c) => {
    const compose = parseComposeMeta(c.labels)
    const hay = [
      containerDisplayName(c),
      c.image,
      c.status,
      c.state,
      pickContainerIp(c.networkSettings),
      formatPorts(c, 9999),
      formatCreatedAge(c.created),
      formatUptimeFromStatus(c),
      compose?.project,
      compose?.service,
      compose?.configFiles.join(' '),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(s)
  })
}

function UpdateStatusCell({
  explicit,
  c,
}: {
  explicit: UpdateStatusEnum | undefined
  c: DockerContainerRow
}) {
  const hasUpdate = c.isUpdateAvailable === true
  const rebuild = c.isRebuildReady === true

  if (explicit === 'UPDATE_AVAILABLE') {
    return (
      <span
        className="rounded bg-amber-950/90 px-2 py-0.5 text-[11px] font-semibold text-amber-100"
        title="Newer image available from the container registry (same signal as the stock Unraid Docker page)."
      >
        Update available
      </span>
    )
  }
  if (explicit === 'REBUILD_READY') {
    return (
      <span
        className="rounded bg-violet-950/90 px-2 py-0.5 text-[11px] font-semibold text-violet-100"
        title="Template or paths changed — rebuild recommended (Unraid update check)."
      >
        Rebuild ready
      </span>
    )
  }
  if (explicit === 'UP_TO_DATE') {
    return <span className="text-[11px] font-medium text-emerald-600/90">Up to date</span>
  }
  if (hasUpdate) {
    return (
      <span
        className="rounded bg-amber-950/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-100"
        title="Image update (from container fields)"
      >
        Image
      </span>
    )
  }
  if (rebuild) {
    return (
      <span
        className="rounded bg-violet-950/80 px-1.5 py-0.5 text-[11px] font-medium text-violet-200"
        title="Rebuild recommended"
      >
        Rebuild
      </span>
    )
  }
  return <span className="text-zinc-600">—</span>
}

function AutostartSwitch({
  enabled,
  disabled,
  pending,
  waitSec,
  order,
  onToggle,
}: {
  enabled: boolean
  disabled: boolean
  pending: boolean
  waitSec?: number | null
  order?: number | null
  onToggle: () => void
}) {
  const hint = [
    `Auto-start with Docker: ${enabled ? 'on' : 'off'}`,
    typeof order === 'number' ? `order ${order}` : null,
    waitSec != null && waitSec > 0 ? `wait ${waitSec}s after start` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-busy={pending}
        disabled={disabled}
        onClick={onToggle}
        title={hint}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 ${
          enabled
            ? 'border-emerald-700/80 bg-emerald-700'
            : 'border-zinc-600 bg-zinc-800'
        } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
      >
        <span
          className={`pointer-events-none mx-0.5 block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-[1.25rem]' : 'translate-x-0'
          }`}
        />
      </button>
      {waitSec != null && waitSec > 0 ? (
        <span className="text-[10px] leading-none text-zinc-500">wait {waitSec}s</span>
      ) : null}
    </div>
  )
}

function statusPillClass(state: string): string {
  if (state === 'RUNNING') return 'bg-emerald-950/80 text-emerald-300'
  if (state === 'PAUSED') return 'bg-amber-950/80 text-amber-200'
  return 'bg-zinc-800 text-zinc-400'
}

type LifecyclePhase = 'starting' | 'stopping' | 'restarting' | 'pausing' | 'resuming'

function InlineSpinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-300"
      aria-hidden
    />
  )
}

function LifecycleStatus({ phase }: { phase: LifecyclePhase }) {
  const label =
    phase === 'starting'
      ? 'Starting…'
      : phase === 'stopping'
        ? 'Stopping…'
        : phase === 'restarting'
          ? 'Restarting…'
          : phase === 'pausing'
            ? 'Pausing…'
            : 'Resuming…'
  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded border border-sky-700/55 bg-sky-950/70 px-2 py-0.5 text-xs font-semibold text-sky-100 shadow-[inset_0_0_0_1px_rgba(56,189,248,0.15)]"
    >
      <InlineSpinner />
      {label}
    </span>
  )
}

function ClipboardGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  )
}

function CopyDetailsButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const t = window.setTimeout(() => setDone(false), 1600)
    return () => window.clearTimeout(t)
  }, [done])

  async function onCopy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setDone(true)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setDone(true)
      } catch {
        window.alert('Could not copy to clipboard.')
      }
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      disabled={!text}
      title={`Copy ${label}`}
      className="inline-flex shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
    >
      {done ? (
        <span className="text-[10px] font-medium text-emerald-400">OK</span>
      ) : (
        <ClipboardGlyph className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function ContainerDetailsPane({ c }: { c: DockerContainerRow }) {
  const mountsText = formatMountsMultiline(c.mounts)
  const netPortsText = formatNetworkPortsDetailBlock(c)
  const project = sanitizeUrlForHref(c.projectUrl?.trim())
  const support = sanitizeUrlForHref(c.supportUrl?.trim())
  const registry = sanitizeUrlForHref(c.registryUrl?.trim())
  const compose = parseComposeMeta(c.labels)
  const composeText = compose ? formatComposeDetailBlock(compose) : ''

  return (
    <div className="border-t border-zinc-800/90 bg-zinc-900/80 px-4 py-3 text-xs text-zinc-300">
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Volume mappings
            </h3>
            <CopyDetailsButton text={mountsText} label="volume mappings" />
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-[11px] text-zinc-400">
            {mountsText || '—'}
          </pre>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Networks, LAN & ports
            </h3>
            <CopyDetailsButton text={netPortsText} label="network and port details" />
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-[11px] text-zinc-400">
            {netPortsText || '—'}
          </pre>
        </div>
      </div>
      {compose ? (
        <div className="mb-4">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Docker Compose
            </h3>
            <CopyDetailsButton text={composeText} label="compose metadata" />
          </div>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded border border-zinc-800 bg-zinc-950/80 p-2 font-mono text-[11px] text-zinc-400">
            {composeText}
          </pre>
        </div>
      ) : null}
      <div>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Links
        </h3>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {project ? (
            <li>
              <a
                href={project}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-400 hover:text-sky-300"
              >
                Project
              </a>
            </li>
          ) : null}
          {support ? (
            <li>
              <a
                href={support}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-400 hover:text-sky-300"
              >
                Support
              </a>
            </li>
          ) : null}
          {registry ? (
            <li>
              <a
                href={registry}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-sky-400 hover:text-sky-300"
              >
                Registry / Docker Hub
              </a>
            </li>
          ) : null}
          {!project && !support && !registry ? (
            <li className="text-zinc-600">No template links on file.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [updatesOnly, setUpdatesOnly] = useState(false)
  const [composeOnly, setComposeOnly] = useState(false)
  const [composeWorkspace, setComposeWorkspace] = useState<{
    open: boolean
    initialPath?: string
  }>({ open: false })
  const [remoteUpdateRunning, setRemoteUpdateRunning] = useState(false)
  const [openMenuFor, setOpenMenuFor] = useState<string | null>(null)
  const [openDetailsFor, setOpenDetailsFor] = useState<string | null>(null)
  const nameMenuRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openMenuFor) return
    function close(e: PointerEvent) {
      const el = nameMenuRootRef.current
      if (el && !el.contains(e.target as Node)) setOpenMenuFor(null)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [openMenuFor])

  const containersQuery = useQuery({
    queryKey: QK,
    queryFn: () => graphqlRequest<ContainersQueryData>(CONTAINERS_QUERY),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const list = useMemo(
    () => containersQuery.data?.docker?.containers ?? [],
    [containersQuery.data],
  )
  const statusMap = useMemo(
    () => explicitStatusMap(containersQuery.data?.docker?.containerUpdateStatuses),
    [containersQuery.data],
  )
  const filtered = useMemo(
    () => filterContainers(list, search, updatesOnly, composeOnly, statusMap),
    [list, search, updatesOnly, composeOnly, statusMap],
  )

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const bc = new BroadcastChannel(UPDATE_PROGRESS_BROADCAST)
    bc.onmessage = (ev: MessageEvent) => {
      if (ev.data?.running === true) setRemoteUpdateRunning(true)
      else if (ev.data?.running === false) setRemoteUpdateRunning(false)
    }
    return () => bc.close()
  }, [])

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      if (
        e.data?.type === 'undocker-invalidate-containers' &&
        e.data?.source === 'undocker-update-progress'
      ) {
        queryClient.invalidateQueries({ queryKey: QK })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [queryClient])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QK })

  const startMut = useMutation({
    mutationFn: (id: string) => graphqlRequest(DOCKER_START, { id }),
    onSettled: invalidate,
  })

  const stopMut = useMutation({
    mutationFn: (id: string) => graphqlRequest(DOCKER_STOP, { id }),
    onSettled: invalidate,
  })

  const pauseMut = useMutation({
    mutationFn: (id: string) => graphqlRequest(DOCKER_PAUSE, { id }),
    onSettled: invalidate,
  })

  const unpauseMut = useMutation({
    mutationFn: (id: string) => graphqlRequest(DOCKER_UNPAUSE, { id }),
    onSettled: invalidate,
  })

  const restartMut = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: string }) => {
      if (state === 'RUNNING' || state === 'PAUSED') {
        await graphqlRequest(DOCKER_STOP, { id })
      }
      await graphqlRequest(DOCKER_START, { id })
    },
    onSettled: invalidate,
  })

  const deleteMut = useMutation({
    mutationFn: (v: { id: string; withImage: boolean }) =>
      graphqlRequest<{ docker: { removeContainer: boolean } }>(DOCKER_REMOVE_CONTAINER, {
        id: v.id,
        withImage: v.withImage,
      }),
    onSettled: invalidate,
  })

  const autostartMut = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: boolean }) => {
      const data = queryClient.getQueryData<ContainersQueryData>(QK)
      const current = data?.docker?.containers
      if (!current?.length) throw new Error('Container list not loaded')
      const entries = current.map((row) => {
        const e: { id: string; autoStart: boolean; wait?: number } = {
          id: row.id,
          autoStart: row.id === id ? next : row.autoStart,
        }
        const w = row.autoStartWait
        if (typeof w === 'number' && w > 0) e.wait = w
        return e
      })
      await graphqlRequest<{ docker: { updateAutostartConfiguration: boolean } }>(
        DOCKER_AUTOSTART,
        { entries, persistUserPreferences: true },
      )
    },
    onSettled: invalidate,
  })

  function rowBusy(id: string): boolean {
    if (startMut.isPending && startMut.variables === id) return true
    if (stopMut.isPending && stopMut.variables === id) return true
    if (pauseMut.isPending && pauseMut.variables === id) return true
    if (unpauseMut.isPending && unpauseMut.variables === id) return true
    if (restartMut.isPending && restartMut.variables?.id === id) return true
    if (deleteMut.isPending && deleteMut.variables?.id === id) return true
    if (autostartMut.isPending && autostartMut.variables?.id === id) return true
    return false
  }

  function rowLifecyclePhase(id: string): LifecyclePhase | null {
    if (restartMut.isPending && restartMut.variables?.id === id) return 'restarting'
    if (stopMut.isPending && stopMut.variables === id) return 'stopping'
    if (startMut.isPending && startMut.variables === id) return 'starting'
    if (pauseMut.isPending && pauseMut.variables === id) return 'pausing'
    if (unpauseMut.isPending && unpauseMut.variables === id) return 'resuming'
    return null
  }

  const err =
    containersQuery.error instanceof Error
      ? containersQuery.error.message
      : containersQuery.error
        ? String(containersQuery.error)
        : startMut.error instanceof Error
          ? startMut.error.message
          : stopMut.error instanceof Error
            ? stopMut.error.message
            : pauseMut.error instanceof Error
              ? pauseMut.error.message
              : unpauseMut.error instanceof Error
                ? unpauseMut.error.message
                : restartMut.error instanceof Error
                  ? restartMut.error.message
                  : deleteMut.error instanceof Error
                        ? deleteMut.error.message
                        : autostartMut.error instanceof Error
                          ? autostartMut.error.message
                          : null

  const updateableCount = useMemo(
    () => list.filter((c) => hasPendingUpdate(explicitStatusFor(statusMap, c), c)).length,
    [list, statusMap],
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-zinc-950 text-zinc-200">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">UnDocker</h1>
        <span className="text-xs text-zinc-500">
          {list.length} container{list.length === 1 ? '' : 's'}
          {updateableCount > 0 ? (
            <span className="text-sky-400/90"> · {updateableCount} with updates</span>
          ) : null}
        </span>
        <label className="ml-2 flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={updatesOnly}
            onChange={(e) => setUpdatesOnly(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Updates only
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={composeOnly}
            onChange={(e) => setComposeOnly(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Compose only
        </label>
        <button
          type="button"
          disabled={remoteUpdateRunning || updateableCount === 0}
          title="Opens a progress window that runs the bulk update and polls container state until it finishes."
          onClick={() => {
            if (
              !window.confirm(
                `Update all ${updateableCount} container(s) that have updates? A new window will run the server update and show progress (this can take a long time).`,
              )
            ) {
              return
            }
            window.open(buildUpdateProgressUrlAll(), '_blank', 'noopener,noreferrer')
          }}
          className={`${btnBase} border border-sky-800/80 bg-sky-950/50 text-sky-200 hover:bg-sky-900/60`}
        >
          {remoteUpdateRunning ? 'Update in progress…' : 'Update all'}
        </button>
        <button
          type="button"
          onClick={() => setComposeWorkspace({ open: true, initialPath: undefined })}
          className={`${btnBase} border border-violet-800/70 bg-violet-950/40 text-violet-200 hover:bg-violet-900/50`}
          title="Create or edit compose files under /mnt/user, /mnt/cache, /mnt/disk#, or /boot/config and run docker compose up -d on this server."
        >
          Compose workspace
        </button>
        <input
          type="search"
          placeholder="Filter…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto min-w-[10rem] max-w-xs flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-sky-600 focus:outline-none"
          autoComplete="off"
        />
      </header>

      {err ? (
        <div className="m-3 rounded border border-red-900/80 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        {containersQuery.isLoading ? (
          <div className="p-4 text-sm text-zinc-500">Loading containers…</div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 bg-zinc-900/95 text-xs uppercase tracking-wide text-zinc-500 backdrop-blur">
              <tr>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Name</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Status</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Image</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">IP</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Ports</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Uptime</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Created</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Auto start</th>
                <th className="border-b border-zinc-800 px-3 py-2 font-medium">Updates</th>
                <th className="border-b border-zinc-800 px-3 py-2 text-right font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const name = containerDisplayName(c)
                const running = c.state === 'RUNNING'
                const paused = c.state === 'PAUSED'
                const exited = c.state === 'EXITED'
                const busy = rowBusy(c.id)
                const life = rowLifecyclePhase(c.id)
                const web = resolveWebUiUrl(c)
                const editUrl = buildDockerEditContainerUrl(c.templatePath)
                const composeMeta = parseComposeMeta(c.labels)
                const explicit = explicitStatusFor(statusMap, c)
                const hasUpdate = c.isUpdateAvailable === true
                const rebuild = c.isRebuildReady === true
                const pendingRepo =
                  explicit === 'UPDATE_AVAILABLE' || (explicit === undefined && hasUpdate)
                const pendingRebuild =
                  explicit === 'REBUILD_READY' || (explicit === undefined && rebuild)
                const rowBorder = pendingRepo
                  ? 'border-l-[3px] border-l-amber-400/90 bg-amber-950/[0.07]'
                  : pendingRebuild
                    ? 'border-l-[3px] border-l-violet-500/75 bg-violet-950/[0.06]'
                    : ''
                const showUpdateBtn = hasPendingUpdate(explicit, c)

                const rowAccent = life
                  ? 'border-l-[3px] border-l-sky-400/90 bg-sky-950/[0.12]'
                  : rowBorder

                return (
                  <Fragment key={c.id}>
                  <tr
                    aria-busy={Boolean(life)}
                    className={`border-b border-zinc-800/80 hover:bg-zinc-900/60 ${rowAccent}`}
                  >
                    <td className="max-w-[12rem] px-3 py-1.5">
                      <div
                        ref={openMenuFor === c.id ? nameMenuRootRef : undefined}
                        className="flex min-w-0 items-center gap-1.5"
                      >
                        {life ? (
                          <span
                            className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.55)]"
                            title="Stop, start, restart, pause, or resume in progress"
                            aria-hidden
                          />
                        ) : pendingRepo ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                            title="Registry update pending (Unraid update check)"
                            aria-hidden
                          />
                        ) : pendingRebuild ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.4)]"
                            title="Rebuild pending"
                            aria-hidden
                          />
                        ) : null}
                        <ContainerTemplateIcon c={c} />
                        <div className="relative min-w-0 flex-1">
                          <button
                            type="button"
                            className="max-w-full truncate text-left font-medium text-zinc-100 hover:text-sky-300"
                            aria-expanded={openMenuFor === c.id}
                            aria-haspopup="menu"
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuFor((x) => (x === c.id ? null : c.id))
                            }}
                          >
                            {name}
                          </button>
                          {openMenuFor === c.id ? (
                            <ul
                              className="absolute left-0 top-full z-30 mt-1 min-w-[12rem] rounded-md border border-zinc-600 bg-zinc-900 py-1 text-xs shadow-xl"
                              role="menu"
                            >
                              {web ? (
                                <li>
                                  <a
                                    role="menuitem"
                                    href={web}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block px-3 py-1.5 text-zinc-200 hover:bg-zinc-800"
                                    onClick={() => setOpenMenuFor(null)}
                                  >
                                    Open Web UI
                                  </a>
                                </li>
                              ) : (
                                <li
                                  className="cursor-not-allowed px-3 py-1.5 text-zinc-600"
                                  title="No Web UI URL in template"
                                >
                                  Open Web UI
                                </li>
                              )}
                              <li>
                                {editUrl ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
                                    onClick={() => {
                                      setOpenMenuFor(null)
                                      window.top?.location.assign(editUrl)
                                    }}
                                  >
                                    Edit…
                                  </button>
                                ) : (
                                  <span
                                    className="block cursor-not-allowed px-3 py-1.5 text-zinc-600"
                                    title="No template path (orphan or compose)"
                                  >
                                    Edit…
                                  </span>
                                )}
                              </li>
                              <li>
                                {running ? (
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
                                    onClick={() => {
                                      setOpenMenuFor(null)
                                      openUnraidContainerTerminal(name, c.shell)
                                    }}
                                  >
                                    {'>'} Shell
                                  </button>
                                ) : (
                                  <span
                                    className="block cursor-not-allowed px-3 py-1.5 text-zinc-600"
                                    title="Start the container to open a shell"
                                  >
                                    {'>'} Shell
                                  </span>
                                )}
                              </li>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
                                  onClick={() => {
                                    setOpenMenuFor(null)
                                    setOpenDetailsFor((x) => (x === c.id ? null : c.id))
                                  }}
                                >
                                  {openDetailsFor === c.id ? 'Hide details' : 'Details'}
                                </button>
                              </li>
                              <li>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="w-full px-3 py-1.5 text-left text-zinc-200 hover:bg-zinc-800"
                                  onClick={() => {
                                    setOpenMenuFor(null)
                                    setComposeWorkspace({
                                      open: true,
                                      initialPath: composeMeta?.configFiles[0],
                                    })
                                  }}
                                >
                                  Compose workspace…
                                </button>
                              </li>
                            </ul>
                          ) : null}
                        </div>
                        {c.isOrphaned ? (
                          <span
                            className="shrink-0 rounded bg-orange-950/80 px-1 py-0.5 text-[10px] font-medium uppercase text-orange-200"
                            title="No template found for this container"
                          >
                            Orphan
                          </span>
                        ) : null}
                        {composeMeta ? (
                          <span
                            className="shrink-0 rounded bg-violet-950/80 px-1 py-0.5 text-[10px] font-medium uppercase text-violet-200"
                            title="Managed by Docker Compose (labels from compose)"
                          >
                            Compose
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {life ? (
                        <LifecycleStatus phase={life} />
                      ) : (
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs ${statusPillClass(c.state)}`}
                        >
                          {statusLabel(c)}
                        </span>
                      )}
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-1.5 text-xs text-zinc-400">
                      {c.image}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-zinc-400">
                      {pickContainerIp(c.networkSettings)}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-1.5 font-mono text-xs text-zinc-500">
                      {formatPorts(c)}
                    </td>
                    <td
                      className="max-w-[11rem] truncate px-3 py-1.5 text-xs text-zinc-400"
                      title={c.status || undefined}
                    >
                      {formatUptimeFromStatus(c)}
                    </td>
                    <td
                      className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-zinc-400"
                      title={
                        c.created != null && Number.isFinite(c.created)
                          ? new Date(createdToMs(c.created)).toLocaleString()
                          : undefined
                      }
                    >
                      {formatCreatedAge(c.created)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <AutostartSwitch
                        enabled={c.autoStart === true}
                        disabled={busy || remoteUpdateRunning || autostartMut.isPending}
                        pending={
                          autostartMut.isPending && autostartMut.variables?.id === c.id
                        }
                        waitSec={c.autoStartWait}
                        order={c.autoStartOrder}
                        onToggle={() =>
                          autostartMut.mutate({ id: c.id, next: !c.autoStart })
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                      <UpdateStatusCell explicit={explicit} c={c} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {running ? (
                          <>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() => stopMut.mutate(c.id)}
                              className={`${btnBase} bg-amber-950/80 text-amber-200 hover:bg-amber-900`}
                              title="Stop container"
                            >
                              Stop
                            </button>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() =>
                                restartMut.mutate({ id: c.id, state: c.state })
                              }
                              className={`${btnBase} bg-zinc-700 text-zinc-100 hover:bg-zinc-600`}
                              title="Restart (stop then start)"
                            >
                              Restart
                            </button>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() => pauseMut.mutate(c.id)}
                              className={`${btnBase} bg-zinc-700 text-zinc-100 hover:bg-zinc-600`}
                              title="Pause (freeze) container"
                            >
                              Pause
                            </button>
                          </>
                        ) : null}
                        {paused ? (
                          <>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() => unpauseMut.mutate(c.id)}
                              className={`${btnBase} bg-emerald-950/80 text-emerald-200 hover:bg-emerald-900`}
                              title="Resume paused container"
                            >
                              Resume
                            </button>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() => stopMut.mutate(c.id)}
                              className={`${btnBase} bg-amber-950/80 text-amber-200 hover:bg-amber-900`}
                              title="Stop (fully stops paused container)"
                            >
                              Stop
                            </button>
                            <button
                              type="button"
                              disabled={busy || remoteUpdateRunning}
                              onClick={() =>
                                restartMut.mutate({ id: c.id, state: c.state })
                              }
                              className={`${btnBase} bg-zinc-700 text-zinc-100 hover:bg-zinc-600`}
                              title="Restart (stop then start)"
                            >
                              Restart
                            </button>
                          </>
                        ) : null}
                        {exited ? (
                          <button
                            type="button"
                            disabled={busy || remoteUpdateRunning}
                            onClick={() => startMut.mutate(c.id)}
                            className={`${btnBase} bg-sky-950/80 text-sky-200 hover:bg-sky-900`}
                            title="Start container"
                          >
                            Start
                          </button>
                        ) : null}
                        {showUpdateBtn && (
                          <button
                            type="button"
                            disabled={busy || remoteUpdateRunning}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Update "${name}" to the latest image? A new window will run the server update and show live progress (this can take several minutes).`,
                                )
                              ) {
                                return
                              }
                              window.open(
                                buildUpdateProgressUrlSingle(c.id, name),
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }}
                            className={`${btnBase} border border-sky-700/80 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50`}
                            title="Opens an update progress window (mutation + container state polling)"
                          >
                            Update
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={busy || remoteUpdateRunning}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Permanently delete container "${name}"?\n\nThis removes the container from Docker. Named volumes on disk are not removed.`,
                              )
                            ) {
                              return
                            }
                            const withImage = window.confirm(
                              `Also remove the container image from this server?\n\nOK = remove image (only if no other container uses it).\nCancel = keep the image on disk.`,
                            )
                            deleteMut.mutate({ id: c.id, withImage })
                          }}
                          className={`${btnBase} bg-red-950/80 text-red-100 hover:bg-red-900`}
                          title="Remove container (optional: remove image)"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          disabled={remoteUpdateRunning}
                          onClick={() =>
                            window.open(
                              buildLogsWindowUrl(c.id, name),
                              `undocker_logs_${c.id.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80)}`,
                              'noopener,noreferrer',
                            )
                          }
                          className={`${btnBase} border border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700`}
                          title="Open logs in a new window (stays open while you use Unraid)"
                        >
                          Logs
                        </button>
                        {busy ? (
                          <span className="self-center text-xs text-zinc-500">…</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  {openDetailsFor === c.id ? (
                    <tr className="border-b border-zinc-800/80 bg-zinc-950/40">
                      <td colSpan={10} className="p-0 align-top">
                        <ContainerDetailsPane c={c} />
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
        {!containersQuery.isLoading && filtered.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">
            {list.length === 0
              ? 'No containers returned.'
              : 'No matching containers.'}
          </div>
        ) : null}
      </div>
      <ComposeWorkspaceModal
        open={composeWorkspace.open}
        onClose={() => setComposeWorkspace({ open: false })}
        initialPath={composeWorkspace.initialPath}
        onApplied={() => queryClient.invalidateQueries({ queryKey: QK })}
      />
    </div>
  )
}
