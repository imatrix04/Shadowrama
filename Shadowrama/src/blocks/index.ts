import type { BlockConfig, BlockComponentProps } from '../types'
import type { ComponentType } from 'react'

import textConfig from './configs/text.config'
import titleConfig from './configs/title.config'
import imageConfig from './configs/image.config'
import shapeConfig from './configs/shape.config'

import TextBlock from './registry/TextBlock'
import TitleBlock from './registry/TitleBlock'
import ImageBlock from './registry/ImageBlock'
import ShapeBlock from './registry/ShapeBlock'

export const BLOCKS_CONFIG: BlockConfig[] = [
  textConfig,
  titleConfig,
  imageConfig,
  shapeConfig,
]

export const BLOCKS_REGISTRY: Record<string, ComponentType<BlockComponentProps>> = {
  text: TextBlock,
  title: TitleBlock,
  image: ImageBlock,
  shape: ShapeBlock,
}