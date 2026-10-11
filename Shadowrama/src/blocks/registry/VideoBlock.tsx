import { useEffect, useRef, useState } from 'react'
import type { BlockComponentProps, VideoBlockData } from '../../types'
import { resolveMedia } from '../../utils/mediaStore'
import { resolvePlayback } from '../../utils/video'
import Icon from '../../components/ui/Icon'
import { getFrameStyle } from './frameStyle'
import MediaPlaceholder from './MediaPlaceholder'
import styles from './VideoBlock.module.css'

/**
 * Bloc vidéo : un fichier du projet, cadré comme une image (cadrage, arrondi,
 * forme libre — voir frameStyle) et animé comme n'importe quel bloc.
 *
 * Trois façons d'être affiché, selon `mode` :
 * - `present` : la lecture démarre à l'arrivée de la diapositive (si demandé) ;
 *   les commandes natives n'existent que si le bloc les réclame, sinon le clic
 *   traverse la vidéo et fait avancer la présentation ;
 * - `edit` : image fixe au point de départ choisi, bouton « Aperçu » pour
 *   écouter ce que donneront les réglages ;
 * - absent : vignettes et couche sortante d'une transition. Image fixe, jamais
 *   de lecture ni de son.
 */
export default function VideoBlock({ block, mode }: BlockComponentProps<VideoBlockData>) {
  const src = block.src?.startsWith('media/') ? resolveMedia(block.src) : undefined
  const frame = getFrameStyle(block, block.width, block.height)
  // Mémorise QUELLE vidéo a échoué : une autre vidéo repart à neuf, sans effet.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const failed = !!src && failedSrc === src

  if (!src) {
    return <MediaPlaceholder icon="video" label="Aucune vidéo" borderRadius={block.borderRadius} />
  }
  if (failed) {
    return (
      <MediaPlaceholder
        icon="video"
        label="Cette vidéo ne peut pas être lue (format ou codec non pris en charge)."
        borderRadius={block.borderRadius}
      />
    )
  }
  return <Player block={block} src={src} mode={mode} frame={frame} onFail={() => setFailedSrc(src)} />
}

function Player({ block, src, mode, frame, onFail }: {
  block: VideoBlockData
  src: string
  mode: BlockComponentProps['mode']
  frame: React.CSSProperties
  onFail: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [previewing, setPreviewing] = useState(false)
  const p = resolvePlayback(block)
  const present = mode === 'present'
  const edit = mode === 'edit'
  const controls = present && p.showControls

  // Image affichée tant que la lecture n'a pas commencé : le point de départ
  // choisi, ou presque 0 pour forcer le décodage d'une première image (sans
  // déplacement, certaines vidéos restent noires jusqu'au premier « play »).
  useEffect(() => {
    const video = ref.current
    if (!video) return
    const seek = () => { video.currentTime = p.startTime > 0 ? p.startTime : 0.01 }
    if (video.readyState >= 1) seek()
    else video.addEventListener('loadedmetadata', seek, { once: true })
    return () => video.removeEventListener('loadedmetadata', seek)
  }, [src, p.startTime])

  // Réglages directs sur l'élément (React ne gère pas `muted` après le montage).
  useEffect(() => {
    const video = ref.current
    if (!video) return
    video.muted = p.muted
    video.volume = p.volume
    video.playbackRate = p.playbackRate
  }, [src, p.muted, p.volume, p.playbackRate])

  // Lecture automatique en présentation.
  useEffect(() => {
    const video = ref.current
    if (!present || !p.autoplay || !video) return
    let cancelled = false
    const start = () => {
      if (cancelled) return
      if (p.startTime > 0 && video.currentTime < p.startTime) video.currentTime = p.startTime
      video.play().catch(() => {
        // Le navigateur refuse parfois un son lancé sans geste de l'utilisateur :
        // mieux vaut une vidéo muette que pas de vidéo.
        if (cancelled) return
        video.muted = true
        video.play().catch(() => {})
      })
    }
    if (video.readyState >= 1) start()
    else video.addEventListener('loadedmetadata', start, { once: true })
    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', start)
      video.pause()
    }
  }, [present, p.autoplay, p.startTime, src])

  // Fin choisie et boucle : surveillées à chaque image plutôt qu'à `timeupdate`
  // (4 fois par seconde seulement), pour couper au bon moment.
  useEffect(() => {
    const video = ref.current
    if (!video) return
    let frameId = 0
    const tick = () => {
      if (!video.paused) {
        const end = p.endTime > 0 ? Math.min(p.endTime, video.duration || p.endTime) : 0
        if (end > 0 && video.currentTime >= end) {
          if (p.loop) video.currentTime = p.startTime
          else {
            video.pause()
            setPreviewing(false)
          }
        }
      }
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [p.endTime, p.loop, p.startTime])

  // Fin naturelle du fichier.
  const onEnded = () => {
    const video = ref.current
    if (!video) return
    if (p.loop) {
      video.currentTime = p.startTime
      video.play().catch(() => {})
    } else {
      setPreviewing(false)
    }
  }

  // Quitter l'édition (ou changer de réglage de source) coupe l'aperçu.
  useEffect(() => {
    if (!edit) return
    const video = ref.current
    return () => { video?.pause() }
  }, [edit, src])

  const togglePreview = () => {
    const video = ref.current
    if (!video) return
    if (video.paused) {
      const end = p.endTime > 0 ? p.endTime : video.duration
      if (video.currentTime < p.startTime || video.currentTime >= end - 0.05) video.currentTime = p.startTime
      video.play().then(() => setPreviewing(true)).catch(() => {})
    } else {
      video.pause()
      setPreviewing(false)
    }
  }

  return (
    <div className={`${styles.root} ${controls ? styles.interactive : ''}`}>
      <video
        ref={ref}
        src={src}
        className={styles.video}
        style={frame}
        controls={controls}
        playsInline
        preload="auto"
        draggable={false}
        // Avec les commandes, Espace pilote la lecture : il ne doit pas aussi
        // faire avancer la diapositive.
        onKeyDown={controls ? e => { if (e.key === ' ') e.stopPropagation() } : undefined}
        onEnded={onEnded}
        onError={onFail}
      />
      {edit && (
        <button
          type="button"
          className={styles.preview}
          title={previewing ? 'Arrêter l’aperçu' : 'Aperçu'}
          aria-label={previewing ? 'Arrêter l’aperçu' : 'Aperçu'}
          // Le bloc se déplace à la souris : le bouton ne doit pas lancer un glissement.
          onMouseDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); togglePreview() }}
        >
          <Icon name={previewing ? 'pause' : 'play'} size={16} />
        </button>
      )}
    </div>
  )
}