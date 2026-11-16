/**
 * Lance Vitest depuis un dossier courant à la lettre de lecteur MAJUSCULE.
 *
 * Sous Windows, le terminal de VS Code ouvre le projet en `c:\…` (minuscule).
 * Vitest se charge alors sous deux chemins qui ne diffèrent que par la casse,
 * donc en deux instances, et tous les fichiers de test échouent sur
 * « Cannot read properties of undefined (reading 'config') » — sans rapport avec
 * le code testé. Corriger le dossier courant AVANT de charger Vitest règle le
 * problème ; ailleurs que sous Windows, ce script ne change rien.
 *
 * Usage : node scripts/vitest.mjs run   (mêmes arguments que `vitest`)
 */
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const cwd = process.cwd().replace(/^[a-z]:/, drive => drive.toUpperCase())
if (cwd !== process.cwd()) process.chdir(cwd)

await import(pathToFileURL(join(cwd, 'node_modules', 'vitest', 'vitest.mjs')).href)
