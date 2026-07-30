import { createTextualBlock } from './createTextualBlock'

// Le gras vient désormais de `defaultProps` (title.config.ts) et reste donc
// modifiable, au lieu d'être figé dans le composant.
export default createTextualBlock(40)
