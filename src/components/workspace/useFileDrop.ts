import { useEffect, useRef, useState } from 'react'

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

/**
 * Window-level file drag & drop + clipboard paste.
 * - Prevents the browser from navigating to a file dropped outside the drop target.
 * - Reports whether files are being dragged anywhere over the page.
 * - Accepts files pasted from the clipboard (e.g. a copied screenshot).
 * Nothing leaves the browser: files are handed to the local processor.
 */
export function useFileDrop(onFiles: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false)
  const depth = useRef(0)
  const cb = useRef(onFiles)
  cb.current = onFiles

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current += 1
      setDragging(true)
    }
    const onOver = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) cb.current(files)
    }
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.length === 0) return
      e.preventDefault()
      // Clipboard images often arrive as "image.png" — give them a unique, readable name.
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const named = files.map((f, i) => {
        if (f.name && f.name !== 'image.png' && f.name.includes('.')) return f
        const ext = f.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov').replace('mpeg', 'mp3') || 'png'
        return new File([f], `pasted-${stamp}${files.length > 1 ? `-${i + 1}` : ''}.${ext}`, {
          type: f.type,
          lastModified: Date.now(),
        })
      })
      cb.current(named)
    }
    const reset = () => {
      depth.current = 0
      setDragging(false)
    }

    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    window.addEventListener('dragend', reset)
    window.addEventListener('blur', reset)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('dragend', reset)
      window.removeEventListener('blur', reset)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  return dragging
}
