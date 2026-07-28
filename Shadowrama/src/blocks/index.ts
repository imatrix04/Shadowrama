import type { BlockConfig, BlockComponentProps, BlockData, BlockProperty } from '../types'
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
  text: TextBlock as ComponentType<BlockComponentProps>,
  title: TitleBlock as ComponentType<BlockComponentProps>,
  image: ImageBlock as ComponentType<BlockComponentProps>,
  shape: ShapeBlock as ComponentType<BlockComponentProps>,
}

const CONFIG_BY_TYPE = new Map(BLOCKS_CONFIG.map(c => [c.type, c]))

export function getBlockConfig(type: string): BlockConfig | undefined {
  return CONFIG_BY_TYPE.get(type as BlockData['type'])
}

/**
 * Champs éditables d'un bloc, résolus à l'affichage depuis sa config.
 * Source de vérité unique : faire évoluer un `*.config.ts` s'applique aussi
 * aux projets déjà enregistrés.
 */
export function getBlockProperties(type: string): BlockProperty[] {
  return CONFIG_BY_TYPE.get(type as BlockData['type'])?.properties ?? []
}

export function isKnownBlockType(type: unknown): type is BlockData['type'] {
  return typeof type === 'string' && CONFIG_BY_TYPE.has(type as BlockData['type'])
}