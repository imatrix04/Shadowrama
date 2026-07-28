import { useCallback, useEffect, useState } from 'react'
import type { Release } from '../utils/changelog'
import {
  RELEASES, getLastSeenVersion, setLastSeenVersion, releasesToAnnounce,
} from '../utils/changelog'

type Mode = 'after-update' | 'browse'

/**
 * Décide si l'écran « Nouveautés » doit s'ouvrir après une mise à jour, et
 * permet de le rouvrir à la demande.
 *
 * La version installée vient du process principal (`app.getVersion()`), seule
 * source fiable : `package.json` n'est pas lisible depuis le rendu, et hors
 * Electron on retombe sur la version la plus récente du changelog embarqué.
 */
export function useWhatsNew() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [releases, setReleases] = useState<Release[]>([])
  const [mode, setMode] = useState<Mode>('after-update')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const resolveVersion = window.electronAPI?.getAppVersion
      ? window.electronAPI.getAppVersion()
      : Promise.resolve(RELEASES[0]?.version ?? '0.0.0')

    resolveVersion.then(version => {
      if (cancelled) return
      setCurrentVersion(version)

      const lastSeen = getLastSeenVersion()
      const toAnnounce = releasesToAnnounce(version, lastSeen)

      // Toujours mémoriser la version vue, y compris à la première installation
      // (où l'on n'affiche rien) : sinon l'écran surgirait à la mise à jour
      // suivante avec un historique complet sans rapport.
      setLastSeenVersion(version)

      if (toAnnounce.length > 0) {
        setReleases(toAnnounce)
        setMode('after-update')
        setIsOpen(true)
      }
    })

    return () => { cancelled = true }
  }, [])

  // Consultation libre : tout l'historique embarqué.
  const open = useCallback(() => {
    setReleases(RELEASES)
    setMode('browse')
    setIsOpen(true)
  }, [])

  const close = useCallback(() => setIsOpen(false), [])

  return {
    isOpen,
    releases,
    mode,
    currentVersion: currentVersion ?? '',
    open,
    close,
    hasChangelog: RELEASES.length > 0,
  }
}
