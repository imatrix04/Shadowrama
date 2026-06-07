import { useState } from 'react'
import { BLOCKS_CONFIG } from '../blocks'
import type { BlockData, Slide } from '../types'
import Canvas from '../components/editor/Canvas'
import Sidebar from '../components/editor/Sidebar'

export default function Editor() {
  const [slides, setSlides] = useState<Slide[]>([{ id: 1, blocks: [] }])
  const [currentSlide] = useState(0)
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)

  // selectedBlock est toujours lu depuis slides → se met à jour automatiquement
  const selectedBlock = slides[currentSlide].blocks.find(b => b.id === selectedBlockId) ?? null

  const addBlock = (block: Partial<BlockData> & { type: string }) => {
    const config = BLOCKS_CONFIG.find(c => c.type === block.type)
    if (!config) return

    const newBlock: BlockData = {
      x: 100,
      y: 100,
      width: 200,
      height: 60,
      ...config.defaultProps,
      ...block,
      id: Date.now(),
      properties: config.properties,
    }

    const updated = slides.map((s, i) =>
      i === currentSlide ? { ...s, blocks: [...s.blocks, newBlock] } : s
    )
    setSlides(updated)
  }

  const updateBlock = (id: number, changes: Partial<BlockData>) => {
    const updated = slides.map((s, i) =>
      i === currentSlide
        ? { ...s, blocks: s.blocks.map(b => b.id === id ? { ...b, ...changes } : b) }
        : s
    )
    setSlides(updated)
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#1a1a2e', color: '#fff' }}>
      <Sidebar onAddBlock={addBlock} />
      <Canvas
        blocks={slides[currentSlide].blocks}
        selectedBlock={selectedBlock}
        onSelectBlock={(block) => setSelectedBlockId(block?.id ?? null)}
        onUpdateBlock={updateBlock}
      />
    </div>
  )
}