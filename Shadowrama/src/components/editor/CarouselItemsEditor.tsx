import { useState } from 'react'
import type { CarouselItem, ImageFit } from '../../types'
import { generateMediaKey, registerMedia, resolveMedia } from '../../utils/mediaStore'
import { normalizePolygon } from '../../utils/shapePolygon'
import { nextId } from '../../utils/ids'
import CustomSelect from '../../styles/CustomSelect'
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

  const addFiles = async (files: FileList) => {
    const added: CarouselItem[] = []
    for (const file of Array.from(files)) {
      // Mêmes octets bruts que le bloc image : pas de détour par une data URL.
      const bytes = new Uint8Array(await file.arrayBuffer())
      const key = generateMediaKey(file.name)
      registerMedia(key, bytes, file.type)
      added.push({ id: nextId(), src: key, alt: file.name, objectFit: 'cover' })
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
                  className={styles.iconBtn}
                  title="Monter"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >↑</button>
                <button
                  className={styles.iconBtn}
                  title="Descendre"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                >↓</button>
                <button
                  className={styles.iconBtn}
                  title="Régler"
                  onClick={() => setExpanded(open ? null : item.id)}
                >{open ? '−' : '⚙'}</button>
                <button
                  className={`${styles.iconBtn} ${styles.danger}`}
                  title="Retirer"
                  onClick={() => remove(item.id)}
                >✕</button>
              </div>

              {open && (
                <div className={styles.details}>
                  <span className={styles.detailLabel}>Remplacer l'image</span>
                  <input
                    type="file"
                    accept="image/*"
                    className={menu.input}
                    onChange={async e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const bytes = new Uint8Array(await file.arrayBuffer())
                      const key = generateMediaKey(file.name)
                      registerMedia(key, bytes, file.type)
                      patch(item.id, { src: key })
                    }}
                  />

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

      <div className={styles.add}>
        <input
          type="file"
          accept="image/*"
          multiple
          className={menu.input}
          onChange={e => { if (e.target.files) void addFiles(e.target.files) }}
        />
      </div>
    </div>
  )
}