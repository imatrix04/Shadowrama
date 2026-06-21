import type { BlockComponentProps, ShapeBlockData } from '../../types'

export default function ShapeBlock({ block }: BlockComponentProps<ShapeBlockData>) {
  const shape = block.shape ?? 'rectangle'
  const borderWidth = block.borderWidth ?? 0
  const offset = -borderWidth / 2

  const isSvgShape = ['triangle', 'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right'].includes(shape)

  if (isSvgShape) {
    const fill = block.backgroundColor ?? '#6c63ff'
    const stroke = borderWidth > 0 ? (block.borderColor ?? '#ffffff') : 'none'
    const width = block.width
    const height = block.height

    let points = ''
    if (shape === 'triangle') {
      points = `${width / 2},0 0,${height} ${width},${height}`
    } else if (shape === 'arrow-up') {
      points = `${width / 2},0 ${width},${height / 2} ${width * 0.7},${height / 2} ${width * 0.7},${height} ${width * 0.3},${height} ${width * 0.3},${height / 2} 0,${height / 2}`
    } else if (shape === 'arrow-down') {
      points = `${width / 2},${height} ${width},${height / 2} ${width * 0.7},${height / 2} ${width * 0.7},0 ${width * 0.3},0 ${width * 0.3},${height / 2} 0,${height / 2}`
    } else if (shape === 'arrow-right') {
      points = `${width},${height / 2} ${width / 2},${height} ${width / 2},${height * 0.7} 0,${height * 0.7} 0,${height * 0.3} ${width / 2},${height * 0.3} ${width / 2},0`
    } else if (shape === 'arrow-left') {
      points = `0,${height / 2} ${width / 2},${height} ${width / 2},${height * 0.7} ${width},${height * 0.7} ${width},${height * 0.3} ${width / 2},${height * 0.3} ${width / 2},0`
    }

    return (
      <svg
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          overflow: 'visible',
          opacity: block.opacity ?? 1,
        }}
      >
        <polygon
          points={points}
          fill={fill}
          stroke={stroke}
          strokeWidth={borderWidth}
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // Rendu Rectangle ou Cercle en HTML/CSS standard
  const borderRadius = shape === 'circle' ? '50%' : `${block.borderRadius ?? 4}px`

  return (
    <div style={{
      position: 'absolute',
      top: offset,
      left: offset,
      right: offset,
      bottom: offset,
      backgroundColor: block.backgroundColor ?? '#6c63ff',
      borderRadius: borderRadius,
      border: borderWidth > 0 
        ? `${borderWidth}px solid ${block.borderColor ?? '#ffffff'}` 
        : 'none',
      opacity: block.opacity ?? 1,
      boxSizing: 'border-box',
    }} />
  )
}