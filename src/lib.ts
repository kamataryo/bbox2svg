
import type { Map } from '@geolonia/embed';
import type GeoJSON from 'geojson'
import * as turf from '@turf/turf'

const svgNS = "http://www.w3.org/2000/svg"

export const toFeatures = (map: Map, mask: GeoJSON.Feature<GeoJSON.Polygon>) => {
  const features = map.queryRenderedFeatures(mask.geometry as any).map(feature => {
    if(feature.geometry.type === 'Point') {
      if(turf.inside(feature.geometry, mask)) {
        feature.properties.layer = feature.layer
        return feature
      } else {
        return null
      }
    } else {
      // @ts-ignore
      const clipped = turf.bboxClip(feature, mask)
      // @ts-ignore
      clipped.properties.layer = feature.layer
      return clipped
    }
  }).filter(x => !!x) as GeoJSON.Feature<GeoJSON.Geometry, { layer: any }>[]

  const layerIds = map.getStyle().layers.map(l => l.id)
  features.sort((fa, fb) => {
    console.log(layerIds.indexOf(fa.properties.layer.id), layerIds.indexOf(fb.properties.layer.id))
    return layerIds.indexOf(fa.properties.layer.id) - layerIds.indexOf(fb.properties.layer.id)
  })
  return features
}

export const toSvg = (map: Map, features: GeoJSON.Feature<GeoJSON.Geometry, { layer: any }>[], bbox: GeoJSON.Feature<GeoJSON.Polygon>) => {
  const xValues = bbox.geometry.coordinates[0].map(point => point[0])
  const yValues = bbox.geometry.coordinates[0].map(point => point[1])
  const left = Math.min(...xValues)
  const right = Math.max(...xValues)
  const top = Math.max(...yValues)
  const bottom = Math.min(...yValues)
  const upLeftTop = map.project([left, top])
  const upRightTop = map.project([right, top])
  const upLeftBottom = map.project([left, bottom])
  const upRightBottom = map.project([right, bottom])
  const minX = Math.min(upLeftTop.x, upRightTop.x, upLeftBottom.x, upRightBottom.x)
  const maxX = Math.max(upLeftTop.x, upRightTop.x, upLeftBottom.x, upRightBottom.x)
  const minY = Math.min(upLeftTop.y, upRightTop.y, upLeftBottom.y, upRightBottom.y)
  const maxY = Math.max(upLeftTop.y, upRightTop.y, upLeftBottom.y, upRightBottom.y)
  const xDiff = maxX - minX
  const yDiff = maxY - minY
  const viewBox = `${minX} ${minY} ${xDiff} ${yDiff}`
  let width = Math.abs((upLeftTop.x - upRightTop.x) + (upLeftBottom.x - upRightBottom.x)) / 2
  let height = Math.abs((upLeftTop.y - upLeftBottom.y) + (upRightTop.y - upRightBottom.y)) / 2
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute('xmlns', svgNS)
  svg.setAttributeNS(svgNS, 'viewBox', viewBox)
  svg.setAttributeNS(svgNS, 'width', width.toString())
  svg.setAttributeNS(svgNS, 'height', height.toString())

  for (const { geometry, properties } of features) {
    const { type } = geometry
    const { id: layerId, paint, layout } = properties.layer
    switch (type) {
      case 'Point':
      {
        const { coordinates }: GeoJSON.Point = geometry
        let { x: cx, y: cy } = map.project(coordinates as [number, number]);
        const textField = layout['text-field'].toString()
        if(textField) {
          const fill = paint['text-color'].toString()
          const textSize = layout['text-size']
          const text = document.createElementNS(svgNS, 'text');
          text.setAttributeNS(svgNS, 'x', cx.toString())
          text.setAttributeNS(svgNS, 'y', cy.toString())
          text.setAttributeNS(svgNS, 'fill', fill)
          text.setAttributeNS(svgNS, 'text-size', textSize)
          text.textContent = textField
          svg.append(text)
        } else {
          const circle = document.createElementNS(svgNS, "circle");
          circle.setAttributeNS(svgNS, 'cx', cx.toString())
          circle.setAttributeNS(svgNS, 'cy', cy.toString())
          circle.setAttributeNS(svgNS, 'r', '5')
          circle.setAttributeNS(svgNS, 'fill', 'red')
          svg.append(circle)
        }
        break;
      }
      case 'LineString':
      {
        const stroke = paint['line-color']
        if(stroke) {
          const { coordinates } :GeoJSON.LineString = geometry
          const path = document.createElementNS(svgNS, 'path')
          const d = coordinates.map((position, index) => {
            const command = index === 0 ? 'M' : 'L'
            const { x, y } = map.project(position as [number, number])
            return `${command} ${x},${y}`
          }).join(' ')
          const strokeWidth = paint['line-width']
          path.setAttributeNS(svgNS, 'class', 'linestring')
          path.setAttributeNS(svgNS, 'd', d)
          path.setAttributeNS(svgNS, 'stroke', stroke)
          path.setAttributeNS(svgNS, 'stroke-width', strokeWidth)
          path.setAttributeNS(svgNS, 'fill', 'none')
          svg.append(path)
        }
        break;
      }
      case 'MultiPolygon':
      case 'Polygon':
      {
        const fill = paint['fill-color']
        if(fill) {
          const coordinates = Array.isArray(geometry.coordinates[0][0][0]) ? geometry.coordinates.flat() : geometry.coordinates
          const path = document.createElementNS(svgNS, 'path')
          const d = coordinates.flat().map((position, index) => {
            const command = index === 0 ? 'M' : 'L'
            const { x, y } = map.project(position as [number, number])
            return `${command} ${x},${y}`
          }).join(' ')
          path.setAttributeNS(svgNS, 'class', ['polygon', layerId].join(' '))
          path.setAttributeNS(svgNS, 'd', d)
          fill && path.setAttributeNS(svgNS, 'fill', fill.toString())
          svg.append(path)
        }
        break
      }
      default:
        break;
    }
  }

  return `<?xml version="1.0"?>\n${svg.outerHTML}`
}

export const download = (svgString: string, inNewTab?: 'in-new-tab') => {
  const url = URL.createObjectURL(new Blob([svgString],{ type: 'image/svg+xml' }))
  const anchor = document.createElement('a')
  anchor.href = url
  if(inNewTab) {
    anchor.setAttribute('target', '_blank')
  } else {
    anchor.setAttribute('download', 'map')
  }
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
