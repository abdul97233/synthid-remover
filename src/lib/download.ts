/** Trigger a browser download for a locally generated blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  // Some browsers (notably Safari / slow disks with large files) read the URL
  // well after click(); revoking too early aborts the download. Keep it alive
  // for a minute, then release the memory.
  window.setTimeout(() => {
    a.remove()
    URL.revokeObjectURL(url)
  }, 60_000)
}
