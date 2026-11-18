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
import DropdownMenu from '../ui/DropdownMenu'
import type { MenuItem } from '../ui/DropdownMenu'
import PresentationMode from './PresentationMode'
import PptxExport from './PptxExport'
import type { ExportReport } from '../../utils/pptx/export/write'
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

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

/** « 3 diapositives : 12 éléments modifiables, 2 en image. » */
function exportSummary(report: ExportReport): string {
  const parts = [plural(report.editableCount, 'élément modifiable', 'éléments modifiables')]
  if (report.imageCount > 0) parts.push(`${report.imageCount} en image`)
  return `${plural(report.slideCount, 'diapositive', 'diapositives')} : ${parts.join(', ')}.`
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
  const [exporting, setExporting] = useState(false)
  const [exportReport, setExportReport] = useState<ExportReport | null>(null)
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

  // Export PowerPoint : l'emplacement est demandé AVANT de fabriquer le fichier,
  // pour ne pas faire attendre quelqu'un qui annule. Le travail lui-même vit
  // dans PptxExport, qui occupe l'écran le temps des captures.
  const handleExportPptx = async () => {
    if (exporting) return
    // Même précaution que la sauvegarde : un texte en cours de saisie doit
    // d'abord rejoindre les données.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    await new Promise(resolve => setTimeout(resolve, 0))
    try {
      const picked = await window.fileAPI.pickPptxPath(projectNameRef.current ?? 'presentation')
      if (picked) setExporting(true)
    } catch (err) {
      console.error('[export] ERREUR:', err)
      setErrorMessage(`L'export a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
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

  // Menu « Fichier » : les cinq commandes de fichier, au lieu de cinq boutons.
  // Les raccourcis affichés sont uniquement ceux qui existent réellement.
  const fileItems: MenuItem[] = [
    { label: 'Nouveau', icon: 'new', onSelect: handleNew },
    { label: 'Ouvrir…', icon: 'open', onSelect: handleOpen },
    { label: 'Importer un PowerPoint…', icon: 'slides', onSelect: handleImportPptx },
    { label: 'Enregistrer', icon: 'save', shortcut: 'Ctrl+S', onSelect: handleSave, separatorBefore: true },
    { label: 'Exporter en PowerPoint…', icon: 'export', onSelect: handleExportPptx },
  ]

  return (
    <>
      <div className={styles.topBar}>
        <div className={styles.left}>
          <button
            className={styles.logo}
            onClick={() => navigate('/')}
            title="Retour au menu"
            aria-label="Retour au menu"
          >
            Shadowrama
          </button>
          <span className={styles.slash} aria-hidden="true">/</span>
          <span className={styles.projectName} title={projectName ?? undefined}>
            {projectName ?? 'Sans titre'}
          </span>
          {hasUnsavedWork ? (
            <button
              className={styles.status}
              onClick={handleSave}
              title="Enregistrer (Ctrl+S)"
            >
              <span className={styles.dirtyDot} title="Non sauvegardé" />
              Non enregistré
            </button>
          ) : filePath ? (
            <span className={styles.statusSaved}>Enregistré</span>
          ) : null}
          {draftFailed && (
            <span
              className={styles.warning}
              title="La sauvegarde automatique du brouillon a échoué (espace de stockage saturé). Enregistrez votre projet dans un fichier .shma."
            >
              ⚠ Brouillon non sauvegardé
            </span>
          )}

          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.history}>
            <button className={styles.ghost} onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)" aria-label="Annuler (Ctrl+Z)">
              <Icon name="undo" />
            </button>
            <button className={styles.ghost} onClick={onRedo} disabled={!canRedo} title="Rétablir (Ctrl+Y)" aria-label="Rétablir (Ctrl+Y)">
              <Icon name="redo" />
            </button>
          </div>
        </div>

        <div className={styles.actions}>
          <DropdownMenu label="Fichier" items={fileItems} />
          <button
            className={`${styles.btn} ${ultra ? styles.btnUltraOn : styles.btnUltra}`}
            onClick={onToggleUltra}
            aria-pressed={ultra}
            title={ultra ? 'Quitter le mode Ultra Design' : 'Activer le mode Ultra Design : effets et séquences avancées'}
          >
            <Icon name="ultra" /> Ultra Design
          </button>
          <button className={`${styles.btn} ${styles.btnAccent}`} onClick={() => onPresentingChange(true)}>
            <Icon name="play" /> Présenter
          </button>
          <button
            className={styles.ghost}
            onClick={() => navigate('/settings')}
            title="Paramètres"
            aria-label="Paramètres"
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

      {exporting && (
        <PptxExport
          slides={slides}
          numbering={numbering}
          ultra={ultra}
          title={projectName ?? 'Présentation'}
          onDone={report => {
            setExporting(false)
            setExportReport(report)
          }}
          onError={err => {
            console.error('[export] ERREUR:', err)
            setExporting(false)
            setErrorMessage(`L'export a échoué.\n\n${err instanceof Error ? err.message : String(err)}`)
          }}
        />
      )}

      {exportReport && (
        <ImportReportDialog
          report={exportReport}
          eyebrow="Export PowerPoint"
          title="Export terminé"
          summary={exportSummary(exportReport)}
          actionLabel="Fermer"
          onClose={() => setExportReport(null)}
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