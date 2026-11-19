import { useCallback, useEffect, useState } from 'react'
import type { AISettings } from './types'

/** Retire le préfixe technique « Error invoking remote method … » des erreurs IPC. */
export function cleanIpcError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

/**
 * Réglages de l'assistant, lus et écrits via le processus principal. La clé API
 * n'apparaît jamais ici : on sait seulement si une clé est enregistrée.
 */
export function useAISettings() {
  const api = window.aiAPI
  const [settings, setSettings] = useState<AISettings | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!api) return
    let cancelled = false
    api.getSettings()
      .then(s => { if (!cancelled) setSettings(s) })
      .catch(err => { if (!cancelled) setError(cleanIpcError(err)) })
    return () => { cancelled = true }
  }, [api])

  const run = useCallback(async (action: () => Promise<AISettings>): Promise<boolean> => {
    try {
      setSettings(await action())
      setError(null)
      return true
    } catch (err) {
      setError(cleanIpcError(err))
      return false
    }
  }, [])

  const save = useCallback(
    (patch: { provider?: string; model?: string; consent?: boolean }) =>
      run(() => api!.saveSettings(patch)),
    [api, run],
  )
  const setKey = useCallback((provider: string, key: string) => run(() => api!.setKey(provider, key)), [api, run])
  const clearKey = useCallback((provider: string) => run(() => api!.clearKey(provider)), [api, run])

  return { available: !!api, settings, error, setError, save, setKey, clearKey }
}
