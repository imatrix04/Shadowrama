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
  const [isDirty, setIsDirty] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameInput, setNameInput] = useState('mon-projet')
  const lastSavedRef = useRef<string | null>(filePath ? JSON.stringify(slides) : null)

  // Refs synchronisées à chaque render — handleSave lit depuis ces refs (jamais stale)
  const slidesRef = useRef(slides)
  slidesRef.current = slides
  const filePathRef = useRef(filePath)
  filePathRef.current = filePath
  const projectNameRef = useRef(projectName)
  projectNameRef.current = projectName

  useEffect(() => {
    const current = JSON.stringify(slides)
    setIsDirty(lastSavedRef.current !== current)
  }, [slides])

  // Dépendances [] : handleSave est créé une seule fois et lit tout depuis les refs.
  // Le listener Ctrl+S n'est donc jamais périmé.
  const handleSave = useCallback(async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    // Laisse React traiter les setState en attente avant de lire les refs
    await new Promise(resolve => setTimeout(resolve, 0))

    const currentSlides = slidesRef.current
    const currentFilePath = filePathRef.current
    const currentProjectName = projectNameRef.current

    if (currentFilePath) {
      try {
        await saveProjectToPath(currentSlides, currentFilePath)
        lastSavedRef.current = JSON.stringify(currentSlides)
        setIsDirty(false)
      } catch (err) {
        console.error('[save] erreur:', err)
        alert(`Erreur lors de la sauvegarde :\n${err}`)
      }
    } else {
      setNameInput(currentProjectName ?? 'mon-projet')
      setNameDialogOpen(true)
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
      lastSavedRef.current = JSON.stringify(result.slides)
      setIsDirty(false)
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
      lastSavedRef.current = JSON.stringify(currentSlides)
      setIsDirty(false)
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
    lastSavedRef.current = null
    setFilePath(null)
    setIsDirty(false)
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