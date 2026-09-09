import type { BlockComponentProps, ImageBlockData } from '../../types'
import ImageSurface from './ImageSurface'

/** Le rendu vit dans ImageSurface, partagé avec les vues du carrousel. */
export default function ImageBlock({ block }: BlockComponentProps<ImageBlockData>) {
  return <ImageSurface data={block} width={block.width} height={block.height} />
}