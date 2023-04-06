import type { Map } from '@geolonia/embed';

const sourceId = 'bbox2svg__bbox-polygon-draft'
const lineLayerId = 'bbox2svg__bbox-polygon-draft-layer-line'
const fillLayerId = 'bbox2svg__bbox-polygon-draft-layer-fill'

let point1: number[] | null = null
let point2: number[] | null = null

export const selectPoint1 = (map: Map, point: number[], downloadCallback: (sourceId: string) => void) => {
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
      source: sourceId,
      type: 'fill',
      paint: {
        'fill-color': "red",
        'fill-opacity': .2,
      }
    })
    downloadCallback(sourceId)
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

  const source = map.getSource(sourceId)
  const lineLayer = map.getLayer(lineLayerId)
  if(!source) {
    map.addSource(sourceId, { type: 'geojson', data: geojson })
  } else if(!point2) {
    // @ts-ignore
    source.setData(geojson)
  }

  if(!lineLayer) {
    map.addLayer({
      id: lineLayerId,
      source: sourceId,
      type: 'line',
      paint: {
        'line-color': 'red',
        'line-width': 3,
        "line-dasharray": [3, 1],
      }
    })
   }
}