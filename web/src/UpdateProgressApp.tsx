import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CONTAINERS_POLL_QUERY,
  DOCKER_UPDATE_ALL,
  DOCKER_UPDATE_CONTAINER,
  type ContainersPollQueryData,
  type DockerPollRow,
} from './lib/docker'
import { graphqlRequest } from './lib/graphql'
import {
  readUpdateProgressParams,
  UPDATE_PROGRESS_BROADCAST,
} from './updateProgressUrl'

function rowLabel(r: DockerPollRow): string {
  const n = r.names?.[0]
  if (!n) return r.id
  return n.replace(/^\//, '')
}

function trunc(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

/** Prevents duplicate mutation sessions (e.g. React StrictMode remount). */
const mutationInflight = new Set<string>()

export default function UpdateProgressApp() {
  const params = useMemo(() => readUpdateProgressParams(), [])
  const [log, setLog] = useState<string[]>([])
  const logEndRef = useRef<HTMLDivElement>(null)
  const [finished, setFinished] = useState(false)

  const title =
    params?.kind === 'all'
      ? 'Updating all containers'
      : params
        ? `Updating — ${params.name}`
        : 'Invalid update URL'

  useEffect(() => {
    document.title = params ? `${title} · UndockerUI` : 'Update · UndockerUI'
  }, [params, title])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  useEffect(() => {
    if (!params) return

    const key = params.kind === 'all' ? 'all' : params.id
    if (mutationInflight.has(key)) {
      return
    }
    mutationInflight.add(key)

    const bc =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(UPDATE_PROGRESS_BROADCAST)
        : null

    let alive = true

    const push = (line: string) => {
      if (!alive) return
      const t = new Date().toISOString().slice(11, 23)
      setLog((prev) => [...prev, `[${t}] ${line}`])
    }

    const notifyOpener = () => {
      try {
        if (window.opener && window.opener !== window) {
          window.opener.postMessage(
            { type: 'undocker-invalidate-containers', source: 'undocker-update-progress' },
            window.location.origin,
          )
        }
      } catch {
        // opener may be cross-origin
      }
    }

    const unlockBc = () => {
      try {
        bc?.postMessage({ running: false })
      } catch {
        /* ignore */
      }
    }

    const onUnload = () => {
      unlockBc()
    }
    window.addEventListener('beforeunload', onUnload)

    let lastById = new Map<string, DockerPollRow>()
    let firstPoll = true

    const poll = async () => {
      try {
        const data = await graphqlRequest<ContainersPollQueryData>(CONTAINERS_POLL_QUERY)
        if (!alive) return
        const rows = data.docker?.containers ?? []
        const map = new Map(rows.map((r) => [r.id, r]))

        if (firstPoll) {
          firstPoll = false
          lastById = map
          if (params.kind === 'single') {
            const row = map.get(params.id)
            if (row) {
              push(
                `Baseline — ${rowLabel(row)}: state=${row.state} updateFlag=${String(row.isUpdateAvailable)} status=${trunc(row.status, 140)}`,
              )
            } else {
              push('Baseline — container id not in list yet (server may still be syncing).')
            }
          } else {
            push(`Baseline — watching ${rows.length} container(s).`)
          }
          return
        }

        if (params.kind === 'single') {
          const cur = map.get(params.id)
          const prev = lastById.get(params.id)
          if (cur && prev) {
            const bits: string[] = []
            if (cur.state !== prev.state) bits.push(`state ${prev.state}→${cur.state}`)
            if (cur.status !== prev.status) bits.push(`status: ${trunc(cur.status, 100)}`)
            if (cur.image !== prev.image) bits.push('image changed')
            if (cur.isUpdateAvailable !== prev.isUpdateAvailable) {
              bits.push(
                `isUpdateAvailable ${String(prev.isUpdateAvailable)}→${String(cur.isUpdateAvailable)}`,
              )
            }
            if (bits.length) push(`${rowLabel(cur)}: ${bits.join(' · ')}`)
          } else if (cur && !prev) {
            push(`${rowLabel(cur)}: appeared state=${cur.state}`)
          }
        } else {
          for (const cur of rows) {
            const prev = lastById.get(cur.id)
            if (!prev) continue
            if (
              cur.state === prev.state &&
              cur.status === prev.status &&
              cur.image === prev.image &&
              cur.isUpdateAvailable === prev.isUpdateAvailable
            ) {
              continue
            }
            const label = rowLabel(cur)
            const bits: string[] = []
            if (cur.state !== prev.state) bits.push(`state ${prev.state}→${cur.state}`)
            if (cur.image !== prev.image) bits.push('image changed')
            if (cur.isUpdateAvailable !== prev.isUpdateAvailable) {
              bits.push(
                `updateAvail ${String(prev.isUpdateAvailable)}→${String(cur.isUpdateAvailable)}`,
              )
            }
            if (cur.status !== prev.status) bits.push(`status ${trunc(cur.status, 90)}`)
            if (bits.length) push(`${label}: ${bits.join(' · ')}`)
          }
        }

        lastById = map
      } catch (e) {
        push(`Poll error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    try {
      bc?.postMessage({
        running: true,
        scope: params.kind === 'all' ? 'all' : 'single',
      })
    } catch {
      /* ignore */
    }

    void poll()
    const intervalId = window.setInterval(() => void poll(), 1500)

    void (async () => {
      try {
        if (params.kind === 'single') {
          push(
            'Calling GraphQL docker.updateContainer (server runs Unraid update_container script; may take several minutes)…',
          )
          await graphqlRequest(DOCKER_UPDATE_CONTAINER, { id: params.id })
          push('Mutation updateContainer finished OK.')
        } else {
          push(
            'Calling GraphQL docker.updateAllContainers (server updates each container in turn; may take a long time)…',
          )
          await graphqlRequest(DOCKER_UPDATE_ALL)
          push('Mutation updateAllContainers finished OK.')
        }
      } catch (e) {
        push(`Mutation failed: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        if (intervalId) window.clearInterval(intervalId)
        mutationInflight.delete(key)
        try {
          await poll()
        } catch {
          /* ignore */
        }
        if (alive) {
          push('Session complete — refresh the main UndockerUI tab if it is still open.')
          setFinished(true)
          notifyOpener()
        }
        unlockBc()
        window.removeEventListener('beforeunload', onUnload)
        bc?.close()
      }
    })()

    return () => {
      alive = false
      if (intervalId) window.clearInterval(intervalId)
      window.removeEventListener('beforeunload', onUnload)
      unlockBc()
      mutationInflight.delete(key)
    }
  }, [params])

  if (!params) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 p-6 text-sm text-red-200">
        Invalid update URL. Expected <code className="text-zinc-400">view=update</code> with{' '}
        <code className="text-zinc-400">id</code> + <code className="text-zinc-400">name</code>, or{' '}
        <code className="text-zinc-400">mode=all</code>.
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-zinc-950 text-zinc-200">
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">{title}</h1>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-zinc-500">
          Unraid’s stock Docker page streams detailed pull / recreate lines over nchan; the public GraphQL
          API only exposes the long-running mutation plus live container fields. This window polls the
          container list while the mutation runs so you can see state, status, image, and update flags change
          in real time.
        </p>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
        <pre className="h-full overflow-auto whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900/60 p-3 font-mono text-[11px] leading-relaxed text-zinc-200">
          {log.join('\n')}
          <div ref={logEndRef} />
        </pre>
      </div>
      {finished ? (
        <footer className="shrink-0 border-t border-zinc-800 px-4 py-2 text-center text-xs text-zinc-500">
          You can close this window.
        </footer>
      ) : null}
    </div>
  )
}
