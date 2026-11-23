import { useCallback, useEffect, useState } from 'react'

const KEY = 'shadowrama-features'

/**
 * Fonctionnalités verrouillées : invisibles et inutilisables tant qu'elles ne
 * sont pas déverrouillées dans Paramètres → Fonctionnalités. Toutes sont
 * désactivées par défaut ; en ajouter une = une clé ici + une ligne dans
 * Settings.tsx + un test de la clé dans l'éditeur. Un bloc peut dépendre d'une
 * fonctionnalité (`BlockConfig.beta`) : il est alors absent de la palette et de
 * l'assistant tant qu'elle est verrouillée, mais les blocs déjà posés restent.
 */
export type FeatureKey = 'alignment' | 'chart'

export type Features = Record<FeatureKey, boolean>

const DEFAULTS: Features = { alignment: false, chart: false }

/**
 * Lecture tolérante du stockage : clés inconnues, valeurs non booléennes ou JSON
 * cassé retombent sur « verrouillé ». Seul `true` explicite déverrouille.
 */
export function parseFeatures(raw: string | null): Features {
  const features = { ...DEFAULTS }
  if (!raw) return features
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      for (const key of Object.keys(DEFAULTS) as FeatureKey[]) {
        if ((parsed as Record<string, unknown>)[key] === true) features[key] = true
      }
    }
  } catch {
    // JSON illisible : tout reste verrouillé.
  }
  return features
}

function load(): Features {
  try {
    return parseFeatures(localStorage.getItem(KEY))
  } catch {
    return { ...DEFAULTS }
  }
}

export function useFeatures() {
  const [features, setFeatures] = useState<Features>(load)

  // Persistance : effet de synchronisation avec le stockage, pas de dérivation.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(features))
    } catch {
      // Sans persistance, le choix ne survit juste pas au redémarrage.
    }
  }, [features])

  const setFeature = useCallback((key: FeatureKey, value: boolean) => {
    setFeatures(prev => ({ ...prev, [key]: value }))
  }, [])

  return { features, setFeature }
}
