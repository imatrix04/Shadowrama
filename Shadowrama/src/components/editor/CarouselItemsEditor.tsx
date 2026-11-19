import { useRef, useState } from 'react'
import type { CarouselItem, ImageFit } from '../../types'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import { normalizePolygon } from '../../utils/shapePolygon'
import { nextId } from '../../utils/ids'
import CustomSelect from '../../styles/CustomSelect'
import Icon from '../ui/Icon'
import PolygonShapeEditor from './PolygonShapeEditor'
import menu from './ContextMenu.module.css'
import styles from './CarouselItemsEditor.module.css'

interface Props {
  items: CarouselItem[]
  /** Dimensions du bloc : le masque de forme est généré en pixels réels. */
  blockWidth: number
  blockHeight: number
  onChange: (items: CarouselItem[]) => void
}

const FIT_OPTIONS = [
  { label: 'Remplir (rogne)', value: 'cover' },
  { label: 'Contenir (entière)', value: 'contain' },
  { label: 'Étirer', value: 'fill' },
]

const SHAPE_OPTIONS = [
  { label: 'Rectangle (par défaut)', value: 'none' },
  { label: 'Forme personnalisée', value: 'grid' },
]

/** Octets du fichier enregistrés dans le magasin média, clé renvoyée. */
async function storeImage(file: File): Promise<string> {
  // Mêmes octets bruts que le bloc image : pas de détour par une data URL.
  const bytes = new Uint8Array(await file.arrayBuffer())
  const key = generateMediaKey(file.name)
  registerMedia(key, bytes, file.type)
  return key
}

/** Zone d'ajout : clic pour parcourir, ou dépôt de plusieurs images d'un coup. */
function AddZone({ onFiles, compact }: { onFiles: (files: File[]) => void; compact: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = (list: FileList | null) => {
    if (!list) return
    const all = Array.from(list)
    const images = all.filter(f => f.type.startsWith('image/'))
    setError(images.length < all.length ? 'Seules les images sont acceptées.' : null)
    if (images.length > 0) onFiles(images)
  }

  return (
    <div className={styles.add}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={e => {
          handle(e.target.files)
          e.target.value = ''
        }}
      />
      <button
        type="button"
        className={`${menu.mediaDrop} ${compact ? styles.addCompact : ''} ${dragging ? menu.mediaDragging : ''}`}
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
          handle(e.dataTransfer.files)
        }}
      >
        {compact ? (
          <span className={styles.addInline}><Icon name="plus" size={14} /> {dragging ? 'Déposez les images' : 'Ajouter des images'}</span>
        ) : (
          <>
            <span className={menu.mediaIcon}><Icon name="image" size={20} /></span>
            <span className={menu.mediaTitle}>{dragging ? 'Déposez les images' : 'Ajouter des images'}</span>
            <span className={menu.mediaHint}>ou glissez-les ici (plusieurs possibles)</span>
          </>
        )}
      </button>
      {error && <span className={menu.mediaError} role="alert">{error}</span>}
    </div>
  )
}

/** Bouton « Remplacer » : un vrai bouton du thème plutôt que le champ fichier natif. */
function ReplaceButton({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
      <button type="button" className={styles.replaceBtn} onClick={() => inputRef.current?.click()}>
        <Icon name="reload" size={13} /> Remplacer l'image
      </button>
    </>
  )
}

/**
 * Édition des vues d'un carrousel : ajout, ordre, suppression, et les mêmes
 * réglages qu'un bloc image pour chacune (cadrage, arrondi, forme libre).
 */
export default function CarouselItemsEditor({ items, blockWidth, blockHeight, onChange }: Props) {
  // Repli ouvert : le menu contextuel est étroit, tout déplier d'emblée le
  // rendrait illisible dès trois images.
  const [expanded, setExpanded] = useState<number | null>(null)

  const patch = (id: number, changes: Partial<CarouselItem>) => {
    onChange(items.map(item => (item.id === id ? { ...item, ...changes } : item)))
  }

  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onChange(next)
  }

  const remove = (id: number) => {
    onChange(items.filter(item => item.id !== id))
    if (expanded === id) setExpanded(null)
  }

  const addFiles = async (files: File[]) => {
    const added: CarouselItem[] = []
    for (const file of files) {
      added.push({ id: nextId(), src: await storeImage(file), alt: file.name, objectFit: 'cover' })
    }
    if (added.length) onChange([...items, ...added])
  }

  return (
    <div>
      <div className={styles.list}>
        {items.map((item, i) => {
          const previewSrc = item.src?.startsWith('media/') ? resolveMedia(item.src) : item.src
          const open = expanded === item.id
          const radiusPx = item.borderRadius ?? 0
          // Même conversion que polygonToMaskDataUri : l'éditeur travaille dans
          // un repère abstrait 0–100, le rayon stocké est en pixels du bloc.
          const abstractRadius = radiusPx > 0
            ? (radiusPx * 100) / Math.max(1, Math.min(blockWidth, blockHeight))
            : 0

          return (
            <div key={item.id} className={styles.item}>
              <div className={styles.row}>
                {previewSrc
                  ? <img src={previewSrc} className={styles.thumb} alt="" />
                  : <span className={`${styles.thumb} ${styles.thumbEmpty}`}>vide</span>}
                <span className={styles.rank}>{i + 1}. {item.alt || 'Sans titre'}</span>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Monter"
                  aria-label="Monter"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                ><Icon name="layerForward" size={13} /></button>
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Descendre"
                  aria-label="Descendre"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                ><Icon name="layerBackward" size={13} /></button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${open ? styles.iconBtnOn : ''}`}
                  title="Régler"
                  aria-label="Régler cette image"
                  aria-expanded={open}
                  onClick={() => setExpanded(open ? null : item.id)}
                ><Icon name="settings" size={13} /></button>
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.danger}`}
                  title="Retirer"
                  aria-label="Retirer cette image"
                  onClick={() => remove(item.id)}
                ><Icon name="trash" size={13} /></button>
              </div>

              {open && (
                <div className={styles.details}>
                  <ReplaceButton onFile={async file => {
                    if (!file.type.startsWith('image/')) return
                    patch(item.id, { src: await storeImage(file) })
                  }} />

                  <span className={styles.detailLabel}>Description</span>
                  <input
                    type="text"
                    className={menu.input}
                    value={item.alt ?? ''}
                    onChange={e => patch(item.id, { alt: e.target.value })}
                  />

                  <span className={styles.detailLabel}>Légende</span>
                  <input
                    type="text"
                    className={menu.input}
                    value={item.caption ?? ''}
                    onChange={e => patch(item.id, { caption: e.target.value })}
                  />

                  <span className={styles.detailLabel}>Cadrage</span>
                  <CustomSelect
                    value={item.objectFit ?? 'cover'}
                    options={FIT_OPTIONS}
                    onChange={v => patch(item.id, { objectFit: v as ImageFit })}
                  />

                  <span className={styles.detailLabel}>Arrondi</span>
                  <input
                    type="number"
                    className={menu.input}
                    value={radiusPx}
                    onChange={e => patch(item.id, { borderRadius: Number(e.target.value) })}
                  />

                  <span className={styles.detailLabel}>Forme</span>
                  <CustomSelect
                    value={item.shapeMode ?? 'none'}
                    options={SHAPE_OPTIONS}
                    onChange={v => patch(item.id, { shapeMode: v as 'none' | 'grid' })}
                  />

                  {item.shapeMode === 'grid' && (
                    <PolygonShapeEditor
                      value={normalizePolygon(item.customShape)}
                      radius={abstractRadius}
                      onChange={points => patch(item.id, { customShape: points })}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <AddZone onFiles={files => void addFiles(files)} compact={items.length > 0} />
    </div>
  )
}