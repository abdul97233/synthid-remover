import { useEffect, useState } from 'react'

/**
 * Create a managed object URL for a Blob/File. The URL is revoked
 * automatically when the source changes or the component unmounts, so
 * temporary browser memory is released as soon as it is no longer needed.
 */
export function useObjectUrl(source?: Blob | File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!source) {
      setUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(source)
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [source])

  return url
}
