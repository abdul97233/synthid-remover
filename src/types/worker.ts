import type { ScanResult, StructureReport, MediaFormat, MediaKind, MetadataEntry, RemovedItem } from './index'

/** 'cancel' drops a queued or running request (its promise rejects with an AbortError). */
export type WorkerOp = 'scan' | 'strip' | 'cancel'

export type WorkerRequest =
  | { id: string; op: 'scan' | 'strip'; file: File }
  | { id: string; op: 'cancel' }

export type WorkerResponse =
  | { id: string; type: 'progress'; value: number }
  | { id: string; type: 'done'; result: WorkerResult }
  | { id: string; type: 'error'; message: string }
  | { id: string; type: 'cancelled' }

export interface ScanWorkerResult {
  scan: ScanResult
  structure: StructureReport
  format: MediaFormat
  mime: string
  /** Media kind derived from the real (magic-byte) format, not the extension. */
  kind: MediaKind
  /** Decoded metadata produced in the worker (PDF); images use exifr on the main thread. */
  metadata?: MetadataEntry[]
}

export interface StripWorkerResult {
  blob: Blob
  size: number
  removed: RemovedItem[]
  notes: string[]
  mime: string
  format: MediaFormat
}

export type WorkerResult = ScanWorkerResult | StripWorkerResult
