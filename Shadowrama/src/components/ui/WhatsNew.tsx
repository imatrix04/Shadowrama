import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Release } from '../../utils/changelog'
import { hasUltraContent } from '../../utils/changelog'
import Icon from './Icon'
import styles from './WhatsNew.module.css'

const SECTIONS: { key: 'added' | 'changed' | 'fixed'; label: string }[] = [
  { key: 'added', label: 'Nouveautés' },
  { key: 'changed', label: 'Améliorations' },
  { key: 'fixed', label: 'Corrections' },
]

interface Props {
  releases: Release[]
  /** Titre adapté au contexte : après une mise à jour, ou consultation libre. */
  mode: 'after-update' | 'browse'
  currentVersion: string
  onClose: () => void
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function ReleaseSection({ release, showVersion }: { release: Release; showVersion: boolean }) {
  return (
    <div className={styles.release}>
      {showVersion && (
        <div className={styles.releaseHead}>
          <span className={styles.version}>Version {release.version}</span>
          <span className={styles.date}>{formatDate(release.date)}</span>
          {hasUltraContent(release) && (
            <span className={styles.releaseUltraTag}>
              <Icon name="ultra" size={10} /> Ultra
            </span>
          )}
        </div>
      )}

      {release.highlights?.map(highlight => (
        <div
          key={highlight.title}
          className={highlight.ultra ? styles.highlightUltra : styles.highlight}
        >
          {highlight.ultra && (
            <span className={styles.ultraBadge}>
              <Icon name="ultra" size={10} /> Ultra Design
            </span>
          )}
          <p className={styles.highlightTitle}>{highlight.title}</p>
          <p className={styles.highlightBody}>{highlight.body}</p>
        </div>
      ))}

      {SECTIONS.map(({ key, label }) => {
        const items = release[key]
        if (!items?.length) return null
        return (
          <div key={key}>
            <p className={styles.sectionLabel}>{label}</p>
            <ul className={styles.list}>
              {items.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )
      })}

      {!release.highlights?.length
        && !release.added?.length && !release.changed?.length && !release.fixed?.length
        && release.summary && <p className={styles.highlightBody}>{release.summary}</p>}
    </div>
  )
}

export default function WhatsNew({ releases, mode, currentVersion, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [updateState, setUpdateState] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    panelRef.current?.focus()
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  const checkUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setUpdateState("Disponible uniquement dans l'application de bureau.")
      return
    }
    setChecking(true)
    setUpdateState(null)
    try {
      const result = await window.electronAPI.checkForUpdates()
      if (result.status === 'available') setUpdateState(`Version ${result.version} disponible.`)
      else if (result.status === 'up-to-date') setUpdateState('Vous êtes à jour.')
      else if (result.status === 'dev') setUpdateState('Vérification indisponible en développement.')
      else setUpdateState(`Échec de la vérification : ${result.message}`)
    } finally {
      setChecking(false)
    }
  }

  const isAfterUpdate = mode === 'after-update'
  const multiple = releases.length > 1

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Nouveautés"
        className={styles.panel}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <p className={styles.eyebrow}>{isAfterUpdate ? 'Mise à jour installée' : 'Historique'}</p>
          <h2 className={styles.title}>
            {isAfterUpdate ? `Shadowrama ${currentVersion}` : 'Nouveautés'}
          </h2>
          <p className={styles.subtitle}>
            {isAfterUpdate
              ? multiple
                ? `Voici ce qui a changé depuis votre dernière utilisation (${releases.length} versions).`
                : 'Voici ce qui a changé.'
              : `Version installée : ${currentVersion}.`}
          </p>
        </div>

        <div className={styles.body}>
          {releases.map(release => (
            <ReleaseSection
              key={release.version}
              release={release}
              // En mode « après mise à jour » sur une seule version, le numéro
              // est déjà dans le titre : le répéter n'apporte rien.
              showVersion={!isAfterUpdate || multiple}
            />
          ))}
        </div>

        <div className={styles.footer}>
          {updateState && <span className={styles.updateState}>{updateState}</span>}
          <div className={styles.footerActions}>
            {!isAfterUpdate && (
              <button className={styles.btn} onClick={checkUpdates} disabled={checking}>
                {checking ? 'Vérification…' : 'Rechercher les mises à jour'}
              </button>
            )}
            <button className={`${styles.btn} ${styles.btnAccent}`} onClick={onClose}>
              {isAfterUpdate ? "C'est parti" : 'Fermer'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
