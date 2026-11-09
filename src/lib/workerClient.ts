import type { StripWorkerResult, ScanWorkerResult, WorkerRequest, WorkerResponse } from '../types/worker'

/**
 * Singleton worker client. Keeps one processor worker alive for the whole
 * session and maps request ids to pending promises. The worker is created
 * lazily on the first analysis, so the landing page stays feather-light.
 * If the worker crashes (e.g. out of memory) every pending request is
 * rejected and a fresh worker is created for the next request.
 */

let worker: Worker | null = null

interface Pending {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  onProgress?: (percent: number) => void
  cleanup?: () => void
}

const pending = new Map<string, Pending>()

function settle(id: string): Pending | undefined {
  const entry = pending.get(id)
  if (!entry) return undefined
  pending.delete(id)
  entry.cleanup?.()
  return entry
}

function abortError(): Error {
  const err = new Error('The operation was cancelled.')
  err.name = 'AbortError'
  return err
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

function createWorker(): Worker {
  const w = new Worker(new URL('../workers/processor.worker.ts', import.meta.url), { type: 'module' })
  w.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const msg = event.data
    if (msg.type === 'progress') {
      pending.get(msg.id)?.onProgress?.(msg.value)
      return
    }
    const entry = settle(msg.id)
    if (!entry) return
    if (msg.type === 'done') entry.resolve(msg.result)
    else if (msg.type === 'cancelled') entry.reject(abortError())
    else entry.reject(new Error(msg.message))
  }
  const crash = (message: string) => {
    const error = new Error(message)
    for (const id of [...pending.keys()]) settle(id)?.reject(error)
    // Drop the broken worker so the next request starts a fresh one.
    if (worker === w) worker = null
    w.terminate()
  }
  w.onerror = (event) => {
    event.preventDefault()
    crash(event.message || 'The processing worker crashed (the file may be too large for available memory).')
  }
  w.onmessageerror = () => crash('The processing worker sent an unreadable message.')
  return w
}

export function callWorker<T>(
  op: 'scan' | 'strip',
  file: File,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError())
  const w = (worker = worker ?? createWorker())
  const id = crypto.randomUUID()
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const entry = settle(id)
      if (!entry) return
      const cancel: WorkerRequest = { id, op: 'cancel' }
      w.postMessage(cancel)
      entry.reject(abortError())
    }
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      onProgress,
      cleanup: () => signal?.removeEventListener('abort', onAbort),
    })
    signal?.addEventListener('abort', onAbort, { once: true })
    const request: WorkerRequest = { id, op, file }
    w.postMessage(request)
  })
}

export function scanFile(file: File, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<ScanWorkerResult> {
  return callWorker<ScanWorkerResult>('scan', file, onProgress, signal)
}

export function stripFile(file: File, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<StripWorkerResult> {
  return callWorker<StripWorkerResult>('strip', file, onProgress, signal)
}
