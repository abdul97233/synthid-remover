export type MediaKind = 'image' | 'audio' | 'video' | 'document'

export type MediaFormat = 'jpeg' | 'png' | 'webp' | 'mp3' | 'wav' | 'mp4' | 'mov' | 'pdf' | 'unknown'

export type FileStatus = 'idle' | 'analyzing' | 'cleaning' | 'ready' | 'error'

/** One row of the byte-structure report shown in the Metadata tab. */
export interface StructureEntry {
  name: string
  description?: string
  offset: number
  size: number
  /** true when the cleaning step would remove this element */
  removable: boolean
}

export interface StructureReport {
  format: MediaFormat
  mime: string
  entries: StructureEntry[]
  notes: string[]
  /** Set when the container could not be parsed; the raw byte scan still ran. */
  parseError?: string
}

export interface MarkerHit {
  term: string
  label: string
  strength: 'strong' | 'weak'
  source: 'file bytes' | 'metadata'
  snippet?: string
}

export interface ScanResult {
  hits: MarkerHit[]
  bytesScanned: number
  totalBytes: number
  truncated?: boolean
}

/**
 * Determination values are strictly evidence-based:
 * - "found" ....... explicit AI-generation / provenance markers exist in metadata
 * - "none-found" .. no metadata markers exist (this does NOT prove watermark absence)
 * The pixel-level SynthID question is always reported as "cannot be
 * determined locally" — see the UI copy for the honest wording.
 */
export type Determination = 'found' | 'none-found' | 'undetermined'

export interface AnalysisResult {
  scan: ScanResult
  /**
   * 'found' only for real AI / provenance markers (not mere XMP presence);
   * 'undetermined' when nothing was found but the container could not be parsed.
   */
  determination: Determination
  /** Why the result is 'undetermined'. */
  undeterminedReason?: string
  c2paPresent: boolean
  synthIdMentioned: boolean
  digitalSourceType?: string
  hints: MarkerHit[]
}

export interface MetadataEntry {
  group: string
  key: string
  value: string
}

export interface RemovedItem {
  label: string
  size: number
}

export interface CleanResult {
  blob: Blob
  size: number
  originalSize: number
  removed: RemovedItem[]
  notes: string[]
  filename: string
  format: MediaFormat
  mime: string
}

export interface MediaInfo {
  name: string
  size: number
  type: string
  lastModified: string
  kind: MediaKind
  format: MediaFormat
  mime: string
  width?: number
  height?: number
  duration?: number
}

export interface FileItem {
  id: string
  file: File
  status: FileStatus
  progress: number
  error?: string
  info?: MediaInfo
  metadata?: MetadataEntry[]
  structure?: StructureReport
  analysis?: AnalysisResult
  clean?: CleanResult
}
