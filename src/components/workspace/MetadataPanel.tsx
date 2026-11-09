import { useId, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, FileSearch, Layers, Search, Tags, X } from 'lucide-react'
import type { FileItem, MetadataEntry } from '../../types'
import { formatBytes, cn } from '../../lib/format'
import { Badge } from '../ui/Badge'
import { Skeleton } from '../ui/Spinner'
import { EASE } from '../ui/Motion'
import { kindOf } from './utils'

/**
 * Full byte-level transparency: the container structure report plus the
 * decoded EXIF/XMP/IPTC key-value dump for images.
 */

function Collapsible({
  title,
  icon: Icon,
  count,
  defaultOpen = true,
  children,
}: {
  title: string
  icon?: typeof Layers
  count?: number | string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const reduce = useReducedMotion()
  const id = useId()
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-elevated/50 focus-visible:outline-offset-[-2px]"
      >
        {Icon && <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</span>
        {count !== undefined && <Badge tone="neutral">{count}</Badge>}
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted transition-transform duration-300', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            key="content"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="overflow-hidden border-t border-line/60"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StructureTable({ item }: { item: FileItem }) {
  const entries = item.structure?.entries ?? []
  if (entries.length === 0) {
    return <p className="px-4 py-4 text-sm text-muted">No structure elements were reported for this file.</p>
  }
  return (
    <div className="thin-scroll max-h-96 overflow-auto overscroll-contain" tabIndex={0} aria-label="Byte structure table (scrollable)">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-elevated text-[11px] uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">Element</th>
            <th scope="col" className="px-4 py-2 font-medium">Description</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Offset</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Size</th>
            <th scope="col" className="px-4 py-2 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-muted">
          {entries.map((e, i) => (
            <tr key={`${e.name}-${e.offset}-${i}`} className={cn('border-t border-line/50', e.removable && 'bg-warn/[0.04]')}>
              <td className="max-w-48 px-4 py-2 align-top break-all text-foreground/90">{e.name}</td>
              <td className="min-w-48 px-4 py-2 align-top break-words">{e.description ?? '—'}</td>
              <td className="px-4 py-2 text-right align-top whitespace-nowrap tabular-nums">0x{e.offset.toString(16)}</td>
              <td className="px-4 py-2 text-right align-top whitespace-nowrap tabular-nums">{formatBytes(e.size)}</td>
              <td className="px-4 py-2 text-right align-top whitespace-nowrap">
                {e.removable ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warn/10 px-1.5 py-0.5 text-warn">metadata</span>
                ) : (
                  <span className="inline-flex items-center rounded-md bg-elevated px-1.5 py-0.5">data</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DecodedGroups({ entries }: { entries: MetadataEntry[] }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const groups = useMemo(() => {
    const map = new Map<string, MetadataEntry[]>()
    for (const e of entries) {
      if (q && !e.key.toLowerCase().includes(q) && !e.value.toLowerCase().includes(q)) continue
      const list = map.get(e.group) ?? []
      list.push(e)
      map.set(e.group, list)
    }
    return [...map.entries()]
  }, [entries, q])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Filter ${entries.length} decoded fields…`}
          aria-label="Filter decoded metadata fields"
          className="h-10 w-full rounded-xl border border-line bg-card pr-9 pl-9 text-sm placeholder:text-subtle focus:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear filter"
            className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No fields match “{query}”.
        </p>
      ) : (
        groups.map(([group, list], gi) => (
          <Collapsible key={group} title={group} icon={Tags} count={list.length} defaultOpen={gi < 2 || !!q}>
            <dl className="thin-scroll max-h-80 overflow-y-auto overscroll-contain px-4 py-1 text-xs">
              {list.map((e, i) => (
                <div
                  key={`${e.key}-${i}`}
                  className={cn('grid gap-0.5 py-2 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4', i > 0 && 'border-t border-line/40')}
                >
                  <dt className="font-mono text-muted break-all">{e.key}</dt>
                  <dd className="min-w-0 font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">{e.value}</dd>
                </div>
              ))}
            </dl>
          </Collapsible>
        ))
      )}
    </div>
  )
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-elevated/40 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}

export function MetadataPanel({ item }: { item: FileItem }) {
  const isImage = kindOf(item) === 'image'
  const structure = item.structure

  if (!structure) {
    if (item.status === 'analyzing') {
      return (
        <div className="space-y-3" aria-busy="true" aria-label="Reading file structure">
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-48" />
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
        <FileSearch className="size-6 text-subtle" aria-hidden="true" />
        <p className="mt-2 text-sm font-medium">No structure report yet</p>
        <p className="mt-1 text-xs text-muted">
          {item.status === 'error' ? 'The analysis failed, so the file structure could not be read.' : 'Run an analysis to read the file structure.'}
        </p>
      </div>
    )
  }

  const removable = structure.entries.filter((e) => e.removable)
  const removableBytes = removable.reduce((sum, e) => sum + e.size, 0)

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted">
        Every metadata element found in the file, element by element. Items marked{' '}
        <span className="font-medium text-warn">metadata</span> are removed by the cleaner;{' '}
        <span className="font-medium text-foreground">data</span> items are the media payload and essential codec
        structures — untouched.
      </p>

      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="Elements" value={String(structure.entries.length)} />
        <SummaryTile label="Metadata" value={String(removable.length)} />
        <SummaryTile label="Removable" value={formatBytes(removableBytes)} />
      </div>

      <Collapsible title="Byte structure" icon={Layers} count={structure.entries.length}>
        <StructureTable item={item} />
      </Collapsible>

      {isImage && (
        <section aria-labelledby="decoded-heading" className="space-y-3">
          <h4 id="decoded-heading" className="pt-1 text-sm font-semibold">
            Decoded metadata (EXIF · XMP · IPTC)
          </h4>
          {item.metadata && item.metadata.length > 0 ? (
            <DecodedGroups entries={item.metadata} />
          ) : (
            <p className="rounded-2xl border border-line bg-card p-4 text-sm text-muted">
              No decoded EXIF/XMP/IPTC records (images only) — or the metadata block could not be decoded.
              The byte structure above is the authoritative report.
            </p>
          )}
        </section>
      )}

      {structure.notes.length > 0 && (
        <ul className="space-y-1.5 rounded-2xl border border-line bg-elevated/40 p-4 text-xs leading-relaxed text-muted">
          {structure.notes.map((n, i) => (
            <li key={i} className="flex gap-2 [overflow-wrap:anywhere]">
              <span className="text-primary" aria-hidden="true">·</span> {n}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
