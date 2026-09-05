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
}

export default function Drawer({
  side, tabs, activeTab, onTabChange, renderTab, width = 220,
}: Props) {
  const [paintedTab, setPaintedTab] = useState(tabs[0]?.key ?? '')
  if (activeTab && activeTab !== paintedTab) setPaintedTab(activeTab)

  const isOpen = activeTab !== null
  const pointsAway = side === 'left' ? !isOpen : isOpen

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

  return (
    <div className={styles.wrapper} style={{ ['--drawer-width' as string]: `${width}px` }}>
      <div className={`${styles.tabs} ${side === 'left' ? styles.tabsLeft : styles.tabsRight}`}>
        {tabs.map(tab => {
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              className={[
                styles.tab,
                tab.ultra ? styles.tabUltra : '',
                active ? styles.tabActive : '',
              ].join(' ')}
              onClick={() => onTabChange(active ? null : tab.key)}
              aria-expanded={active}
              title={active ? `Fermer ${tab.label}` : `Ouvrir ${tab.label}`}
            >
              <span className={`${styles.chevron} ${pointsAway ? styles.chevronFlipped : ''}`}>
                <Icon name={side === 'left' ? 'chevronRight' : 'chevronLeft'} size={12} />
              </span>
              {tab.icon && (
                <span className={styles.tabIcon}>
                  <Icon name={tab.icon} size={14} />
                </span>
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

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
    </div>
  )
}

/** Intitulé de section, pour que tous les tiroirs se ressemblent. */
export function DrawerTitle({ children, ultra }: { children: ReactNode; ultra?: boolean }) {
  return <p className={`${styles.title} ${ultra ? styles.titleUltra : ''}`}>{children}</p>
}
