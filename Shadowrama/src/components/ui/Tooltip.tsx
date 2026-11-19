import { useEffect, useRef, useState } from 'react'
import styles from './Tooltip.module.css'

interface Tip {
  text: string
  x: number
  y: number
  below: boolean
}

const SHOW_DELAY_MS = 450
const GAP = 8
const MARGIN = 8

/**
 * Remplace les infobulles natives (attribut `title`, non stylables) par une
 * infobulle au thème, sans toucher aux composants : les écouteurs sont délégués
 * au document.
 *
 * Au survol, `title` est retiré pour empêcher l'infobulle native, puis remis à
 * la sortie : sans lui, un bouton qui n'a que `title` perdrait son nom
 * accessible le reste du temps.
 */
export default function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let target: HTMLElement | null = null
    let saved = ''
    let timer: number | undefined

    const release = () => {
      window.clearTimeout(timer)
      if (target && saved && !target.hasAttribute('title')) target.setAttribute('title', saved)
      target = null
      saved = ''
      setTip(null)
    }

    const enter = (el: HTMLElement) => {
      const text = el.getAttribute('title')?.trim()
      if (!text) return
      release()
      target = el
      saved = text
      el.removeAttribute('title')
      timer = window.setTimeout(() => {
        const r = el.getBoundingClientRect()
        const below = r.bottom + 48 < window.innerHeight
        setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + GAP : r.top - GAP, below })
      }, SHOW_DELAY_MS)
    }

    const onOver = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[title]')
      if (el && el !== target) enter(el)
    }
    const onOut = (e: MouseEvent) => {
      if (target && !target.contains(e.relatedTarget as Node | null)) release()
    }
    const onFocus = (e: FocusEvent) => {
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('[title]')
      if (el && el !== target) enter(el)
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', release)
    document.addEventListener('mousedown', release, true)
    document.addEventListener('keydown', release, true)
    window.addEventListener('scroll', release, true)
    window.addEventListener('blur', release)
    return () => {
      release()
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', release)
      document.removeEventListener('mousedown', release, true)
      document.removeEventListener('keydown', release, true)
      window.removeEventListener('scroll', release, true)
      window.removeEventListener('blur', release)
    }
  }, [])

  // Centrée sur l'élément, puis recadrée pour ne jamais sortir de la fenêtre.
  useEffect(() => {
    const el = ref.current
    if (!tip || !el) return
    const w = el.offsetWidth
    const left = Math.min(Math.max(tip.x - w / 2, MARGIN), window.innerWidth - w - MARGIN)
    el.style.left = `${left}px`
    el.style.setProperty('--arrow-x', `${Math.min(Math.max(tip.x - left, 12), w - 12)}px`)
  }, [tip])

  if (!tip) return null
  return (
    <div
      ref={ref}
      role="tooltip"
      className={`${styles.tip} ${tip.below ? styles.below : styles.above}`}
      style={{ top: tip.y }}
    >
      {tip.text}
    </div>
  )
}
