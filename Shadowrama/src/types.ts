export interface BlockProperty {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'color'
}

export interface BlockData {
  id: number
  type: string
  x: number
  y: number
  width: number
  height: number
  properties?: BlockProperty[]
  [key: string]: any
}

export interface BlockConfig {
  type: string
  label: string
  defaultProps: Partial<BlockData>
  properties: BlockProperty[]
}

export interface BlockComponentProps {
  block: BlockData
  onUpdate?: (id: number, changes: Partial<BlockData>) => void
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
}

export interface Slide {
  id: number
  blocks: BlockData[]
}