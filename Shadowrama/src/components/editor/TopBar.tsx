import { useState, useEffect, useRef, useCallback } from 'react'
import type { Slide } from '../../types'
import { saveProjectAs, saveProjectToPath, openProject, clearDraft } from '../../utils/fileManager'
import { clearMediaStore } from '../../utils/mediaStore'
import PresentationMode from './PresentationMode'
import styles from './TopBar.module.css'

interface Props {
  slides: Slide[]
  projectName: string | null
  setProjectName: (name: string) => void
  filePath: string | null
  setFilePath: (path: string | null) => void
  onLoad: (slides: Slide[], name: string) => void
  onNew: () => void
}

export default function TopBar({ slides, projectName, setProjectName, filePath, setFilePath, onLoad, onNew }: Props) {
  const [presenting, setPresenting] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameInput, setNameInput] = useState('mon-projet')
  // Dernier état sauvegardé, comparé par référence : les diapos étant
  // immuables, une simple égalité de référence remplace le JSON.stringify de
  // toutes les diapos à chaque frappe. Bonus : un Ctrl+Z ramenant à l'état
  // sauvegardé restaure la même référence, donc le projet redevient « propre ».
  const [savedSlides, setSavedSlides] = useState<Slide[] | null>(filePath ? slides : null)
  const isDirty = savedSlides !== slides

  // handleSave est stable ([] en dépendances) et lit tout depuis ces refs, mises
  // à jour après chaque rendu — le raccourci Ctrl+S n'est donc jamais périmé.
  const slidesRef = useRef(slides)
  const filePathRef = useRef(filePath)
  const projectNameRef = useRef(projectName)
  useEffect(() => {
    slidesRef.current = slides
    filePathRef.current = filePath
    projectNameRef.current = projectName
  })

  const handleSave = useCallback(async () => {
    // Un bloc de texte en cours d'édition n'a pas encore propagé son contenu :
    // on le fait perdre le focus, puis on laisse React appliquer les mises à
    // jour en attente avant de lire les refs.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    await new Promise(resolve => setTimeout(resolve, 0))

    const currentSlides = slidesRef.current
    const currentFilePath = filePathRef.current

    if (!currentFilePath) {
      setNameInput(projectNameRef.current ?? 'mon-projet')
      setNameDialogOpen(true)
      return
    }

    try {
      await saveProjectToPath(currentSlides, currentFilePath)
      setSavedSlides(currentSlides)
    } catch (err) {
      console.error('[save] erreur:', err)
      alert(`Erreur lors de la sauvegarde :\n${err}`)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  const handleOpen = async () => {
    try {
      const result = await openProject()
      if (!result) return
      const name = result.filePath.split(/[\\/]/).pop()!.replace('.shma', '')
      onLoad(result.slides, name)
      setFilePath(result.filePath)
      setSavedSlides(result.slides)
    } catch (err) {
      console.error('[open] ERREUR:', err)
      alert('Impossible de lire ce fichier .shma')
    }
  }

  const confirmSaveWithName = async () => {
    const name = nameInput.trim()
    if (!name) return
    const currentSlides = slidesRef.current
    try {
      const path = await saveProjectAs(currentSlides, name)
      if (!path) {
        setNameDialogOpen(false)
        return
      }
      setProjectName(name)
      setFilePath(path)
      setSavedSlides(currentSlides)
      setNameDialogOpen(false)
    } catch (err) {
      console.error('[saveAs] ERREUR:', err)
      alert(`Erreur lors de la sauvegarde : ${err}`)
    }
  }

  const handleNew = () => {
    const proceed = isDirty
      ? confirm('Des modifications non sauvegardées seront perdues. Continuer ?')
      : true
    if (!proceed) return
    clearDraft()
    clearMediaStore()
    setSavedSlides(null)
    setFilePath(null)
    onNew()
  }

  return (
    <>
      <div className={styles.topBar}>
        <div className={styles.left}>
          <span className={styles.logo}>Shadowrama</span>
          {projectName && (
            <span className={styles.projectName}>
              {projectName}
              {isDirty && <span className={styles.dirtyDot} title="Non sauvegardé"> ●</span>}
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleNew}>
            🆕 Nouveau
          </button>
          <button className={styles.btn} onClick={handleSave}>
            💾 Sauvegarder
          </button>
          <button className={styles.btn} onClick={handleOpen}>
            📂 Ouvrir
          </button>
          <button className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => setPresenting(true)}>
            ▶ Présenter
          </button>
        </div>
      </div>

      {nameDialogOpen && (
        <div className={styles.overlay} onClick={() => setNameDialogOpen(false)}>
          <div className={styles.dialog} onClick={e => e.stopPropagation()}>
            <p className={styles.dialogTitle}>Nom du projet</p>
            <input
              autoFocus
              className={styles.dialogInput}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmSaveWithName()
                if (e.key === 'Escape') setNameDialogOpen(false)
              }}
            />
            <div className={styles.dialogActions}>
              <button className={styles.btn} onClick={() => setNameDialogOpen(false)}>Annuler</button>
              <button className={`${styles.btn} ${styles.btnAccent}`} onClick={confirmSaveWithName}>
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {presenting && (
        <PresentationMode
          slides={slides}
          onClose={() => setPresenting(false)}
        />
      )}
    </>
  )
}
