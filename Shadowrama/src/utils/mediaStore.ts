interface MediaEntry {
  blobUrl: string
  base64: string // sans préfixe data:, juste le payload
}

const store = new Map<string, MediaEntry>()

export function registerMedia(key: string, base64: string, mimeType: string): string {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const blobUrl = URL.createObjectURL(blob)
  store.set(key, { blobUrl, base64 })
  return blobUrl
}

export function resolveMedia(key: string): string | undefined {
  return store.get(key)?.blobUrl
}

export function clearMediaStore() {
  for (const entry of store.values()) URL.revokeObjectURL(entry.blobUrl)
  store.clear()
}

export function getAllMediaForSave(): { key: string; data: string }[] {
  return Array.from(store.entries()).map(([key, entry]) => ({ key, data: entry.base64 }))
}

export function generateMediaKey(originalName: string): string {
  const ext = originalName.split('.').pop() || 'png'
  return `media/img-${Date.now()}-${Math.floor(Math.random() * 1000)}.${ext}`
}