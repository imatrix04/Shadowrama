import type { BlockData } from '../../types'

interface Props {
  block: BlockData
}

export default function ShapeBlock({ block }: Props) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: block.backgroundColor, borderRadius: '4px' }} />
  )
}