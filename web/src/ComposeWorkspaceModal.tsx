import { useEffect, useRef, useState } from 'react'
import type { ComposeListDirEntry, ComposeListDirOk } from './composeApi'
import { composeApiRequest } from './composeApi'
import { tryOpenUnraidFileBrowser } from './unraidFileBrowser'

const DEFAULT_YAML = `services:
  app:
    image: hello-world
    restart: unless-stopped
`

type Props = {
  open: boolean
  onClose: () => void
  initialPath?: string
  onApplied?: () => void
}

function parentDir(p: string): string {
  const n = p.replace(/\/+$/, '')
  const i = n.lastIndexOf('/')
  if (i <= 0) return '/mnt/user'
  const up = n.slice(0, i)
  return up.length >= 8 ? up : '/mnt/user'
}

function browseStartingDir(pathField: string): string {
  const t = pathField.trim()
  if (!t) return '/mnt/user'
  if (/\.(ya?ml|yaml)$/i.test(t)) return parentDir(t)
  const noTrail = t.replace(/\/+$/, '')
  return noTrail || '/mnt/user'
}

function browseCanGoUp(abs: string): boolean {
  const cur = abs.replace(/\/+$/, '') || '/'
  const up = parentDir(cur)
  if (up === cur) return false
  if (up.startsWith('/mnt/user')) return true
  if (up.startsWith('/mnt/cache')) return true
  if (up.startsWith('/boot/config')) return true
  if (/^\/mnt\/disk[0-9]+(\/|$)/.test(up)) return true
  return false
}

export default function ComposeWorkspaceModal({ open, onClose, initialPath, onApplied }: Props) {
  if (!open) return null
  return (
    <ComposeWorkspaceModalBody
      onClose={onClose}
      initialPath={initialPath}
      onApplied={onApplied}
    />
  )
}

type BodyProps = {
  onClose: () => void
  initialPath?: string
  onApplied?: () => void
}

function ComposeWorkspaceModalBody({ onClose, initialPath, onApplied }: BodyProps) {
  const pathInputRef = useRef<HTMLInputElement>(null)
  const [path, setPath] = useState(() => initialPath?.trim() ?? '')
  const [yaml, setYaml] = useState(DEFAULT_YAML)
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const [browseOpen, setBrowseOpen] = useState(false)
  const [browsePath, setBrowsePath] = useState('/mnt/user')
  const [browseEntries, setBrowseEntries] = useState<ComposeListDirEntry[]>([])
  const [browseBusy, setBrowseBusy] = useState(false)
  const [browseErr, setBrowseErr] = useState<string | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function refreshBrowse(dir: string) {
    setBrowseBusy(true)
    setBrowseErr(null)
    try {
      const r = await composeApiRequest({ action: 'listDir', path: dir })
      if ('error' in r && r.ok === false) {
        setBrowseErr(r.error)
        setBrowseEntries([])
        return
      }
      if ('entries' in r && r.ok === true) {
        const ok = r as ComposeListDirOk
        setBrowsePath(ok.path)
        setBrowseEntries(ok.entries)
        return
      }
      setBrowseErr('Unexpected list response.')
      setBrowseEntries([])
    } catch (e) {
      setBrowseErr(e instanceof Error ? e.message : String(e))
      setBrowseEntries([])
    } finally {
      setBrowseBusy(false)
    }
  }

  function openPathBrowse() {
    const el = pathInputRef.current
    if (el && tryOpenUnraidFileBrowser(el)) {
      setBrowseOpen(false)
      return
    }
    const start = browseStartingDir(path)
    setBrowsePath(start)
    setBrowseOpen(true)
    void refreshBrowse(start)
  }

  async function doLoad() {
    const p = path.trim()
    if (!p) {
      setErr('Set a compose file path first.')
      return
    }
    setBusy(true)
    setErr(null)
    setLog('')
    try {
      const r = await composeApiRequest({ action: 'read', path: p })
      if ('error' in r && r.ok === false) {
        setErr(r.error)
        return
      }
      if ('content' in r && r.ok === true) {
        setYaml(r.content)
        setLog('Loaded compose file.')
        return
      }
      setErr('Unexpected response from server.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function doComposeUp() {
    const p = path.trim()
    if (!p) {
      setErr('Set a compose file path first.')
      return
    }
    setBusy(true)
    setErr(null)
    setLog('')
    try {
      const r = await composeApiRequest({ action: 'composeUp', path: p })
      if ('error' in r && r.ok === false) {
        setErr(r.error)
        return
      }
      if ('log' in r) {
        setLog(r.log)
        if (r.ok) onApplied?.()
        else setErr(`docker compose failed (exit ${r.exitCode ?? '?'})`)
        return
      }
      setErr('Unexpected response from server.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function doWriteApply() {
    const p = path.trim()
    if (!p) {
      setErr('Set a compose file path first.')
      return
    }
    setBusy(true)
    setErr(null)
    setLog('')
    try {
      const r = await composeApiRequest({ action: 'writeApply', path: p, yaml })
      if ('error' in r && r.ok === false) {
        setErr(r.error)
        return
      }
      if ('log' in r) {
        setLog(r.log)
        if (r.ok) onApplied?.()
        else setErr(`docker compose failed (exit ${r.exitCode ?? '?'})`)
        return
      }
      setErr('Unexpected response from server.')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="compose-ws-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col rounded-lg border border-zinc-600 bg-zinc-950 text-zinc-200 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-2">
          <h2 id="compose-ws-title" className="text-sm font-semibold text-zinc-100">
            Compose workspace
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            Close
          </button>
        </div>
        <p className="shrink-0 border-b border-zinc-800/80 px-4 py-2 text-[11px] leading-relaxed text-zinc-500">
          Paths must live under <span className="font-mono text-zinc-400">/mnt/user/</span>,{' '}
          <span className="font-mono text-zinc-400">/mnt/cache/</span>,{' '}
          <span className="font-mono text-zinc-400">/mnt/disk#/</span>, or{' '}
          <span className="font-mono text-zinc-400">/boot/config/</span> and end in{' '}
          <span className="font-mono">.yml</span> / <span className="font-mono">.yaml</span>. Uses
          Docker Compose v2 (<span className="font-mono">docker compose</span>) on the server.
          <span className="mt-1 block text-zinc-600">
            Browse tries the stock Unraid file tree when available; otherwise a server directory
            listing is used.
          </span>
        </p>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Compose file path
          </label>
          <div className="mb-3 flex gap-1.5">
            <input
              ref={pathInputRef}
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/mnt/user/appdata/compose/myapp/docker-compose.yml"
              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
              autoComplete="off"
            />
            <button
              type="button"
              onClick={openPathBrowse}
              className="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
              title="Pick path (Unraid file browser when loaded, else server listing)"
            >
              Browse…
            </button>
          </div>
          {browseOpen ? (
            <div className="mb-3 rounded border border-zinc-700 bg-zinc-900/90 p-2">
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-zinc-800 pb-2 font-mono text-[11px] text-zinc-400">
                <button
                  type="button"
                  disabled={browseBusy || !browseCanGoUp(browsePath)}
                  onClick={() => {
                    const up = parentDir(browsePath.replace(/\/+$/, ''))
                    void refreshBrowse(up)
                  }}
                  className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800 disabled:opacity-30"
                  title="Parent directory"
                >
                  Up
                </button>
                <span className="min-w-0 flex-1 truncate text-zinc-300" title={browsePath}>
                  {browsePath}
                </span>
                <button
                  type="button"
                  onClick={() => setBrowseOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  Close picker
                </button>
              </div>
              {browseErr ? (
                <div className="mb-2 text-xs text-red-300">{browseErr}</div>
              ) : null}
              {browseBusy ? (
                <div className="py-4 text-center text-xs text-zinc-500">Loading…</div>
              ) : (
                <ul className="max-h-48 overflow-auto text-xs">
                  {browseEntries.length === 0 ? (
                    <li className="py-2 text-zinc-500">No subfolders or .yml/.yaml files here.</li>
                  ) : (
                    browseEntries.map((e) => (
                      <li key={e.path}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-left hover:bg-zinc-800"
                          onClick={() => {
                            if (e.type === 'dir') {
                              void refreshBrowse(e.path)
                            } else {
                              setPath(e.path)
                              setBrowseOpen(false)
                            }
                          }}
                        >
                          <span className="w-5 shrink-0 text-zinc-500">
                            {e.type === 'dir' ? '▸' : '◇'}
                          </span>
                          <span className="truncate font-mono text-zinc-200">{e.name}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          ) : null}
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            docker-compose.yml
          </label>
          <textarea
            value={yaml}
            onChange={(e) => setYaml(e.target.value)}
            spellCheck={false}
            className="h-64 w-full resize-y rounded border border-zinc-700 bg-zinc-900 p-2 font-mono text-xs leading-relaxed text-zinc-100"
          />
          {err ? (
            <div className="mt-2 rounded border border-red-900/70 bg-red-950/40 px-2 py-1.5 text-xs text-red-200">
              {err}
            </div>
          ) : null}
          {log ? (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-900/80 p-2 font-mono text-[11px] text-zinc-400">
              {log}
            </pre>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-zinc-800 px-4 py-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void doLoad()}
            className="rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            Load from disk
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doComposeUp()}
            className="rounded border border-emerald-800/80 bg-emerald-950/50 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-40"
          >
            Deploy (compose up)
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void doWriteApply()}
            className="rounded border border-sky-800/80 bg-sky-950/50 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-900/50 disabled:opacity-40"
          >
            Save & deploy
          </button>
        </div>
      </div>
    </div>
  )
}
