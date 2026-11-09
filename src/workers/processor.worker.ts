/// <reference lib="webworker" />
import type { WorkerRequest, WorkerResponse } from '../types/worker'
import { scanArrayBuffer, stripArrayBuffer } from './processor'

/**
 * All heavy byte work happens here so the UI thread never freezes.
 * The File object is cloned into the worker and read locally; the main
 * thread never keeps big ArrayBuffers alive.
 *
 * Requests run strictly one at a time (a batch of large files would
 * otherwise all be read into memory at once), and queued or running
 * requests can be cancelled when the user removes a file.
 */

interface WorkerContext {
  postMessage(message: WorkerResponse, transfer?: Transferable[]): void
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null
}

const ctx = self as unknown as WorkerContext

class CancelledError extends Error {}

const cancelled = new Set<string>()
let queue: Promise<void> = Promise.resolve()

function checkCancelled(id: string): void {
  if (cancelled.has(id)) throw new CancelledError()
}

async function run(req: Extract<WorkerRequest, { op: 'scan' | 'strip' }>): Promise<void> {
  try {
    checkCancelled(req.id)
    let bytes: Uint8Array | null = new Uint8Array(await req.file.arrayBuffer())
    checkCancelled(req.id)
    if (req.op === 'scan') {
      const result = await scanArrayBuffer(bytes, req.file.name, (value) => {
        checkCancelled(req.id)
        ctx.postMessage({ id: req.id, type: 'progress', value })
      })
      bytes = null // release the file buffer before posting
      ctx.postMessage({ id: req.id, type: 'done', result })
    } else {
      ctx.postMessage({ id: req.id, type: 'progress', value: 30 })
      const result = await stripArrayBuffer(bytes, req.file.name)
      bytes = null
      checkCancelled(req.id)
      ctx.postMessage({ id: req.id, type: 'progress', value: 100 })
      ctx.postMessage({ id: req.id, type: 'done', result })
    }
  } catch (err) {
    if (err instanceof CancelledError) {
      ctx.postMessage({ id: req.id, type: 'cancelled' })
    } else {
      ctx.postMessage({
        id: req.id,
        type: 'error',
        message: err instanceof Error && err.message ? err.message : 'Processing failed unexpectedly.',
      })
    }
  } finally {
    cancelled.delete(req.id)
  }
}

ctx.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const req = event.data
  if (req.op === 'cancel') {
    cancelled.add(req.id)
    return
  }
  if (req.op === 'scan' || req.op === 'strip') {
    queue = queue.then(() => run(req))
  }
}
