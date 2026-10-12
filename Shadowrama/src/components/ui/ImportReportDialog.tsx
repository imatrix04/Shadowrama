import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ImportReport } from '../../utils/pptx/import'
import { formatSlideRanges, groupImportIssues } from '../../utils/pptx/groupIssues'
import styles from './ImportReportDialog.module.css'

interface Props {
  report: ImportReport
  /** Libellé du bouton principal (« Fermer », « Ouvrir dans l'éditeur »…). */
  actionLabel: string
  /** Bouton principal, Échap et clic sur le fond. */
  onClose: () => void
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/**
 * Bilan d'un import PowerPoint.
 *
 * Même gabarit que la fenêtre « Nouveautés » : un panneau de hauteur bornée dont
 * la liste défile, au lieu d'un message qui s'allonge jusqu'à remplir la fenêtre.
 * Les remarques identiques sont regroupées (voir groupImportIssues).
 */
export default function ImportReportDialog({ report, actionLabel, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const groups = useMemo(() => groupImportIssues(report.issues), [report.issues])

  useEffect(() => {
    // Le focus part dans le panneau : Échap marche sans clic préalable, et les
    // raccourcis de l'éditeur ne s'appliquent plus derrière.
    panelRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // En capture : on intercepte avant les raccourcis globaux de l'éditeur.
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Import PowerPoint terminé"
        className={styles.panel}
        onMouseDown={e => e.stopPropagation()}
      >
        <div className={styles.header}>
          <p className={styles.eyebrow}>Import PowerPoint</p>
          <p className={styles.title}>Import terminé</p>
          <p className={styles.subtitle}>
            {plural(report.slideCount, 'diapositive', 'diapositives')} et{' '}
            {plural(report.blockCount, 'élément', 'éléments')} importés.
          </p>
        </div>

        {groups.length > 0 ? (
          <div className={styles.body} tabIndex={0} aria-label="Points à vérifier">
            <p className={styles.sectionLabel}>
              À vérifier · {plural(groups.length, 'point', 'points')}
            </p>
            <ul className={styles.list}>
              {groups.map(group => (
                <li key={group.message} className={styles.item}>
                  <p className={styles.message}>{group.message}</p>
                  {group.slides.length > 0 && (
                    <p className={styles.slides}>
                      {group.slides.length > 1 ? 'Diapos' : 'Diapo'} {formatSlideRanges(group.slides)}
                      {group.slides.length > 1 && (
                        <span className={styles.count}> · {group.slides.length}</span>
                      )}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className={styles.body}>
            <p className={styles.allGood}>Tout a été converti sans remarque.</p>
          </div>
        )}

        <div className={styles.footer}>
          <button className={styles.btn} onClick={onClose} autoFocus>{actionLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}