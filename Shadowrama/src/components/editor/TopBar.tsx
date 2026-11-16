import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Slide, SlideNumbering } from '../../types'
import {
  saveProjectAs, saveProjectToPath, openProject, importPowerPoint, clearDraft,
  rememberRecent, projectNameFromPath, ProjectFormatError,
} from '../../utils/fileManager'
import { clearMediaStore } from '../../utils/mediaStore'
import type { ImportReport } from '../../utils/pptx/import'
import ImportReportDialog from '../ui/ImportReportDialog'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import PresentationMode from './PresentationMode'
import styles from './TopBar.module.css'

interface Props {
  slides: Slide[]
  numbering: SlideNumbering
  projectName: string | null
  setProjectName: (name: string) => void
  filePath: string | null
  setFilePath: (path: string | null) => void
  onLoad: (slides: Slide[], name: string, numbering: SlideNumbering) => void
  onNew: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Vrai quand la dernière autosauvegarde a échoué (quota du navigateur). */
  draftFailed: boolean
  /**
   * Vrai quand le brouillon restauré contient des modifications jamais écrites
   * dans le `.shma`. Sans ça, un projet rattaché à un fichier était toujours
   * présenté comme enregistré après un redémarrage.
   */
  initialDirty: boolean
  /** Prévient l'éditeur, qui recopie l'information dans le brouillon. */
  onDirtyChange: (dirty: boolean) => void
  ultra: boolean
  onToggleUltra: () => void
  presenting: boolean
  onPresentingChange: (value: boolean) => void
}

type ReplaceAction = 'new' | 'open' | 'import'

const REPLACE_MESSAGES: Record<ReplaceAction, string> = {
  new: 'Les modifications en cours seront perdues. Créer un nouveau projet malgré tout ?',
  open: 'Les modifications en cours seront perdues. Ouvrir un autre projet malgré tout ?',
  import: 'Les modifications en cours seront perdues. Importer un PowerPoint malgré tout ?',
}

/** Une seule diapositive, sans bloc ni réglage : rien qui vaille d'être gardé. */
function isBlankProject(slides: Slide[]): boolean {
  if (slides.length !== 1) return false
  const [slide] = slides
  return slide.blocks.length === 0 && !slide.background && !slide.transition
}

export default function TopBar({
  slides, numbering, projectName, setProjectName, filePath, setFilePath, onLoad, onNew,
  onUndo, onRedo, canUndo, canRedo, draftFailed, initialDirty, onDirtyChange, ultra, onToggleUltra,
  presenting, onPresentingChange,
}: Props) {
  const navigate = useNavigate()
  const [nameDialogOpen, setNameDialogOpen] = useState(false)
  const [nameInput, setNameInput] = useState('mon-projet')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // Action en attente de confirmation : toutes remplacent le projet en cours.
  const [pendingReplace, setPendingReplace] = useState<ReplaceAction | null>(null)
  const [importReport, setImportReport] = useState<ImportReport | null>(null)
  const startsSaved = filePath !== null && !initialDirty
  const [savedSlides, setSavedSlides] = useState<Slide[] | null>(startsSaved ? slides : null)
  const [savedNumbering, setSavedNumbering] = useState<SlideNumbering | null>(startsSaved ? numbering : null)
  const isDirty = savedSlides !== slides || savedNumbering !== numbering
  // Un projet vierge jamais enregistré est « modifié » au sens strict, mais il
  // n'y a rien à perdre : inutile de demander une confirmation pour le quitter.
  const hasUnsavedWork = isDirty && !(filePath === null && isBlankProject(slides))
  // Une seule sauvegarde à la fois : deux Ctrl+S rapprochés lançaient deux
  // écritures concurrentes du même fichier.
  const savingRef = useRef(false)

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])
  const slidesRef = useRef(slides)
  const numberingRef = useRef(numbering)
  const filePathRef = useRef(filePath)
  const projectNameRef = useRef(projectName)
  useEffect(() => {
    slidesRef.current = slides
    numberingRef.current = numbering
    filePathRef.current = filePath
    projectNameRef.current = projectName
  })

  const handleSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    try {
      // Un bloc de texte en cours d'édition n'a pas encore propagé son contenu :
      // on le fait perdre le focus, puis on laisse React appliquer les mises à
      // jour en attente avant de lire les refs.
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur()
      }
      await new Promise(resolve => setTimeout(resolve, 0))

      const currentSlides = slidesRef.current
      const currentNumbering = numberingRef.current
      const currentFilePath = filePathRef.current

      if (!currentFilePath) {
        setNameInput(projectNameRef.current ?? 'mon-projet')
        setNameDialogOpen(true)
        return
      }

      try {
        await saveProjectToPath(currentSlides, currentFilePath, currentNumbering)
        setSavedSlides(currentSlides)
        setSavedNumbering(currentNumbering)
        rememberRecent(currentFilePath, projectNameFromPath(currentFilePath))
      } catch (err) {
        console.error('[save] erreur:', err)
        setErrorMessage(`La sauvegarde a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      savingRef.current = false
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

  const openAnotherProject = async () => {
    try {
      const result = await openProject()
      if (!result) return
      const name = projectNameFromPath(result.filePath)
      onLoad(result.slides, name, result.numbering)
      setFilePath(result.filePath)
      setSavedSlides(result.slides)
      setSavedNumbering(result.numbering)
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

  const importAnotherProject = async () => {
    try {
      const result = await importPowerPoint()
      if (!result) return
      onLoad(result.slides, result.name, result.numbering)
      // Un import n'a pas de fichier .shma : le projet reste à enregistrer.
      setFilePath(null)
      setSavedSlides(null)
      setSavedNumbering(null)
      setImportReport(result.report)
    } catch (err) {
      console.error('[import] ERREUR:', err)
      setErrorMessage(
        err instanceof ProjectFormatError
          ? err.message
          : "Impossible d'importer ce fichier PowerPoint. Il est peut-être corrompu ou inaccessible."
      )
    }
  }

  const confirmSaveWithName = async () => {
    const name = nameInput.trim()
    if (!name || savingRef.current) return
    savingRef.current = true
    const currentSlides = slidesRef.current
    const currentNumbering = numberingRef.current
    try {
      const path = await saveProjectAs(currentSlides, name, currentNumbering)
      setNameDialogOpen(false)
      if (!path) return // l'utilisateur a annulé la boîte système
      setProjectName(name)
      setFilePath(path)
      setSavedSlides(currentSlides)
      setSavedNumbering(currentNumbering)
      rememberRecent(path, name)
    } catch (err) {
      console.error('[saveAs] ERREUR:', err)
      setNameDialogOpen(false)
      setErrorMessage(`La sauvegarde a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
    } finally {
      savingRef.current = false
    }
  }

  const startNewProject = () => {
    clearDraft()
    clearMediaStore()
    setSavedSlides(null)
    setSavedNumbering(null)
    setFilePath(null)
    onNew()
  }

  const runReplace = (action: ReplaceAction) => {
    setPendingReplace(null)
    if (action === 'new') startNewProject()
    else if (action === 'open') void openAnotherProject()
    else void importAnotherProject()
  }

  // Nouveau, Ouvrir et Importer remplacent tous le projet en cours — et ses
  // médias, ce qu'aucun Ctrl+Z ne rattrape. Seul « Nouveau » demandait une
  // confirmation : ouvrir un fichier par-dessus un travail non enregistré le
  // faisait disparaître sans un mot.
  const requestReplace = (action: ReplaceAction) => {
    if (hasUnsavedWork) setPendingReplace(action)
    else runReplace(action)
  }

  const handleNew = () => requestReplace('new')
  const handleOpen = () => requestReplace('open')
  const handleImportPptx = () => requestReplace('import')

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
            <Icon name="undo" />
          </button>
          <button className={styles.btn} onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
            <Icon name="redo" />
          </button>
          <button className={styles.btn} onClick={handleNew}>
            <Icon name="new" /> Nouveau
          </button>
          <button className={styles.btn} onClick={handleSave} title="Sauvegarder (Ctrl+S)">
            <Icon name="save" /> Sauvegarder
          </button>
          <button className={styles.btn} onClick={handleOpen}>
            <Icon name="open" /> Ouvrir
          </button>
          <button
            className={styles.btn}
            onClick={handleImportPptx}
            title="Importer un diaporama PowerPoint (.pptx)"
          >
            <Icon name="open" /> Importer
          </button>
          <button
            className={`${styles.btn} ${ultra ? styles.btnUltraOn : styles.btnUltra}`}
            onClick={onToggleUltra}
            title={ultra ? 'Quitter le mode Ultra Design' : 'Activer le mode Ultra Design : effets et séquences avancées'}
          >
            <Icon name="ultra" /> Ultra Design
          </button>
          <button className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => onPresentingChange(true)}>
            <Icon name="play" /> Présenter
          </button>
          <button
            className={styles.btn}
            onClick={() => navigate('/settings')}
            title="Paramètres"
          >
            <Icon name="settings" />
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

      {pendingReplace && (
        <Dialog
          title="Modifications non sauvegardées"
          message={REPLACE_MESSAGES[pendingReplace]}
          onDismiss={() => setPendingReplace(null)}
          actions={[
            { label: 'Annuler', onClick: () => setPendingReplace(null) },
            { label: 'Continuer', onClick: () => runReplace(pendingReplace), variant: 'danger' },
          ]}
        />
      )}

      {importReport && (
        <ImportReportDialog
          report={importReport}
          actionLabel="Fermer"
          onClose={() => setImportReport(null)}
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
          numbering={numbering}
          onClose={() => onPresentingChange(false)}
          ultra={ultra}
        />
      )}
    </>
  )
}