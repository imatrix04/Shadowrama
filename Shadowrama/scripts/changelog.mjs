#!/usr/bin/env node
/**
 * Génère les notes de version à partir de `changelog.json`, source unique.
 *
 *   node scripts/changelog.mjs check            vérifie la cohérence des versions
 *   node scripts/changelog.mjs release-notes    écrit release-notes.md (corps de la release GitHub)
 *   node scripts/changelog.mjs readme           réécrit la section « Changelog » du README
 *   node scripts/changelog.mjs all              les trois
 *
 * Le fichier release-notes.md est référencé par `build.releaseInfo.releaseNotesFile`
 * dans package.json : electron-builder le publie comme corps de la release, et
 * electron-updater le ressert à l'application AVANT la mise à jour.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHANGELOG = join(root, 'changelog.json')
const RELEASE_NOTES = join(root, 'release-notes.md')
// La documentation vit à la racine du dépôt : Shadowrama/README.md est ignoré
// par git (voir .gitignore), y écrire ne produirait qu'un doublon mort.
const REPO_ROOT = join(root, '..')

const SECTIONS = [
  ['added', 'Nouveautés'],
  ['changed', 'Améliorations'],
  ['fixed', 'Corrections'],
]

function loadReleases() {
  const { releases } = JSON.parse(readFileSync(CHANGELOG, 'utf8'))
  if (!Array.isArray(releases) || releases.length === 0) {
    throw new Error('changelog.json ne contient aucune version.')
  }
  return releases
}

function packageVersion() {
  return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
}

/** Corps markdown d'une version, sans son titre. */
function renderBody(release) {
  const parts = []

  // Les nouveautés du mode Ultra Design sont distinguées : en markdown on ne
  // dispose pas des couleurs de l'écran « Nouveautés », le repère est donc
  // typographique et explicite.
  for (const { title, body, ultra } of release.highlights ?? []) {
    parts.push(
      ultra
        ? `> **✦ ${title}** *(Ultra Design)*\n>\n> ${body}`
        : `**${title}** — ${body}`
    )
  }

  for (const [key, label] of SECTIONS) {
    const items = release[key]
    if (!items?.length) continue
    parts.push(`### ${label}\n${items.map(i => `- ${i}`).join('\n')}`)
  }

  // Une version sans détail (maintenance) doit tout de même produire du texte,
  // sinon la release GitHub est vide et l'écran d'avant-MAJ n'affiche rien.
  if (parts.length === 0 && release.summary) parts.push(release.summary)

  return parts.join('\n\n')
}

function renderRelease(release, { heading }) {
  return `${heading}\n\n${renderBody(release)}`
}

// ── Commandes ───────────────────────────────────────────────────────────────

/**
 * @param expected version à publier. Fournie par release.bat AVANT tout commit,
 *   pour échouer pendant qu'il est encore temps ; sinon on contrôle package.json.
 */
function check(releases, expected) {
  const version = expected ?? packageVersion()
  const versions = releases.map(r => r.version)
  const problems = []

  if (versions[0] !== version) {
    problems.push(
      `La version à publier est ${version}, mais la plus récente de changelog.json est ${versions[0]}.\n`
      + `    Ajoutez une entrée « ${version} » en tête de changelog.json avant de publier.`
    )
  }
  const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i)
  if (duplicates.length) problems.push(`Versions en double : ${duplicates.join(', ')}.`)

  for (const release of releases) {
    if (!/^\d+\.\d+\.\d+$/.test(release.version)) {
      problems.push(`Version mal formée : « ${release.version} ».`)
    }
    if (!release.date) problems.push(`Version ${release.version} sans date.`)
  }

  if (problems.length) {
    console.error('Changelog incohérent :')
    for (const p of problems) console.error(`  - ${p}`)
    process.exit(1)
  }
  console.log(`changelog.json cohérent (version : ${version}).`)
}

function writeReleaseNotes(releases) {
  const version = packageVersion()
  const release = releases.find(r => r.version === version)
  if (!release) {
    console.error(`Aucune entrée pour la version ${version} dans changelog.json.`)
    process.exit(1)
  }
  // Pas de titre de version : GitHub affiche déjà le nom de la release au-dessus.
  writeFileSync(RELEASE_NOTES, `${renderBody(release)}\n`, 'utf8')
  console.log(`release-notes.md écrit pour la version ${version}.`)
}

function writeReadme(releases) {
  const body = releases
    .map(r => renderRelease(r, { heading: `## ${r.version} — ${r.date}` }))
    .join('\n\n')

  const section = `# Changelog\n\n<!-- Généré depuis changelog.json par \`npm run changelog\`. Ne pas éditer à la main. -->\n\n${body}\n`

  // Le README ne garde qu'un résumé de la dernière version et renvoie au reste.
  const latest = releases[0]
  const readmeSection = [
    '## Changelog',
    '',
    `Dernière version : **${latest.version}** (${latest.date}).`,
    '',
    renderBody(latest),
    '',
    'Historique complet : [CHANGELOG.md](CHANGELOG.md).',
    '',
  ].join('\n')

  writeFileSync(join(REPO_ROOT, 'CHANGELOG.md'), section, 'utf8')

  const readmePath = join(REPO_ROOT, 'README.md')
  const readme = readFileSync(readmePath, 'utf8')
  // Remplace tout ce qui suit « ## Changelog » jusqu'à la fin du fichier.
  const marker = readme.indexOf('## Changelog')
  writeFileSync(
    readmePath,
    marker === -1 ? `${readme.trimEnd()}\n\n${readmeSection}` : `${readme.slice(0, marker)}${readmeSection}`,
    'utf8'
  )
  console.log('README.md et CHANGELOG.md mis à jour à la racine du dépôt.')
}

const command = process.argv[2] ?? 'all'
const expectedVersion = process.argv[3]
const releases = loadReleases()

if (command === 'check') check(releases, expectedVersion)
else if (command === 'release-notes') writeReleaseNotes(releases)
else if (command === 'readme') writeReadme(releases)
else if (command === 'all') {
  check(releases, expectedVersion)
  writeReleaseNotes(releases)
  writeReadme(releases)
} else {
  console.error(`Commande inconnue : ${command}`)
  process.exit(1)
}
