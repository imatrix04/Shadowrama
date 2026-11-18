import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  openProject, openProjectAt, importPowerPoint, saveDraft, loadRecents, rememberRecent,
  forgetRecent, projectNameFromPath, ProjectFormatError,
} from '../utils/fileManager'
import type { OpenedProject, RecentProject } from '../utils/fileManager'
import type { ImportReport } from '../utils/pptx/import'
import Dialog from '../components/ui/Dialog'
import ImportReportDialog from '../components/ui/ImportReportDialog'
import WhatsNew from '../components/ui/WhatsNew'
import { useWhatsNew } from '../hooks/useWhatsNew'
import { useUltraMode } from '../hooks/useUltraMode'
import Icon from '../components/ui/Icon'
import styles from './Home.module.css'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function Home() {
  const navigate = useNavigate()
  // Lecture synchrone du localStorage : un initialiseur paresseux suffit,
  // inutile de passer par un effet et un rendu supplémentaire.
  const [recents, setRecents] = useState<RecentProject[]>(loadRecents)
  const [error, setError] = useState<string | null>(null)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const whatsNew = useWhatsNew()
  const { enableUltra } = useUltraMode()

  const goToEditor = () => navigate('/editor')

  // L'éditeur restaure son état depuis le brouillon au montage : y déposer le
  // projet ouvert évite de faire transiter les diapositives par le routeur.
  const openInEditor = async ({ slides, numbering, filePath }: OpenedProject) => {
    const name = projectNameFromPath(filePath)
    // Le projet transite par le brouillon, que l'éditeur relit au montage. Si
    // l'écriture échoue, l'éditeur rouvrirait l'ANCIEN brouillon : l'utilisateur
    // croirait éditer le fichier qu'il vient d'ouvrir et écraserait son travail
    // à la première sauvegarde. Mieux vaut refuser bruyamment.
    if (!await saveDraft(name, filePath, slides, numbering)) {
      setError(
        "Impossible de préparer ce projet : le stockage local de l'application "
        + "est inaccessible ou saturé. Fermez puis rouvrez l'application, et "
        + 'réessayez.'
      )
      return
    }
    rememberRecent(filePath, name)
    goToEditor()
  }

  const handleOpen = async () => {
    try {
      const result = await openProject()
      if (!result) return
      await openInEditor(result)
    } catch (err) {
      console.error('[home:open]', err)
      setError(
        err instanceof ProjectFormatError
          ? err.message
          : 'Impossible de lire ce fichier .shma.'
      )
    }
  }

  const handleImportPptx = async () => {
    try {
      const result = await importPowerPoint()
      if (!result) return
      // Même passage par le brouillon que pour un projet ouvert, sans fichier.
      if (!await saveDraft(result.name, null, result.slides, result.numbering)) {
        setError(
          "Impossible de préparer ce projet : le stockage local de l'application "
          + "est inaccessible ou saturé. Fermez puis rouvrez l'application, et "
          + 'réessayez.'
        )
        return
      }
      setImportReport(result.report)
    } catch (err) {
      console.error('[home:import]', err)
      setError(
        err instanceof ProjectFormatError
          ? err.message
          : "Impossible d'importer ce fichier PowerPoint."
      )
    }
  }

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      const result = await openProjectAt(recent.filePath)
      await openInEditor(result)
    } catch (err) {
      console.error('[home:recent]', err)
      // Fichier déplacé, renommé ou supprimé : on retire l'entrée obsolète
      // plutôt que de laisser un raccourci mort dans la liste.
      forgetRecent(recent.filePath)
      setRecents(loadRecents())
      setError(
        err instanceof ProjectFormatError
          ? err.message
          : `« ${recent.name} » est introuvable ou illisible. Il a été retiré de la liste.`
      )
    }
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <span className={styles.logo}>
          Shadowrama<span className={styles.logoDot}>.</span>
        </span>

        <nav className={styles.sideGroup} aria-label="Actions">
          <button className={`${styles.sideItem} ${styles.sideItemActive}`} onClick={goToEditor}>
            <Icon name="new" size={16} /> Nouveau diaporama
          </button>
          <button className={styles.sideItem} onClick={handleOpen}>
            <Icon name="open" size={16} /> Ouvrir un projet
          </button>
          <button className={styles.sideItem} onClick={handleImportPptx}>
            <Icon name="slides" size={16} /> Importer PowerPoint
          </button>
        </nav>

        <nav className={`${styles.sideGroup} ${styles.sideGroupBottom}`} aria-label="Application">
          {whatsNew.hasChangelog && (
            <button className={styles.sideItem} onClick={whatsNew.open}>
              <Icon name="effects" size={16} /> Nouveautés
              {whatsNew.currentVersion && (
                <span className={styles.sideBadge}>v{whatsNew.currentVersion}</span>
              )}
            </button>
          )}
          <button className={styles.sideItem} onClick={() => navigate('/settings')}>
            <Icon name="settings" size={16} /> Paramètres
          </button>
        </nav>
      </aside>

      <main className={styles.main}>
        <h1 className={styles.heading}>Accueil</h1>

        <section className={`${styles.section} ${styles.fade}`}>
          <h2 className={styles.sectionTitle}>Démarrer</h2>
          <div className={styles.startGrid}>
            <button className={styles.startCard} onClick={goToEditor}>
              <div className={styles.startThumb}>
                <div className={styles.thumbSlide} />
                <Icon name="new" size={22} className={styles.thumbIcon} />
              </div>
              <div className={styles.startText}>
                <strong>Diaporama vide</strong>
                <span>Une page blanche pour composer librement.</span>
              </div>
            </button>

            {/* Le mode Ultra est une surcouche de l'éditeur : on l'active puis
                on ouvre l'éditeur. */}
            <button
              className={styles.startCard}
              onClick={() => { enableUltra(); goToEditor() }}
            >
              <div className={`${styles.startThumb} ${styles.thumbUltra}`}>
                <Icon name="ultra" size={26} className={styles.thumbIcon} />
              </div>
              <div className={styles.startText}>
                <strong>Mode Ultra Design</strong>
                <span>Effets avancés et séquences d'animation.</span>
              </div>
            </button>

            <button className={styles.startCard} onClick={handleImportPptx}>
              <div className={styles.startThumb}>
                <div className={styles.thumbSlide} />
                <Icon name="slides" size={22} className={styles.thumbIcon} />
              </div>
              <div className={styles.startText}>
                <strong>Importer PowerPoint</strong>
                <span>Reprendre une présentation .pptx existante.</span>
              </div>
            </button>
          </div>
        </section>

        <section className={`${styles.section} ${styles.fade2}`}>
          <h2 className={styles.sectionTitle}>Projets récents</h2>
          {recents.length > 0 ? (
            <ul className={styles.recentsList}>
              {recents.map(recent => (
                <li key={recent.filePath}>
                  <button
                    className={styles.recentRow}
                    onClick={() => handleOpenRecent(recent)}
                    title={recent.filePath}
                  >
                    <Icon name="slides" size={18} className={styles.recentIcon} />
                    <span className={styles.recentInfo}>
                      <span className={styles.recentName}>{recent.name}</span>
                      <span className={styles.recentPath}>{recent.filePath}</span>
                    </span>
                    <span className={styles.recentDate}>{formatDate(recent.openedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.empty}>
              <strong>Aucun projet récent</strong>
              <span>
                Créez un diaporama ou{' '}
                <button className={styles.emptyLink} onClick={handleOpen}>
                  ouvrez un fichier .shma
                </button>.
              </span>
            </div>
          )}
        </section>
      </main>

      {whatsNew.isOpen && (
        <WhatsNew
          releases={whatsNew.releases}
          mode={whatsNew.mode}
          currentVersion={whatsNew.currentVersion}
          onClose={whatsNew.close}
        />
      )}

      {importReport && (
        <ImportReportDialog
          report={importReport}
          actionLabel="Ouvrir dans l'éditeur"
          onClose={goToEditor}
        />
      )}

      {error && (
        <Dialog
          title="Ouverture impossible"
          message={error}
          onDismiss={() => setError(null)}
          actions={[{ label: 'Fermer', onClick: () => setError(null), variant: 'accent' }]}
        />
      )}
    </div>
  )
}