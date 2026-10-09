import { useEffect, useRef } from 'react'
import type { ParticleSettings } from '../../types'
import { createParticleField } from '../../ultra/particles'
import type { ParticleField, ParticleSnapshot } from '../../ultra/particles'
import styles from './ParticleLayer.module.css'

interface Props {
  /** Absent ou désactivé : rien n'est monté, donc aucun coût. */
  settings?: ParticleSettings
  /** Les particules réagissent au curseur. */
  interactive?: boolean
}

const HANDOFF_TTL_MS = 1000
const handoff = new Map<string, { at: number; snapshot: ParticleSnapshot }>()

function takeHandoff(key: string): ParticleSnapshot | undefined {
  const entry = handoff.get(key)
  if (!entry || performance.now() - entry.at > HANDOFF_TTL_MS) return undefined
  return entry.snapshot
}

export default function ParticleLayer({ settings, interactive = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fieldRef = useRef<ParticleField | null>(null)

  // Les réglages arrivent sous forme d'objet recréé à chaque rendu de l'éditeur.
  // Comparer la valeur et non l'identité évite de relancer le moteur pour rien.
  const key = settings ? JSON.stringify(settings) : ''
  // Clé à jour pour le démontage (son effet ne se ré-exécute pas).
  const keyRef = useRef(key)

  useEffect(() => {
    keyRef.current = key
    const canvas = canvasRef.current
    if (!canvas || !settings) {
      fieldRef.current?.destroy()
      fieldRef.current = null
      return
    }
    if (fieldRef.current) fieldRef.current.update(settings)
    else fieldRef.current = createParticleField(canvas, settings, { interactive, resume: takeHandoff(key) })
    // `settings` est couvert par `key` ; `interactive` a son propre effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    fieldRef.current?.setInteractive(interactive)
  }, [interactive])

  useEffect(() => () => {
    if (fieldRef.current) {
      handoff.set(keyRef.current, { at: performance.now(), snapshot: fieldRef.current.snapshot() })
      fieldRef.current.destroy()
    }
    fieldRef.current = null
  }, [])

  if (!settings) return null
  return <canvas ref={canvasRef} className={styles.layer} aria-hidden="true" />
}