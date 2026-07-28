import { useState, useEffect, useRef, useCallback } from 'react'
import type { Slide } from '../../types'
import {
  saveProjectAs, saveProjectToPath, openProject, clearDraft,
  rememberRecent, projectNameFromPath, ProjectFormatError,
} from '../../utils/fileManager'
import { clearMediaStore } from '../../utils/mediaStore'
import Dialog from '../ui/Dialog'
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
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Vrai quand la dernière autosauvegarde a échoué (quota du navigateur). */
  draftFailed: boolean
}

export default function TopBar({
  slides, projectName, setProjectName, filePath, setFilePath, onLoad, onNew,
  onUndo, onRedo, canUndo, canRedo, draftFailed,
}: Props) {
  const [presenting, setPresenting] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameInput, setNameInput] = useState('mon-projet')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [confirmNewOpen, setConfirmNewOpen] = useState(false)
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
      rememberRecent(currentFilePath, projectNameFromPath(currentFilePath))
    } catch (err) {
      console.error('[save] erreur:', err)
      setErrorMessage(`La sauvegarde a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
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
      const name = projectNameFromPath(result.filePath)
      onLoad(result.slides, name)
      setFilePath(result.filePath)
      setSavedSlides(result.slides)
      rememberRecent(result.filePath, name)
    } catch (err) {
      console.error('[open] ERREUR:', err)
      setErrorMessage(
        err instanceof ProjectFormatError
          ? err.message
          : "Impossible de lire ce fichier .shma. Il est peut-être corrompu ou inaccessible."
      )
    }
  }

  const confirmSaveWithName = async () => {
    const name = nameInput.trim()
    if (!name) return
    const currentSlides = slidesRef.current
    try {
      const path = await saveProjectAs(currentSlides, name)
      setNameDialogOpen(false)
      if (!path) return // l'utilisateur a annulé la boîte système
      setProjectName(name)
      setFilePath(path)
      setSavedSlides(currentSlides)
      rememberRecent(path, name)
    } catch (err) {
      console.error('[saveAs] ERREUR:', err)
      setNameDialogOpen(false)
      setErrorMessage(`La sauvegarde a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const startNewProject = () => {
    clearDraft()
    clearMediaStore()
    setSavedSlides(null)
    setFilePath(null)
    setConfirmNewOpen(false)
    onNew()
  }

  const handleNew = () => {
    if (isDirty) setConfirmNewOpen(true)
    else startNewProject()
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
          {draftFailed && (
            <span
              className={styles.warning}
              title="La sauvegarde automatique du brouillon a échoué (espace de stockage saturé). Enregistrez votre projet dans un fichier .shma."
            >
              ⚠ Brouillon non sauvegardé
            </span>
          )}
        </div>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
            ↶
          </button>
          <button className={styles.btn} onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
            ↷
          </button>
          <button className={styles.btn} onClick={handleNew}>
            🆕 Nouveau
          </button>
          <button className={styles.btn} onClick={handleSave} title="Sauvegarder (Ctrl+S)">
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
        <Dialog
          title="Nom du projet"
          inputValue={nameInput}
          onInputChange={setNameInput}
          onSubmit={confirmSaveWithName}
          onDismiss={() => setNameDialogOpen(false)}
          actions={[
            { label: 'Annuler', onClick: () => setNameDialogOpen(false) },
            { label: 'Sauvegarder', onClick: confirmSaveWithName, variant: 'accent' },
          ]}
        />
      )}

      {confirmNewOpen && (
        <Dialog
          title="Modifications non sauvegardées"
          message="Les modifications en cours seront perdues. Créer un nouveau projet malgré tout ?"
          onDismiss={() => setConfirmNewOpen(false)}
          actions={[
            { label: 'Annuler', onClick: () => setConfirmNewOpen(false) },
            { label: 'Continuer', onClick: startNewProject, variant: 'danger' },
          ]}
        />
      )}

      {errorMessage && (
        <Dialog
          title="Erreur"
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          actions={[{ label: 'Fermer', onClick: () => setErrorMessage(null), variant: 'accent' }]}
        />
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
