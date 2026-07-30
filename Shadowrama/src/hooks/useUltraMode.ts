import { useCallback, useState } from 'react'

const KEY = 'shadowrama-ultra-mode'

/**
 * Mode Ultra Design : une surcouche de l'éditeur, pas un éditeur séparé.
 *
 * Le mode ne change rien aux données — il déverrouille des panneaux et des
 * réglages. Un projet reste donc ouvrable dans les deux modes : en mode simple,
 * les effets et séquences enregistrés sont conservés dans le fichier mais ne
 * sont pas rendus.
 */
export function useUltraMode() {
  const [enabled, setEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })

  const persist = useCallback((value: boolean) => {
    setEnabled(value)
    try {
      localStorage.setItem(KEY, value ? '1' : '0')
    } catch {
      // Sans persistance, le mode se contente de ne pas survivre au redémarrage.
    }
  }, [])

  return {
    ultra: enabled,
    enableUltra: useCallback(() => persist(true), [persist]),
    disableUltra: useCallback(() => persist(false), [persist]),
    toggleUltra: useCallback(() => persist(!enabled), [persist, enabled]),
  }
}
