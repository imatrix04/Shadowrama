import { useEffect, useState } from 'react'
import type { BlockComponentProps, CarouselBlockData } from '../../types'
import type { CarouselDirection, CarouselLayerState } from '../../ultra/carouselTransitions'
import { getCarouselTransition } from '../../ultra/carouselTransitions'
import ImageSurface from './ImageSurface'
import Icon from '../../components/ui/Icon'
import styles from './CarouselBlock.module.css'

const DEFAULT_SECONDS = 0.6
const DEFAULT_INTERVAL = 4
const DEFAULT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

const NEUTRAL: CarouselLayerState = { transform: 'none', opacity: 1 }

export default function CarouselBlock({ block, ultra }: BlockComponentProps<CarouselBlockData>) {
  const items = Array.isArray(block.items) ? block.items : []
  const count = items.length

  // Hors mode Ultra — et dans les vignettes du panneau diapos, où `ultra` n'est
  // pas transmis — le carrousel se fige sur sa première vue : même règle que
  // les autres réglages Ultra, la donnée est conservée mais inerte.
  const live = !!ultra && count > 1

  const [index, setIndex] = useState(0)
  // Vue en cours de sortie. Elle reste montée le temps de la transition, sinon
  // l'ancienne image disparaîtrait d'un coup au lieu de s'en aller.
  const [leaving, setLeaving] = useState<number | null>(null)
  const [dir, setDir] = useState<CarouselDirection>(1)
  const [hovered, setHovered] = useState(false)

  // L'index peut dépasser si des vues ont été supprimées depuis.
  const current = count > 0 ? Math.min(index, count - 1) : 0

  const def = getCarouselTransition(block.transition)
  const seconds = block.transitionSeconds ?? DEFAULT_SECONDS
  const ease = block.ease ?? DEFAULT_EASE
  const loop = block.loop ?? true

  const goTo = (next: number, direction: CarouselDirection) => {
    if (!live || next === current || next < 0 || next >= count) return
    setDir(direction)
    setLeaving(current)
    setIndex(next)
  }

  const goNext = () => {
    if (current === count - 1 && !loop) return
    goTo((current + 1) % count, 1)
  }

  const goPrev = () => {
    if (current === 0 && !loop) return
    goTo((current - 1 + count) % count, -1)
  }

  // Fin de transition : la vue sortante repasse « cachée » et se gare hors
  // cadre, prête pour son prochain passage.
  useEffect(() => {
    if (leaving === null) return
    const timer = setTimeout(() => setLeaving(null), seconds * 1000)
    return () => clearTimeout(timer)
  }, [leaving, index, seconds])

  useEffect(() => {
    if (!live || !block.autoplay) return
    if (block.pauseOnHover && hovered) return
    if (!loop && current === count - 1) return

    const interval = Math.max(0.5, block.interval ?? DEFAULT_INTERVAL)
    const timer = setTimeout(() => goTo((current + 1) % count, 1), interval * 1000)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, block.autoplay, block.interval, block.pauseOnHover, hovered, current, count, loop])

  if (count === 0) {
    return (
      <div className={styles.empty} style={{ borderRadius: block.borderRadius ?? 4 }}>
        <Icon name="carousel" size={22} />
        Carrousel vide
      </div>
    )
  }

  const stateFor = (i: number): CarouselLayerState => {
    if (i === current) return NEUTRAL
    if (i === leaving) return def.exit(dir)
    return def.enter(dir)
  }

  return (
    <div
      className={styles.frame}
      style={{
        borderRadius: block.borderRadius ?? 0,
        backgroundColor: block.backgroundColor || undefined,
        perspective: def.perspective ? '1200px' : undefined,
        ['--carousel-control' as string]: block.controlColor || '#ffffff',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {items.map((item, i) => {
        const active = i === current
        const animating = active || i === leaving
        const state = stateFor(i)
        return (
          <div
            key={item.id}
            className={styles.layer}
            style={{
              transform: state.transform,
              opacity: state.opacity,
              // Les vues garées ne transitionnent pas : elles doivent sauter à
              // leur position d'attente, pas y glisser à l'écran.
              transition: animating
                ? `transform ${seconds}s ${ease}, opacity ${seconds}s ${ease}`
                : 'none',
              zIndex: active ? 2 : i === leaving ? 1 : 0,
            }}
          >
            {block.kenBurns && ultra ? (
              <div className={styles.kenBurns}>
                <ImageSurface data={item} width={block.width} height={block.height} className={styles.surface} />
              </div>
            ) : (
              <ImageSurface data={item} width={block.width} height={block.height} className={styles.surface} />
            )}
            {item.caption && <span className={styles.caption}>{item.caption}</span>}
          </div>
        )
      })}

      {/* `stopPropagation` sur le clic seulement : en présentation il empêche
          de changer de diapositive, et dans l'éditeur le `mousedown` continue
          de passer, donc le bloc reste sélectionnable et déplaçable. */}
      {live && (block.showArrows ?? true) && (
        <>
          <button
            className={`${styles.arrow} ${styles.arrowLeft}`}
            onClick={e => { e.stopPropagation(); goPrev() }}
            aria-label="Vue précédente"
          >
            <Icon name="chevronLeft" size={16} />
          </button>
          <button
            className={`${styles.arrow} ${styles.arrowRight}`}
            onClick={e => { e.stopPropagation(); goNext() }}
            aria-label="Vue suivante"
          >
            <Icon name="chevronRight" size={16} />
          </button>
        </>
      )}

      {live && (block.showDots ?? true) && (
        <div className={styles.dots}>
          {items.map((item, i) => (
            <button
              key={item.id}
              className={`${styles.dot} ${i === current ? styles.dotActive : ''}`}
              onClick={e => { e.stopPropagation(); goTo(i, i > current ? 1 : -1) }}
              aria-label={`Vue ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}