import { useState, useEffect, useRef } from 'react'
import type { Slide } from '../../types'
import { saveProjectAs, saveProjectToPath, openProject, clearDraft } from '../../utils/fileManager'
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

  useEffect(() => {
    const current = JSON.stringify(slides)
    setIsDirty(lastSavedRef.current !== current)
  }, [slides])

  const handleSave = async () => {
    if (filePath) {
      await saveProjectToPath(slides, filePath)
      lastSavedRef.current = JSON.stringify(slides)
      setIsDirty(false)
    } else {
      setNameInput(projectName ?? 'mon-projet')
      setNameDialogOpen(true)
    }
  }

  const handleOpen = async () => {
    try {
      const result = await openProject()
      if (!result) return
      const name = result.filePath.split(/[\\/]/).pop()!.replace('.shma', '')
      onLoad(result.slides, name)
      setFilePath(result.filePath)
      lastSavedRef.current = JSON.stringify(result.slides)
      setIsDirty(false)
    } catch {
      alert('Impossible de lire ce fichier .shma')
    }
  }

  const confirmSaveWithName = async () => {
    const name = nameInput.trim()
    if (!name) return
    const path = await saveProjectAs(slides, name)
    if (!path) {
      setNameDialogOpen(false)
      return
    }
    setProjectName(name)
    setFilePath(path)
    lastSavedRef.current = JSON.stringify(slides)
    setIsDirty(false)
    setNameDialogOpen(false)
  }

  const handleNew = () => {
    const proceed = isDirty
      ? confirm('Des modifications non sauvegardées seront perdues. Continuer ?')
      : true
    if (!proceed) return
    clearDraft()
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