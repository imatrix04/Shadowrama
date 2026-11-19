import { useRef, useState } from 'react'
import type { BlockData } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import { MAX_VIDEO_BYTES, heightForRatio, readVideoSize } from '../../utils/video'
import Icon from '../ui/Icon'
import styles from './ContextMenu.module.css'

interface Props {
  fieldKey: string
  accept?: string
  block: BlockData
  onUpdate: (id: number, changes: Partial<BlockData>) => void
}

/**
 * Choix d'un fichier média (image ou vidéo) pour un bloc.
 *
 * Les octets bruts sont gardés tels quels, sans passer par une chaîne base64
 * 33 % plus grosse qu'il fallait ensuite redécoder.
 */
export default function MediaFileField({ fieldKey, accept = 'image/*', block, onUpdate }: Props) {
  const isVideo = accept.startsWith('video')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const currentKey = String(getBlockField(block, fieldKey) ?? '')
  const previewSrc = currentKey.startsWith('media/') ? resolveMedia(currentKey) : currentKey

  const onPick = async (file: File | undefined) => {
    if (!file) return
    setError(null)

    // Le sélecteur filtre déjà par type, pas un fichier déposé.
    if (!isVideo && !file.type.startsWith('image/')) {
      setError('Ce fichier n’est pas une image.')
      return
    }

    if (isVideo) {
      if (!file.type.startsWith('video/') && !/\.(mp4|m4v|webm|ogv|mov|mkv)$/i.test(file.name)) {
        setError('Ce fichier n’est pas une vidéo.')
        return
      }
      if (file.size > MAX_VIDEO_BYTES) {
        setError(`Vidéo trop lourde (${Math.round(file.size / 1048576)} Mo, maximum ${Math.round(MAX_VIDEO_BYTES / 1048576)} Mo).`)
        return
      }
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const key = generateMediaKey(file.name, isVideo ? 'vid' : 'img')
    const url = registerMedia(key, bytes, file.type || (isVideo ? 'video/mp4' : 'image/png'))
    let changes: Partial<BlockData> = setBlockField(block, fieldKey, key)

    // Première vidéo du bloc : on lui donne le rapport de la vidéo, sans toucher
    // à la largeur choisie. Une vidéo qu'on remplace garde le cadre déjà réglé.
    if (isVideo && !currentKey) {
      const size = await readVideoSize(url)
      const height = size && heightForRatio(block.width, size.width, size.height)
      if (height) changes = { ...changes, height }
    }

    onUpdate(block.id, changes)
  }

  const kind = isVideo ? 'vidéo' : 'image'

  return (
    <div className={styles.media}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={e => {
          void onPick(e.target.files?.[0])
          // Permet de rechoisir le même fichier après une erreur.
          e.target.value = ''
        }}
      />

      <button
        type="button"
        className={`${styles.mediaDrop} ${previewSrc ? styles.mediaFilled : ''} ${dragging ? styles.mediaDragging : ''}`}
        onClick={() => inputRef.current?.click()}
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
          void onPick(e.dataTransfer.files[0])
        }}
        aria-label={previewSrc ? `Remplacer la ${kind}` : `Choisir une ${kind}`}
      >
        {previewSrc ? (
          <>
            {isVideo ? (
              <video src={previewSrc} muted preload="metadata" className={styles.mediaPreview} />
            ) : (
              <img src={previewSrc} className={styles.mediaPreview} alt="" />
            )}
            <span className={styles.mediaOverlay}>
              <Icon name="reload" size={14} /> Remplacer
            </span>
          </>
        ) : (
          <>
            <span className={styles.mediaIcon}><Icon name={isVideo ? 'video' : 'image'} size={20} /></span>
            <span className={styles.mediaTitle}>{dragging ? 'Déposez le fichier' : `Choisir une ${kind}`}</span>
            <span className={styles.mediaHint}>ou glissez-la ici</span>
          </>
        )}
      </button>

      {error && <span className={styles.mediaError} role="alert">{error}</span>}
    </div>
  )
}
