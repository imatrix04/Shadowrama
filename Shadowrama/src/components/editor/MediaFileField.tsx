import { useState } from 'react'
import type { BlockData } from '../../types'
import { getBlockField, setBlockField } from '../../types'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import { MAX_VIDEO_BYTES, heightForRatio, readVideoSize } from '../../utils/video'
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

  const currentKey = String(getBlockField(block, fieldKey) ?? '')
  const previewSrc = currentKey.startsWith('media/') ? resolveMedia(currentKey) : currentKey

  const onPick = async (file: File | undefined) => {
    if (!file) return
    setError(null)

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {previewSrc && (isVideo ? (
        <video
          src={previewSrc}
          muted
          preload="metadata"
          style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '4px', background: '#000' }}
        />
      ) : (
        <img
          src={previewSrc}
          style={{ width: '100%', height: '60px', objectFit: 'cover', borderRadius: '4px' }}
          alt=""
        />
      ))}
      <input
        type="file"
        accept={accept}
        className={styles.input}
        onChange={e => {
          void onPick(e.target.files?.[0])
          // Permet de rechoisir le même fichier après une erreur.
          e.target.value = ''
        }}
      />
      {error && <span style={{ color: '#ff6b6b', fontSize: '0.75rem' }}>{error}</span>}
    </div>
  )
}