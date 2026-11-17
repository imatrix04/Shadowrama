/**
 * Parties fixes d'un .pptx : thème, masque, mise en page, propriétés.
 *
 * PowerPoint refuse (« fichier à réparer ») un paquet auquel il manque l'une de
 * ces pièces, même si les diapositives n'en dépendent pas : toute diapositive
 * pointe vers une mise en page, qui pointe vers un masque, qui pointe vers un
 * thème. On fournit donc le strict minimum valide — une mise en page vide —
 * et tout le contenu vit dans les diapositives elles-mêmes.
 */

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

export const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  p14: 'http://schemas.microsoft.com/office/powerpoint/2010/main',
}

export const NS_ATTRS = `xmlns:a="${NS.a}" xmlns:r="${NS.r}" xmlns:p="${NS.p}"`

export const REL = {
  officeDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  coreProps: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties',
  appProps: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties',
  slideMaster: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster',
  slideLayout: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
  slide: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
  theme: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
  image: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  video: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
  media: 'http://schemas.microsoft.com/office/2007/relationships/media',
}

/** Échappe un texte pour un contenu ou un attribut XML. */
export function esc(text: string): string {
  return text
    // Caractères de contrôle interdits en XML 1.0 : un seul suffit à rendre le
    // fichier illisible.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface Relationship {
  id: string
  type: string
  target: string
  external?: boolean
}

export function relsXml(rels: Relationship[]): string {
  const items = rels.map(r =>
    `<Relationship Id="${r.id}" Type="${r.type}" Target="${esc(r.target)}"${r.external ? ' TargetMode="External"' : ''}/>`)
  return `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.join('')}</Relationships>`
}

/** Arbre de formes vide : l'en-tête obligatoire de tout `spTree`. */
export const TREE_HEAD =
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
  + '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

export function contentTypesXml(slideCount: number, extensions: Map<string, string>): string {
  const defaults = [
    ['rels', 'application/vnd.openxmlformats-package.relationships+xml'],
    ['xml', 'application/xml'],
    ...extensions,
  ].map(([ext, type]) => `<Default Extension="${ext}" ContentType="${type}"/>`)

  const pml = 'application/vnd.openxmlformats-officedocument.presentationml'
  const overrides = [
    ['/ppt/presentation.xml', `${pml}.presentation.main+xml`],
    ['/ppt/slideMasters/slideMaster1.xml', `${pml}.slideMaster+xml`],
    ['/ppt/slideLayouts/slideLayout1.xml', `${pml}.slideLayout+xml`],
    ['/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml'],
    ['/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml'],
    ['/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml'],
    ...Array.from({ length: slideCount }, (_, i) => [`/ppt/slides/slide${i + 1}.xml`, `${pml}.slide+xml`]),
  ].map(([part, type]) => `<Override PartName="${part}" ContentType="${type}"/>`)

  return `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join('')}${overrides.join('')}</Types>`
}

export function rootRelsXml(): string {
  return relsXml([
    { id: 'rId1', type: REL.officeDocument, target: 'ppt/presentation.xml' },
    { id: 'rId2', type: REL.coreProps, target: 'docProps/core.xml' },
    { id: 'rId3', type: REL.appProps, target: 'docProps/app.xml' },
  ])
}

export function corePropsXml(title: string, now: Date): string {
  const stamp = now.toISOString().replace(/\.\d+Z$/, 'Z')
  return `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`
    + `<dc:title>${esc(title)}</dc:title><dc:creator>Shadowrama</dc:creator>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${stamp}</dcterms:created>`
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${stamp}</dcterms:modified>`
    + '</cp:coreProperties>'
}

export function appPropsXml(slideCount: number): string {
  return `${XML_HEAD}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">`
    + `<Application>Shadowrama</Application><Slides>${slideCount}</Slides></Properties>`
}

/** Dimensions de la scène : 960 × 540 px, à 12 700 EMU le pixel — soit le 16:9
 *  standard de PowerPoint (13,333 × 7,5 pouces), où 1 px vaut 1 point. */
export const SLIDE_CX = 12192000
export const SLIDE_CY = 6858000

export function presentationXml(slideCount: number, firstSlideNum: number): string {
  const ids = Array.from({ length: slideCount }, (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('')
  return `${XML_HEAD}<p:presentation ${NS_ATTRS} saveSubsetFonts="1"${firstSlideNum !== 1 ? ` firstSlideNum="${firstSlideNum}"` : ''}>`
    + '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>'
    + (ids ? `<p:sldIdLst>${ids}</p:sldIdLst>` : '')
    + `<p:sldSz cx="${SLIDE_CX}" cy="${SLIDE_CY}"/><p:notesSz cx="${SLIDE_CY}" cy="9144000"/>`
    + '</p:presentation>'
}

export function presentationRelsXml(slideCount: number): string {
  return relsXml([
    { id: 'rId1', type: REL.slideMaster, target: 'slideMasters/slideMaster1.xml' },
    ...Array.from({ length: slideCount }, (_, i) => ({
      id: `rId${i + 2}`, type: REL.slide, target: `slides/slide${i + 1}.xml`,
    })),
    { id: `rId${slideCount + 2}`, type: REL.theme, target: 'theme/theme1.xml' },
  ])
}

const CLR_MAP = '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>'

export function slideMasterXml(): string {
  return `${XML_HEAD}<p:sldMaster ${NS_ATTRS}>`
    + '<p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
    + `<p:spTree>${TREE_HEAD}</p:spTree></p:cSld>`
    + CLR_MAP
    + '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>'
    + '</p:sldMaster>'
}

export function slideMasterRelsXml(): string {
  return relsXml([
    { id: 'rId1', type: REL.slideLayout, target: '../slideLayouts/slideLayout1.xml' },
    { id: 'rId2', type: REL.theme, target: '../theme/theme1.xml' },
  ])
}

export function slideLayoutXml(): string {
  return `${XML_HEAD}<p:sldLayout ${NS_ATTRS} type="blank" preserve="1">`
    + `<p:cSld name="Vide"><p:spTree>${TREE_HEAD}</p:spTree></p:cSld>`
    + '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
    + '</p:sldLayout>'
}

export function slideLayoutRelsXml(): string {
  return relsXml([{ id: 'rId1', type: REL.slideMaster, target: '../slideMasters/slideMaster1.xml' }])
}

/** Police des blocs de texte : celle de l'interface sous Windows. */
export const FONT = 'Segoe UI'

export function themeXml(): string {
  const clr = (name: string, hex: string) => `<a:${name}><a:srgbClr val="${hex}"/></a:${name}>`
  const font = `<a:latin typeface="${FONT}"/><a:ea typeface=""/><a:cs typeface=""/>`
  const fill = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>'
  const line = (w: number) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`
  const effect = '<a:effectStyle><a:effectLst/></a:effectStyle>'

  return `${XML_HEAD}<a:theme xmlns:a="${NS.a}" name="Shadowrama"><a:themeElements>`
    + '<a:clrScheme name="Shadowrama">'
    + '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
    + clr('dk2', '1A1A2E') + clr('lt2', 'F7F6FB')
    + clr('accent1', '6C63FF') + clr('accent2', '00D4FF') + clr('accent3', 'FF6B6B')
    + clr('accent4', 'FECA57') + clr('accent5', 'C471ED') + clr('accent6', '3B82F6')
    + clr('hlink', '6C63FF') + clr('folHlink', '8B84FF')
    + '</a:clrScheme>'
    + `<a:fontScheme name="Shadowrama"><a:majorFont>${font}</a:majorFont><a:minorFont>${font}</a:minorFont></a:fontScheme>`
    + '<a:fmtScheme name="Shadowrama">'
    + `<a:fillStyleLst>${fill}${fill}${fill}</a:fillStyleLst>`
    + `<a:lnStyleLst>${line(6350)}${line(12700)}${line(19050)}</a:lnStyleLst>`
    + `<a:effectStyleLst>${effect}${effect}${effect}</a:effectStyleLst>`
    + `<a:bgFillStyleLst>${fill}${fill}${fill}</a:bgFillStyleLst>`
    + '</a:fmtScheme>'
    + '</a:themeElements></a:theme>'
}
