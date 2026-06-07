import type { BlockData } from '../../types'

interface Props {
  block: BlockData
}

export default function TitleBlock({ block }: Props) {
  return (
    <h1 style={{ margin: 0, fontSize: block.fontSize, color: block.color, wordBreak: 'break-word' }}>
      {block.content}
    </h1>
  )
}