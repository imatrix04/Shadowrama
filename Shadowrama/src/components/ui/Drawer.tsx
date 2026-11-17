import { useState, useRef, useEffect } from 'react'
import type { ReactNode } from 'react'
import Icon from './Icon'
import type { IconName } from './Icon'
import styles from './Drawer.module.css'

export interface DrawerTab {
  key: string
  label: string
  icon?: IconName
  ultra?: boolean
}

interface Props {
  side: 'left' | 'right'
  tabs: DrawerTab[]
  activeTab: string | null
  onTabChange: (key: string | null) => void
  renderTab: (key: string) => ReactNode
  width?: number
  /** Emplacement réservé en bas du rail (ex. contrôles de zoom, via portail). */
  footerRef?: (el: HTMLDivElement | null) => void
}

export default function Drawer({
  side, tabs, activeTab, onTabChange, renderTab, width = 220, footerRef,
}: Props) {
  const [paintedTab, setPaintedTab] = useState(tabs[0]?.key ?? '')
  if (activeTab && activeTab !== paintedTab) setPaintedTab(activeTab)

  const isOpen = activeTab !== null
  const activeIndex = tabs.findIndex(t => t.key === activeTab)

  // Glisser pour défiler : un `overflow: auto` ne répond nativement qu'à la
  // molette/au trackpad, pas à un clic-glissé à la souris. On rejoue donc le
  // geste à la main, en laissant les champs natifs (curseur, nombre...)
  // gérer leur propre glissé.
  const innerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ startY: number; startScrollTop: number } | null>(null)

  const handleDragStart = (e: React.MouseEvent) => {
    const el = innerRef.current
    if (!el) return
    if ((e.target as HTMLElement).closest('input, textarea, select')) return
    dragState.current = { startY: e.clientY, startScrollTop: el.scrollTop }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragState.current
      const el = innerRef.current
      if (!drag || !el) return
      const dy = e.clientY - drag.startY
      // Sous ce seuil, on laisse passer : sinon un simple clic sur un preset
      // ou un bouton serait interprété comme un glissé.
      if (Math.abs(dy) < 4) return
      el.scrollTop = drag.startScrollTop - dy
    }
    const handleMouseUp = () => { dragState.current = null }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // Rail d'onglets : dans le flux, collé au bord de l'écran, au lieu de
  // pastilles flottantes par-dessus le canvas. Le libellé n'apparaît qu'au
  // survol (data-label), l'état ouvert se lit sur la pastille d'accent.
  const rail = (
    <div
      className={`${styles.tabs} ${side === 'left' ? styles.tabsLeft : styles.tabsRight}`}
      style={{ ['--active-index' as string]: activeIndex } as React.CSSProperties}
      role="tablist"
      aria-orientation="vertical"
    >
      <span className={`${styles.activeTrack} ${activeIndex >= 0 ? styles.activeTrackVisible : ''}`} aria-hidden="true" />
      {tabs.map(tab => {
        const active = activeTab === tab.key
        return (
          <button
            key={tab.key}
            role="tab"
            className={[
              styles.tab,
              tab.ultra ? styles.tabUltra : '',
              active ? styles.tabActive : '',
            ].join(' ')}
            onClick={() => onTabChange(active ? null : tab.key)}
            aria-selected={active}
            aria-expanded={active}
            aria-label={tab.label}
            data-label={tab.label}
          >
            <span className={styles.tabIcon}>
              {tab.icon ? <Icon name={tab.icon} size={16} /> : tab.label.charAt(0)}
            </span>
          </button>
        )
      })}
      {footerRef && <div ref={footerRef} className={styles.railFooter} />}
    </div>
  )

  const panel = (
    <div
      className={[
        styles.panel,
        isOpen ? styles.panelOpen : '',
        side === 'left' ? styles.panelLeft : styles.panelRight,
      ].join(' ')}
    >
      <div
        ref={innerRef}
        className={`${styles.inner} ${isOpen ? styles.innerVisible : ''}`}
        onMouseDown={handleDragStart}
      >
        {renderTab(paintedTab)}
      </div>
    </div>
  )

  return (
    <div className={styles.wrapper} style={{ ['--drawer-width' as string]: `${width}px` }}>
      {/* Le rail reste au bord de l'écran, le panneau s'ouvre vers le canvas. */}
      {side === 'left' ? <>{rail}{panel}</> : <>{panel}{rail}</>}
    </div>
  )
}

/** Intitulé de section, pour que tous les tiroirs se ressemblent. */
export function DrawerTitle({ children, ultra }: { children: ReactNode; ultra?: boolean }) {
  return <p className={`${styles.title} ${ultra ? styles.titleUltra : ''}`}>{children}</p>
}
