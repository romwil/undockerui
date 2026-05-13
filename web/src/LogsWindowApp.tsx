import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DOCKER_LOGS_QUERY, type DockerLogLine, type DockerLogsQueryData } from './lib/docker'
import { graphqlRequest } from './lib/graphql'
import { readLogsParams } from './logsUrl'

const btnBase =
  'rounded px-2 py-1 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap'

export default function LogsWindowApp() {
  const init = useMemo(() => readLogsParams(), [])
  const { id } = init
  const name = init.name || 'Container'
  const [tail, setTail] = useState(init.tail)

  useEffect(() => {
    document.title = `Logs — ${name} · UnDocker`
  }, [name])

  useEffect(() => {
    const u = new URL(window.location.href)
    u.searchParams.set('view', 'logs')
    u.searchParams.set('id', id)
    u.searchParams.set('name', name)
    u.searchParams.set('tail', String(tail))
    const csrf = new URLSearchParams(window.location.search).get('csrf')
    if (csrf) u.searchParams.set('csrf', csrf)
    window.history.replaceState(null, '', u.toString())
  }, [id, name, tail])

  const logsQuery = useQuery({
    queryKey: ['docker', 'logs', id, tail] as const,
    enabled: Boolean(id),
    queryFn: () =>
      graphqlRequest<DockerLogsQueryData>(DOCKER_LOGS_QUERY, {
        id,
        tail,
      }),
  })

  if (!id) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-950 p-6 text-sm text-red-200">
        Missing <code className="text-zinc-400">id</code> in the URL. Close this window and open logs
        from UnDocker again.
      </div>
    )
  }

  return (
    <div className="flex h-screen min-h-0 flex-col bg-zinc-950 text-zinc-200">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-800 px-4 py-3">
        <h1 className="text-sm font-semibold text-zinc-100">Logs — {name}</h1>
        <span className="text-xs text-zinc-500">UnDocker</span>
        <label className="ml-auto flex items-center gap-2 text-xs text-zinc-400">
          Tail
          <select
            value={tail}
            onChange={(e) => setTail(Number(e.target.value))}
            className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-zinc-200"
          >
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={300}>300</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={2500}>2500</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => logsQuery.refetch()}
          disabled={logsQuery.isFetching}
          className={`${btnBase} bg-zinc-700 text-zinc-100 hover:bg-zinc-600`}
        >
          {logsQuery.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {logsQuery.isLoading ? (
          <div className="p-6 text-sm text-zinc-500">Loading logs…</div>
        ) : logsQuery.error instanceof Error ? (
          <div className="m-4 rounded border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">
            {logsQuery.error.message}
          </div>
        ) : (
          <LogLinesBody lines={logsQuery.data?.docker?.logs?.lines ?? []} />
        )}
      </div>
    </div>
  )
}

function LogLinesBody({ lines }: { lines: DockerLogLine[] }) {
  if (!lines.length) {
    return (
      <div className="min-h-0 flex-1 overflow-auto p-6 text-sm text-zinc-500">
        No log lines returned. Try a larger tail, start the container, or check API permissions.
      </div>
    )
  }
  return (
    <div className="h-full overflow-auto p-2 font-mono text-[11px] leading-relaxed text-zinc-200">
      {lines.map((l, i) => (
        <div
          key={`${l.timestamp}-${i}`}
          className="border-b border-zinc-800/40 py-0.5 pl-1 hover:bg-zinc-900/60"
        >
          <span className="inline-block min-w-[8.5rem] select-none text-zinc-600">
            {formatLogTime(l.timestamp)}
          </span>
          <span className="whitespace-pre-wrap break-words align-top text-zinc-200">{l.message}</span>
        </div>
      ))}
    </div>
  )
}

function formatLogTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19)
  return d.toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
