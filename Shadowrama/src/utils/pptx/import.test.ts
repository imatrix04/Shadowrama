import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { PptxFormatError, formatImportReport, importPptx } from './import'
import type { ShapeBlockData, TextBlockData, TitleBlockData } from '../../types'

const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
  + 'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function rels(entries: [string, string, string][]): string {
  return '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + entries.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')
    + '</Relationships>'
}

const THEME = `<a:theme ${NS}><a:themeElements><a:clrScheme name="t">
  <a:dk1><a:srgbClr val="111111"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
  <a:dk2><a:srgbClr val="222222"/></a:dk2><a:lt2><a:srgbClr val="EEEEEE"/></a:lt2>
  <a:accent1><a:srgbClr val="FF0000"/></a:accent1><a:accent2><a:srgbClr val="00FF00"/></a:accent2>
  <a:accent3><a:srgbClr val="0000FF"/></a:accent3><a:accent4><a:srgbClr val="FFFF00"/></a:accent4>
  <a:accent5><a:srgbClr val="00FFFF"/></a:accent5><a:accent6><a:srgbClr val="FF00FF"/></a:accent6>
  <a:hlink><a:srgbClr val="0000EE"/></a:hlink><a:folHlink><a:srgbClr val="551A8B"/></a:folHlink>
</a:clrScheme><a:fontScheme name="f"><a:majorFont><a:latin typeface="Major"/></a:majorFont>
<a:minorFont><a:latin typeface="Minor"/></a:minorFont></a:fontScheme></a:themeElements></a:theme>`

const MASTER = `<p:sldMaster ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>
  <p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="10363200" cy="914400"/></a:xfrm></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>
</p:spTree></p:cSld>
<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
<p:txStyles><p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="4000" b="1"><a:solidFill><a:schemeClr val="accent1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle>
<p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`

const LAYOUT = `<p:sldLayout ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`

interface Opts {
  slides: string[]
  size?: [number, number]
  extra?: Record<string, string | Uint8Array>
  slideRels?: string
}

async function build({ slides, size = [12192000, 6858000], extra = {}, slideRels }: Opts): Promise<Uint8Array> {
  const zip = new JSZip()
  zip.file('ppt/presentation.xml', `<p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="1" r:id="rM"/></p:sldMasterIdLst>`
    + `<p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rS${i}"/>`).join('')}</p:sldIdLst>`
    + `<p:sldSz cx="${size[0]}" cy="${size[1]}"/></p:presentation>`)
  zip.file('ppt/_rels/presentation.xml.rels', rels([
    ['rM', 'slideMaster', 'slideMasters/slideMaster1.xml'],
    ...slides.map((_, i): [string, string, string] => [`rS${i}`, 'slide', `slides/slide${i + 1}.xml`]),
  ]))
  zip.file('ppt/slideMasters/slideMaster1.xml', MASTER)
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rT', 'theme', '../theme/theme1.xml']]))
  zip.file('ppt/theme/theme1.xml', THEME)
  zip.file('ppt/slideLayouts/slideLayout1.xml', LAYOUT)
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rM', 'slideMaster', '../slideMasters/slideMaster1.xml']]))
  slides.forEach((body, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, `<p:sld ${NS}>${body}</p:sld>`)
    zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`,
      slideRels ?? rels([['rL', 'slideLayout', '../slideLayouts/slideLayout1.xml']]))
  })
  for (const [name, data] of Object.entries(extra)) zip.file(name, data)
  return zip.generateAsync({ type: 'uint8array' })
}

const tree = (inner: string, bg = '') =>
  `<p:cSld>${bg}<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${inner}</p:spTree></p:cSld>`

const textBox = (x: number, y: number, cx: number, cy: number, runs: string, extra = '') =>
  `<p:sp><p:nvSpPr><p:cNvPr id="9" name="x"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>`
  + `<p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" ${extra}/><a:lstStyle/>${runs}</p:txBody></p:sp>`

describe('importPptx', () => {
  it("refuse un fichier qui n'est pas un pptx", async () => {
    await expect(importPptx(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(PptxFormatError)
    const zip = new JSZip()
    zip.file('hello.txt', 'x')
    await expect(importPptx(await zip.generateAsync({ type: 'uint8array' }))).rejects.toBeInstanceOf(PptxFormatError)
  })

  it('convertit position et taille de 12 700 EMU par pixel', async () => {
    const data = await build({
      slides: [tree(textBox(1270000, 635000, 2540000, 635000,
        '<a:p><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="FF8800"/></a:solidFill></a:rPr><a:t>Salut</a:t></a:r></a:p>'))],
    })
    const { slides, report } = await importPptx(data)
    const block = slides[0].blocks[0] as TextBlockData
    // Les insets sont nuls : le bloc est décalé du remplissage interne du composant (6 px / 4 px).
    expect(block).toMatchObject({ type: 'text', content: 'Salut', fontSize: 24, color: '#ff8800', fontWeight: 'bold' })
    expect(block.x).toBe(100 - 6)
    expect(block.y).toBe(50 - 4)
    expect(block.width).toBe(200 + 12)
    expect(report.slideCount).toBe(1)
  })

  it('hérite position, taille et couleur du modèle pour un titre sans xfrm', async () => {
    const title = '<p:sp><p:nvSpPr><p:cNvPr id="2" name="t"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>'
      + '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr/><a:t>Mon titre</a:t></a:r></a:p></p:txBody></p:sp>'
    const { slides, report } = await importPptx(await build({ slides: [tree(title)] }))
    const block = slides[0].blocks[0] as TitleBlockData
    expect(block.type).toBe('title')
    expect(block.fontSize).toBe(40)
    expect(block.fontWeight).toBe('bold')
    expect(block.textAlign).toBe('center')
    expect(block.color).toBe('#ff0000') // accent1 du thème
    expect(block.y).toBeCloseTo(36 + 3.6 - 4, 1)
    expect(report.fonts).toContain('Major')
  })

  it('aplatit un groupe en recalculant les positions', async () => {
    const group = '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="3" name="g"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
      + '<p:grpSpPr><a:xfrm><a:off x="1270000" y="1270000"/><a:ext cx="2540000" cy="2540000"/><a:chOff x="0" y="0"/><a:chExt cx="1270000" cy="1270000"/></a:xfrm></p:grpSpPr>'
      + '<p:sp><p:nvSpPr><p:cNvPr id="4" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="635000" y="635000"/><a:ext cx="635000" cy="635000"/></a:xfrm><a:prstGeom prst="ellipse"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="00FF00"/></a:solidFill></p:spPr></p:sp></p:grpSp>'
    const { slides } = await importPptx(await build({ slides: [tree(group)] }))
    const shape = slides[0].blocks[0] as ShapeBlockData
    expect(shape).toMatchObject({ shape: 'circle', backgroundColor: '#00ff00' })
    // Groupe à l'échelle 2 : (100 + 50·2, 100 + 50·2), 100 px de côté.
    expect([shape.x, shape.y, shape.width, shape.height]).toEqual([200, 200, 100, 100])
  })

  it('convertit fonds, dégradés, arrondis et bordures', async () => {
    const card = '<p:sp><p:nvSpPr><p:cNvPr id="5" name="c"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="2540000" cy="1270000"/></a:xfrm>'
      + '<a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 10000"/></a:avLst></a:prstGeom><a:solidFill><a:srgbClr val="112233"/></a:solidFill>'
      + '<a:ln w="25400"><a:solidFill><a:srgbClr val="445566"/></a:solidFill></a:ln></p:spPr></p:sp>'
    const bg = '<p:bg><p:bgPr><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="000000"/></a:gs><a:gs pos="100000"><a:srgbClr val="FFFFFF"/></a:gs></a:gsLst><a:lin ang="5400000"/></a:gradFill></p:bgPr></p:bg>'
    const { slides } = await importPptx(await build({ slides: [tree(card, bg)] }))
    expect(slides[0].background).toEqual({
      type: 'gradient', color: '#000000', gradient: { from: '#000000', to: '#ffffff', angle: 180 },
    })
    expect(slides[0].blocks[0]).toMatchObject({
      shape: 'rectangle', borderRadius: 10, borderColor: '#445566', borderWidth: 2, backgroundColor: '#112233',
    })
  })

  it('importe les images et signale celles qu\'on ne sait pas lire', async () => {
    const pic = (id: string) => `<p:pic><p:nvPicPr><p:cNvPr id="6" name="i" descr="logo"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${id}"/><a:stretch/></p:blipFill>`
      + '<p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1270000" cy="1270000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
    const data = await build({
      slides: [tree(pic('rI') + pic('rV'))],
      slideRels: rels([
        ['rL', 'slideLayout', '../slideLayouts/slideLayout1.xml'],
        ['rI', 'image', '../media/a.png'],
        ['rV', 'image', '../media/b.emf'],
      ]),
      extra: { 'ppt/media/a.png': new Uint8Array([137, 80, 78, 71]), 'ppt/media/b.emf': new Uint8Array([1, 2]) },
    })
    const { slides, media, report } = await importPptx(data)
    expect(media).toHaveLength(1)
    expect(media[0]).toMatchObject({ key: 'media/pptx-1.png', mimeType: 'image/png' })
    expect(slides[0].blocks).toHaveLength(1)
    expect(slides[0].blocks[0]).toMatchObject({ type: 'image', src: 'media/pptx-1.png', alt: 'logo', width: 100 })
    expect(report.issues.some(i => i.slide === 1 && /image/.test(i.message))).toBe(true)
  })

  it('signale tableaux et graphiques au lieu de les perdre en silence', async () => {
    const frame = (uri: string) => '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="7" name="f"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>'
      + `<a:graphic><a:graphicData uri="${uri}"/></a:graphic></p:graphicFrame>`
    const { slides, report } = await importPptx(await build({
      slides: [tree(frame('http://schemas.openxmlformats.org/drawingml/2006/table') + frame('http://schemas.openxmlformats.org/drawingml/2006/chart'))],
    }))
    expect(slides[0].blocks).toHaveLength(0)
    const messages = report.issues.map(i => i.message).join(' ')
    expect(messages).toMatch(/tableau/)
    expect(messages).toMatch(/graphique/)
  })

  it('met en page plusieurs styles dans un même cadre, de haut en bas', async () => {
    const runs = '<a:p><a:r><a:rPr sz="2000" b="1"/><a:t>Titre</a:t></a:r></a:p>'
      + '<a:p><a:r><a:rPr sz="1200"/><a:t>Détail</a:t></a:r></a:p>'
    const { slides } = await importPptx(await build({ slides: [tree(textBox(0, 0, 5080000, 2540000, runs))] }))
    const [a, b] = slides[0].blocks as TextBlockData[]
    expect(slides[0].blocks).toHaveLength(2)
    expect([a.fontSize, b.fontSize]).toEqual([20, 12])
    expect(b.y).toBeGreaterThan(a.y)
  })

  it('ajuste une diapositive 4:3 sur la scène 16:9 en la centrant', async () => {
    const { slides, report } = await importPptx(await build({
      size: [9144000, 6858000],
      slides: [tree(textBox(0, 0, 1270000, 635000, '<a:p><a:r><a:rPr/><a:t>x</a:t></a:r></a:p>'))],
    }))
    // 4:3 → 720 px de large, centrés : décalage de 120 px.
    expect((slides[0].blocks[0] as TextBlockData).x).toBe(120 - 6)
    expect(report.issues.some(i => /16:9/.test(i.message))).toBe(true)
  })

  it('traduit une transition PowerPoint', async () => {
    const body = tree('') + '<p:transition spd="med"><p:fade/></p:transition>'
    const { slides } = await importPptx(await build({ slides: [body] }))
    expect(slides[0].transition?.preset).toBe('fade')
  })
})

describe('formatImportReport', () => {
  it('résume sans remarque quand tout est converti', () => {
    expect(formatImportReport({ slideCount: 1, blockCount: 1, issues: [], fonts: [] }))
      .toBe('1 diapositive et 1 élément importés.')
  })

  it('liste les remarques avec leur diapositive', () => {
    const text = formatImportReport({
      slideCount: 2, blockCount: 5, fonts: [],
      issues: [{ slide: 2, message: 'Un tableau a été ignoré.' }, { slide: null, message: 'Remarque globale.' }],
    })
    expect(text).toContain('• Diapo 2 : Un tableau a été ignoré.')
    expect(text).toContain('• Remarque globale.')
  })
})