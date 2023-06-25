import type { Map } from '@geolonia/embed';

export const bboxSourceId = 'bbox2svg__bbox-polygon-draft'
const lineLayerId = 'bbox2svg__bbox-polygon-draft-layer-line'
const fillLayerId = 'bbox2svg__bbox-polygon-draft-layer-fill'

let point1: number[] | null = null
let point2: number[] | null = null

export const unselectPoints = (map: Map) => {
  const lineLayer = map.getLayer(lineLayerId)
  const fillLayer = map.getLayer(fillLayerId)
  if(fillLayer) {
    map.removeLayer(fillLayerId)
  }
  if(lineLayer) {
    map.removeLayer(lineLayerId)
  }
  point1 = null
  point2 = null
}

export const selectOneOfThePoints = (map: Map, point: number[], point2SelectionCallback: () => void) => {
  const lineLayer = map.getLayer(lineLayerId)
  const fillLayer = map.getLayer(fillLayerId)
  if(
    (!point1 && !point2) ||
    (point1 && point2)
  ) {
    point1 = point
    point2 = null
    if(fillLayer) {
      map.removeLayer(fillLayerId)
    }
    if(lineLayer) {
      map.removeLayer(lineLayerId)
    }
  } else {
    point2 = point
    // 同じ場所をクリックした
    if(point1 && point2 && point1[0] === point2[0] && point1[1] === point2[1]) return

    map.addLayer({
      id: fillLayerId,
      source: bboxSourceId,
      type: 'fill',
      paint: {
        'fill-color': "red",
        'fill-opacity': .2,
      }
    })
    point2SelectionCallback()
  }
}

export const moveToPoint2 = (map: Map, cursor: number[]) => {
  if(!point1) return
  const left = Math.min(cursor[0], point1[0])
  const right = Math.max(cursor[0], point1[0])
  const top = Math.max(cursor[1], point1[1])
  const bottom = Math.min(cursor[1], point1[1])
  const bbox = [[left, top], [right, top], [right, bottom], [left, bottom], [left, top]]
  const geojson = {
    type: 'FeatureCollection',
    properties: {},
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [bbox],
        }
      }
    ],
  }

  const source = map.getSource(bboxSourceId)
  const lineLayer = map.getLayer(lineLayerId)
  if(!source) {
    map.addSource(bboxSourceId, { type: 'geojson', data: geojson })
  } else if(!point2) {
    // @ts-ignore
    source.setData(geojson)
  }

  if(!lineLayer) {
    map.addLayer({
      id: lineLayerId,
      source: bboxSourceId,
      type: 'line',
      paint: {
        'line-color': 'red',
        'line-width': 3,
        "line-dasharray": [3, 1],
      }
    })
   }
}

export type ExportAttribution = {
  html: string
  text: string
  links: {
    href: string
    text: string
  }[]
}

/**
 * @param map
 * @returns HTML attribution string list
 */
export const getCurrentAttributions = (map: Map): ExportAttribution[] => {
  let attributions: Array<string> = []

  const sources = map.style.sourceCaches
  for (const id in sources) {
    const sourceCache = sources[id]
    if (sourceCache.used) {
      const source = sourceCache.getSource()
      if (source.attribution && attributions.indexOf(source.attribution) < 0) {
        attributions.push(source.attribution)
      }
    }
  }

  // remove any entries that are substrings of another entry.
  // first sort by length so that substrings come first
  attributions.sort((a, b) => a.length - b.length)
  attributions = attributions
    .filter((attrib, i) => {
      for (let j = i + 1; j < attributions.length; j++) {
        if (attributions[j].indexOf(attrib) >= 0) {
          return false
        }
      }
      return true
    })
    .map((attrib) => attrib.split('|'))
    .flat()
    .map((attrib) => attrib.trim())

  const attributionItems: {
    html: string
    text: string
    links: { href: string; text: string }[]
  }[] = []

  for (const attrib of attributions) {
    const html = attrib
    const div = document.createElement('div')
    div.innerHTML = html
    const text = div.textContent || ''
    const links = Array.from(div.querySelectorAll('a')).map((a) => ({
      href: a.href,
      text: a.textContent || '',
    }))
    attributionItems.push({ html, text, links })
  }

  return attributionItems
}
