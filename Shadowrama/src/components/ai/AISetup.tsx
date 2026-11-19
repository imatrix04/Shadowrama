import { useState } from 'react'
import { EFFORT_LEVELS, PROVIDER_KEY_URLS, PROVIDER_LABELS, PROVIDER_ORGS } from '../../ai/types'
import type { AISettings, Effort, Provider } from '../../ai/types'
import Select from '../ui/Select'
import styles from './AISetup.module.css'

const PROVIDERS = Object.keys(PROVIDER_LABELS) as Provider[]

const CUSTOM = '__custom__'

/** Suggestions ; « Autre modèle… » permet de saisir un identifiant libre. */
const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  anthropic: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o'],
}

interface Props {
  settings: AISettings
  error: string | null
  onSave: (patch: { provider?: string; model?: string; consent?: boolean; effort?: string; webSearch?: boolean }) => Promise<boolean>
  onSetKey: (provider: string, key: string) => Promise<boolean>
  onClearKey: (provider: string) => Promise<boolean>
  /** Appelé quand tout est enregistré (clé + consentement). */
  onDone?: () => void
}

/**
 * Configuration de l'assistant : fournisseur, modèle, clé API, et surtout le
 * consentement à l'envoi des données. Sans case cochée, rien n'est enregistré
 * et l'assistant reste inutilisable — le processus principal le vérifie aussi.
 */
export default function AISetup({ settings, error, onSave, onSetKey, onClearKey, onDone }: Props) {
  const [provider, setProvider] = useState<Provider>(settings.provider)
  const [model, setModel] = useState(settings.models[settings.provider])
  const [custom, setCustom] = useState(!MODEL_SUGGESTIONS[settings.provider].includes(settings.models[settings.provider]))
  const [effort, setEffort] = useState<Effort>(settings.effort)
  const [key, setKey] = useState('')
  const [consent, setConsent] = useState(settings.consent[settings.provider])
  const [busy, setBusy] = useState(false)

  const org = PROVIDER_ORGS[provider]
  const hasKey = settings.hasKey[provider]
  const keyReady = key.trim().length > 0 || hasKey
  const canSubmit = consent && keyReady && model.trim().length > 0 && !busy

  const changeProvider = (next: Provider) => {
    setProvider(next)
    setModel(settings.models[next])
    setCustom(!MODEL_SUGGESTIONS[next].includes(settings.models[next]))
    setConsent(settings.consent[next])
    setKey('')
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      // La clé d'abord : si elle est refusée, ni le fournisseur ni le
      // consentement ne sont enregistrés pour rien.
      if (key.trim() && !await onSetKey(provider, key.trim())) return
      if (!await onSave({ provider, model: model.trim(), consent: true, effort })) return
      setKey('')
      onDone?.()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onClearKey(provider)
      setConsent(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <div className={styles.field}>
        <span className={styles.label} id="ai-provider-label">Fournisseur d'IA</span>
        <Select
          aria-label="Fournisseur d'IA"
          value={provider}
          options={PROVIDERS.map(p => ({ value: p, label: PROVIDER_LABELS[p] }))}
          onChange={v => changeProvider(v as Provider)}
        />
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Modèle</span>
        <Select
          aria-label="Modèle"
          value={custom ? CUSTOM : model}
          options={[
            ...MODEL_SUGGESTIONS[provider].map(m => ({ value: m, label: m })),
            { value: CUSTOM, label: 'Autre modèle…' },
          ]}
          onChange={v => {
            if (v === CUSTOM) {
              setCustom(true)
            } else {
              setCustom(false)
              setModel(v)
            }
          }}
        />
        {custom && (
          <input
            className={styles.input}
            value={model}
            onChange={e => setModel(e.target.value)}
            placeholder="Identifiant exact du modèle"
            spellCheck={false}
            autoComplete="off"
          />
        )}
        <span className={styles.hint}>
          Un modèle recommandé est déjà sélectionné : vous n'avez rien à changer.
        </span>
      </div>

      <div className={styles.field}>
        <span className={styles.label}>Puissance de réflexion</span>
        <Select
          aria-label="Puissance de réflexion"
          value={effort}
          options={EFFORT_LEVELS.map(l => ({ value: l.value, label: l.label }))}
          onChange={v => setEffort(v as Effort)}
        />
        <span className={styles.hint}>
          {EFFORT_LEVELS.find(l => l.value === effort)?.hint} Modifiable à tout moment depuis l'en-tête
          du panneau ; plus c'est élevé, plus l'IA consomme de tokens (facturés par {org}).
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>Clé API</span>
        <input
          className={styles.input}
          type="password"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder={hasKey ? '•••••••• (enregistrée — laissez vide pour la garder)' : 'Collez votre clé ici'}
          spellCheck={false}
          autoComplete="off"
        />
        <span className={styles.hint}>
          Créez-la sur{' '}
          <a href={PROVIDER_KEY_URLS[provider]} target="_blank" rel="noopener noreferrer">
            {PROVIDER_KEY_URLS[provider].replace('https://', '')}
          </a>
          . Elle est chiffrée sur cet
          ordinateur et n'est envoyée qu'à {org}. L'usage est facturé par {org}, pas par Shadowrama.
        </span>
      </label>

      <div className={styles.notice} role="note">
        <strong>Ce qui est envoyé à {org}</strong>
        <p>
          À chaque demande, l'assistant transmet à {org} votre message ainsi que le contenu des
          diapositives qu'il consulte : textes, positions, couleurs, adresses web. Les images,
          vidéos et fichiers ne sont pas envoyés ; si vous en joignez un à la conversation, seuls
          son nom et ses dimensions sont transmis, jamais son contenu.
        </p>
        <p>
          Ces données sont traitées par {org} selon ses propres conditions. N'utilisez pas
          l'assistant sur un contenu confidentiel que vous ne voulez pas partager avec eux.
          La conversation (textes seulement) est conservée sur cet ordinateur, avec le projet ;
          « Effacer » la supprime.
        </p>
      </div>

      <label className={styles.consent}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>J'ai compris et j'autorise l'envoi de ces données à {org}.</span>
      </label>

      {!settings.secureStorage && (
        <p className={styles.error}>
          Le stockage sécurisé du système est indisponible sur cet ordinateur : la clé ne pourra pas
          être enregistrée sans risque.
        </p>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.primary} disabled={!canSubmit || !settings.secureStorage}>
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {hasKey && (
          <button type="button" className={styles.danger} onClick={remove} disabled={busy}>
            Supprimer la clé
          </button>
        )}
      </div>
    </form>
  )
}
