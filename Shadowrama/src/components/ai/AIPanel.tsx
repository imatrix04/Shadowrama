import { useLayoutEffect, useRef, useState } from 'react'
import { EFFORT_LEVELS, PROVIDER_ORGS } from '../../ai/types'
import type { Effort } from '../../ai/types'
import type { Attachment, Usage } from '../../ai/types'
import { useAISettings } from '../../ai/useAISettings'
import type { ChatItem } from '../../ai/useAIAssistant'
import Icon from '../ui/Icon'
import Select from '../ui/Select'
import AISetup from './AISetup'
import styles from './AIPanel.module.css'

const HEX_COLOR = /(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z]))/g

/** Texte avec un petit carré de couleur à droite de chaque code hexadécimal. */
function withSwatches(text: string, keyPrefix: string) {
  return text.split(HEX_COLOR).map((part, i) =>
    i % 2 === 1 ? (
      <span key={`${keyPrefix}${i}`} className={styles.colorCode}>
        {part}
        <span className={styles.swatch} style={{ background: part }} aria-hidden="true" />
      </span>
    ) : part,
  )
}

/**
 * Met en gras les passages entre ** ** et affiche un échantillon à côté des
 * couleurs #hex. Rendu en nœuds React (jamais en HTML) : le texte vient du
 * modèle. Un ** sans fermeture (flux en cours) reste littéral.
 */
function renderInline(text: string) {
  return text.split(/(\*\*[^*\n]+?\*\*)/g).map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className={styles.bold}>{withSwatches(part.slice(2, -2), `b${i}-`)}</strong>
      : withSwatches(part, `t${i}-`),
  )
}

interface Props {
  items: ChatItem[]
  running: boolean
  usage: Usage
  attachments: Attachment[]
  attachError: string | null
  /** Texte en cours de frappe, conservé par l'appelant (survit à la navigation). */
  draft: string
  onDraftChange: (value: string) => void
  onAttach: (files: File[]) => void
  onRemoveAttachment: (id: number) => void
  onSend: (text: string, provider: 'anthropic' | 'openai') => void
  onStop: () => void
  onClear: () => void
  onClose: () => void
  /** Panneau déployé : sert à replacer la liste en bas à chaque ouverture. */
  open: boolean
}

const SUGGESTIONS = [
  'Crée une présentation de 5 diapositives sur ',
  'Améliore et raccourcis les textes de cette diapositive',
  'Ajoute une animation d’entrée douce à chaque bloc',
  'Harmonise les couleurs et les polices de tout le diaporama',
]

const formatTokens = (n: number) => n.toLocaleString('fr-FR')

export default function AIPanel({
  items, running, usage, attachments, attachError, draft, onDraftChange, onAttach, onRemoveAttachment, onSend, onStop, onClear, onClose, open }: Props) {
  const { available, settings, error, save, setKey, clearKey } = useAISettings()
  const [editingSetup, setEditingSetup] = useState(false)
  const setDraft = onDraftChange
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const provider = settings?.provider
  const ready = !!settings && !!provider && settings.hasKey[provider] && settings.consent[provider]

  // Garde le dernier message visible, y compris à l'ouverture du panneau et au
  // chargement des réglages (la liste n'existe qu'une fois `ready`). Layout
  // effect : le défilement se fait avant l'affichage, sans passer par le haut.
  useLayoutEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [items, running, ready, editingSetup, open])

  const submit = () => {
    if (!provider || !draft.trim() || running) return
    onSend(draft, provider)
    setDraft('')
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  const body = () => {
    if (!available) {
      return <p className={styles.notice}>L'assistant IA est disponible dans l'application de bureau Shadowrama.</p>
    }
    if (!settings) return <p className={styles.notice}>{error ?? 'Chargement…'}</p>
    if (!ready || editingSetup) {
      return (
        <div className={styles.setup}>
          <p className={styles.intro}>
            Connectez votre propre compte d'IA pour que l'assistant puisse créer et modifier vos diapositives.
          </p>
          <AISetup
            settings={settings}
            error={error}
            onSave={save}
            onSetKey={setKey}
            onClearKey={clearKey}
            onDone={() => setEditingSetup(false)}
          />
        </div>
      )
    }
    return (
      <>
        <div className={styles.list} ref={listRef} aria-live="polite">
          {items.length === 0 && (
            <div className={styles.empty}>
              <p>Décrivez ce que vous voulez : l'assistant lit votre diaporama, puis agit directement dessus.</p>
              <div className={styles.suggestions}>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    className={styles.chip}
                    onClick={() => { setDraft(s); inputRef.current?.focus() }}
                  >
                    {s.trim()}
                  </button>
                ))}
              </div>
            </div>
          )}
          {items.map(item => (
            <div key={item.id} className={`${styles.item} ${styles[item.kind]} ${item.isError ? styles.itemError : ''} ${item.streaming ? styles.streaming : ''}`}>
              {item.kind === 'action' && <Icon name={item.isError ? 'close' : 'sparkles'} size={12} />}
              <span>{renderInline(item.text)}</span>
            </div>
          ))}
          {running && !items[items.length - 1]?.streaming && <div className={styles.working}><span className={styles.dots} /> L'assistant travaille…</div>}
        </div>

        <div
          className={`${styles.composer} ${dragging ? styles.composerDrag : ''}`}
          onDragOver={e => {
            if (!e.dataTransfer.types.includes('Files')) return
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            setDragging(false)
            if (e.dataTransfer.files.length === 0) return
            // Le dépôt ne doit pas atteindre l'éditeur (ouverture de projet, etc.).
            e.preventDefault()
            e.stopPropagation()
            onAttach(Array.from(e.dataTransfer.files))
          }}
        >
          {(attachments.length > 0 || attachError) && (
            <div className={styles.attachments}>
              {attachments.map(a => (
                <span
                  key={a.id}
                  className={styles.attachment}
                  title={`Pièce jointe n°${a.id} — seuls son nom et ses dimensions sont transmis à l'IA, jamais son contenu.`}
                >
                  <Icon name={a.kind === 'video' ? 'video' : 'image'} size={12} />
                  <span className={styles.attachmentName}>{a.name}</span>
                  <button
                    type="button"
                    className={styles.attachmentRemove}
                    onClick={() => onRemoveAttachment(a.id)}
                    disabled={running}
                    aria-label={`Retirer ${a.name}`}
                  >
                    <Icon name="close" size={10} />
                  </button>
                </span>
              ))}
              {attachError && <span className={styles.attachError} role="alert">{attachError}</span>}
            </div>
          )}
          <textarea
            ref={inputRef}
            className={styles.textarea}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Que voulez-vous faire ?"
            rows={2}
            disabled={running}
          />
          <div className={styles.toolbar}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={e => {
                onAttach(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            <button
              type="button"
              className={styles.attach}
              data-tip-up
              onClick={() => fileRef.current?.click()}
              disabled={running}
              aria-label="Joindre une image ou une vidéo"
              title="Joindre une image ou une vidéo (l'IA ne voit que le nom, jamais le contenu)"
            >
              <Icon name="paperclip" size={16} />
            </button>
            {settings && provider && (() => {
              const supported = provider === 'anthropic'
              const active = supported && settings.webSearch
              return (
                <button
                  type="button"
                  className={`${styles.attach} ${active ? styles.webOn : ''}`}
                  data-tip-up
                  onClick={() => void save({ webSearch: !settings.webSearch })}
                  disabled={running || !supported}
                  aria-pressed={active}
                  aria-label="Recherche sur internet"
                  title={!supported
                    ? 'Recherche internet disponible avec Anthropic (Claude) uniquement.'
                    : active
                      ? "Recherche internet activée : l'IA peut consulter le web. Coût supplémentaire : chaque recherche est facturée par Anthropic en plus des tokens (environ 0,01 $, jusqu'à 5 par message). Cliquer pour désactiver."
                      : "Activer la recherche internet : l'IA pourra chercher des informations récentes et citer ses sources. Attention, cela entraîne des coûts supplémentaires : chaque recherche est facturée par Anthropic en plus des tokens (environ 0,01 $, jusqu'à 5 par message)."}
                >
                  <Icon name="globe" size={16} />
                </button>
              )
            })()}
            {settings && (
              <span className={styles.effort} data-tip-up title={`Puissance de réflexion — ${EFFORT_LEVELS.find(l => l.value === settings.effort)?.hint ?? ''}`}>
                <Select
                  compact
                  up
                  prefix="Réflexion"
                  aria-label="Puissance de réflexion"
                  value={settings.effort}
                  options={EFFORT_LEVELS.map(l => ({ value: l.value, label: l.label }))}
                  onChange={v => void save({ effort: v as Effort })}
                />
              </span>
            )}
            {running ? (
              <button className={`${styles.send} ${styles.stop}`} onClick={onStop} aria-label="Arrêter" title="Arrêter">
                <Icon name="stop" size={16} />
              </button>
            ) : (
              <button className={styles.send} onClick={submit} disabled={!draft.trim()} aria-label="Envoyer" title="Envoyer (Entrée)">
                <Icon name="send" size={16} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.foot}>
          {usage.input + usage.output + usage.cacheRead + usage.cacheWrite > 0 && (
            <span
              className={styles.usage}
              title={
                `Entrée : ${usage.input.toLocaleString('fr-FR')} · Sortie : ${usage.output.toLocaleString('fr-FR')}`
                + ` · Lus depuis le cache (tarif réduit) : ${usage.cacheRead.toLocaleString('fr-FR')}`
                + ` · Écrits dans le cache : ${usage.cacheWrite.toLocaleString('fr-FR')}`
              }
            >
              {formatTokens(usage.input + usage.cacheRead + usage.cacheWrite)} ↑ · {formatTokens(usage.output)} ↓ tokens
            </span>
          )}
          <span
            className={styles.hint}
            title="L'IA peut se tromper. Ctrl+Z annule toute sa dernière intervention d'un coup."
          >
            L'IA peut se tromper · Ctrl+Z annule
          </span>
        </div>
      </>
    )
  }

  return (
    <aside className={styles.panel} aria-label="Assistant IA">
      <header className={styles.header}>
        <div className={styles.title}>
          <Icon name="sparkles" size={16} />
          <span>Assistant IA</span>
          {ready && provider && (
            <span
              className={styles.lock}
              title={`Le contenu des diapositives consultées est envoyé à ${PROVIDER_ORGS[provider]}.`}
              aria-label={`Données envoyées à ${PROVIDER_ORGS[provider]}`}
              role="img"
            >
              <Icon name="lock" size={11} />
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          {ready && items.length > 0 && !running && (
            <button className={styles.textBtn} onClick={onClear}>Effacer</button>
          )}
          {ready && !running && (
            <button className={styles.iconBtn} onClick={() => setEditingSetup(v => !v)} aria-label="Réglages de l'assistant" title="Réglages">
              <Icon name="settings" size={15} />
            </button>
          )}
          <button className={styles.iconBtn} onClick={onClose} aria-label="Fermer l'assistant" title="Fermer">
            <Icon name="close" size={15} />
          </button>
        </div>
      </header>
      {body()}
    </aside>
  )
}
