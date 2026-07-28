import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  openProject, openProjectAt, saveDraft, loadRecents, rememberRecent,
  forgetRecent, projectNameFromPath, ProjectFormatError,
} from '../utils/fileManager'
import type { RecentProject } from '../utils/fileManager'
import type { Slide } from '../types'
import Dialog from '../components/ui/Dialog'
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

  const goToEditor = () => navigate('/editor')

  // L'éditeur restaure son état depuis le brouillon au montage : y déposer le
  // projet ouvert évite de faire transiter les diapositives par le routeur.
  const openInEditor = (slides: Slide[], filePath: string) => {
    const name = projectNameFromPath(filePath)
    saveDraft(name, filePath, slides)
    rememberRecent(filePath, name)
    goToEditor()
  }

  const handleOpen = async () => {
    try {
      const result = await openProject()
      if (!result) return
      openInEditor(result.slides, result.filePath)
    } catch (err) {
      console.error('[home:open]', err)
      setError(
        err instanceof ProjectFormatError
          ? err.message
          : 'Impossible de lire ce fichier .shma.'
      )
    }
  }

  const handleOpenRecent = async (recent: RecentProject) => {
    try {
      const result = await openProjectAt(recent.filePath)
      openInEditor(result.slides, result.filePath)
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
      <nav className={styles.nav}>
        <span className={styles.logo}>
          Shadowrama<span className={styles.logoDot}>.</span>
        </span>
      </nav>

      <section className={styles.hero}>
        <div>
          <h1 className={styles.title}>
            Des présentations qui <span className={styles.titleAccent}>bougent</span> comme le web.
          </h1>
          <p className={styles.lead}>
            Shadowrama est un éditeur de diaporamas pensé pour le mouvement : blocs animés,
            transitions sur mesure, mise en page libre. Construit comme une page web, pas
            comme un fichier figé.
          </p>
          <div className={styles.ctaRow}>
            <button className={styles.ctaPrimary} onClick={goToEditor}>
              Créer un diaporama
            </button>
            <button className={styles.ctaSecondary} onClick={handleOpen}>
              Ouvrir un projet
            </button>
          </div>

          {recents.length > 0 && (
            <div className={styles.recents}>
              <p className={styles.recentsTitle}>Projets récents</p>
              <ul className={styles.recentsList}>
                {recents.map(recent => (
                  <li key={recent.filePath}>
                    <button
                      className={styles.recentItem}
                      onClick={() => handleOpenRecent(recent)}
                      title={recent.filePath}
                    >
                      <span className={styles.recentName}>{recent.name}</span>
                      <span className={styles.recentDate}>{formatDate(recent.openedAt)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className={styles.mockStage}>
          <div className={`${styles.mockBlock} ${styles.mockShape}`} />
          <div className={`${styles.mockBlock} ${styles.mockImage}`} />
          <div className={`${styles.mockBlock} ${styles.mockText}`} />
          <div className={`${styles.mockBlock} ${styles.mockTextSmall}`} />
        </div>
      </section>

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
