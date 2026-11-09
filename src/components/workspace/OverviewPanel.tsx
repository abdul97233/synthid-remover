import type { FileItem } from '../../types'
import { formatBytes, formatDuration, formatDate, cn } from '../../lib/format'
import { FORMAT_LABEL } from '../../lib/constants'
import { Skeleton } from '../ui/Spinner'
import { kindOf } from './utils'

function Field({ label, value, loading, wide }: { label: string; value?: string; loading?: boolean; wide?: boolean }) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-line bg-elevated/40 px-4 py-3', wide && 'col-span-2 sm:col-span-3')}>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium [overflow-wrap:anywhere]">
        {value !== undefined ? value : loading ? <Skeleton className="mt-1 h-4 w-20" /> : <span className="text-subtle">—</span>}
      </dd>
    </div>
  )
}

export function OverviewPanel({ item }: { item: FileItem }) {
  const info = item.info
  const loading = item.status === 'analyzing' && !info
  const kind = kindOf(item)
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Field label="File name" value={info?.name ?? item.file.name} wide />
        <Field label="Kind" value={kind.charAt(0).toUpperCase() + kind.slice(1)} />
        <Field label="Format" value={info ? FORMAT_LABEL[info.format] : undefined} loading={loading} />
        <Field label="File size" value={formatBytes(info?.size ?? item.file.size)} />
        <Field label="Dimensions" value={info?.width ? `${info.width} × ${info.height ?? '?'}` : undefined} loading={loading} />
        <Field label="Duration" value={info?.duration !== undefined ? formatDuration(info.duration) : undefined} loading={loading && kind !== 'image'} />
        <Field label="MIME type" value={info?.type || info?.mime || item.file.type || undefined} loading={loading} />
        <Field label="Last modified" value={formatDate(item.file.lastModified)} />
        <Field
          label="Metadata elements"
          value={item.structure ? String(item.structure.entries.filter((e) => e.removable).length) : undefined}
          loading={loading}
        />
      </dl>
      {item.status === 'analyzing' && (
        <p className="text-xs text-muted">Probing media details… values fill in as each check completes.</p>
      )}
      {item.status === 'error' && item.error && (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger [overflow-wrap:anywhere]">
          {item.error}
        </p>
      )}
    </div>
  )
}
