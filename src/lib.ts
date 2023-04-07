
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
  const width = Math.abs((upLeftTop.x - upRightTop.x) + (upLeftBottom.x - upRightBottom.x)) / 2
  const height = Math.abs((upLeftTop.y - upLeftBottom.y) + (upRightTop.y - upRightBottom.y)) / 2
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute('xmlns', svgNS)
  svg.setAttributeNS(svgNS, 'viewBox', viewBox)
  svg.setAttributeNS(svgNS, 'width', width.toString())
  svg.setAttributeNS(svgNS, 'height', height.toString())

  for (const { geometry, properties } of features) {
    const { type } = geometry
    const { id: layerId, paint, layout } = properties.layer
    // console.log(type, layerType)
    switch (type) {
      case 'Point':
      case 'MultiPoint':
      {
        const coordinatesList = Array.isArray(geometry.coordinates[0]) ? geometry.coordinates.flat() : [geometry.coordinates]
        for (const coordinates of coordinatesList) {
          const { x, y } = map.project(coordinates as [number, number]);
          const textField = layout['text-field'].toString()
          if(textField) {
            const fill = paint['text-color'].toString()
            const textSize = layout['text-size']

            const text = document.createElementNS(svgNS, 'text');
            text.setAttributeNS(svgNS, 'x', x.toString())
            text.setAttributeNS(svgNS, 'y', y.toString())
            text.setAttributeNS(svgNS, 'fill', fill)
            text.setAttributeNS(svgNS, 'font-size', textSize)
            text.textContent = textField
            svg.append(text)
          } else {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttributeNS(svgNS, 'cx', x.toString())
            circle.setAttributeNS(svgNS, 'cy', y.toString())
            circle.setAttributeNS(svgNS, 'r', '5')
            circle.setAttributeNS(svgNS, 'fill', 'red')
            svg.append(circle)
          }
        }
        break;
      }
      case 'LineString':
      // case 'MultiLineString':
      {
        const lineColor = paint['line-color']
        if(lineColor) {
          const coordinates = Array.isArray(geometry.coordinates[0][0]) ? geometry.coordinates.flat() : geometry.coordinates
          const d = coordinates.map((position, index) => {
            const command = index === 0 ? 'M' : 'L'
            const { x, y } = map.project(position as [number, number])
            return `${command} ${x},${y}`
          }).join(' ')
          const lineWidth = paint['line-width']
          const lineOpacity = paint['line-opacity'] || 1
          const lineDasharray = paint['line-dasharray']

          const path = document.createElementNS(svgNS, 'path')
          path.setAttributeNS(svgNS, 'class', 'linestring')
          path.setAttributeNS(svgNS, 'd', d)
          path.setAttributeNS(svgNS, 'stroke', lineColor)
          path.setAttributeNS(svgNS, 'stroke-width', lineWidth)
          path.setAttributeNS(svgNS, 'stroke-opacity', lineOpacity.toString())
          path.setAttributeNS(svgNS, 'stroke-dasharray', lineDasharray && [...lineDasharray.from, ...lineDasharray.to].join(' '))
          path.setAttributeNS(svgNS, 'fill', 'none')
          svg.append(path)
        }
        break;
      }
      case 'Polygon':
      case 'MultiPolygon':
      {
        const fill = paint['fill-color']
        if(fill) {
          const coordinates = Array.isArray(geometry.coordinates[0][0][0]) ? geometry.coordinates.flat() : geometry.coordinates
          const points = coordinates.flat().map((position) => {
            const { x, y } = map.project(position as [number, number])
            return `${x},${y}`
          }).join(' ')
          const polygon = document.createElementNS(svgNS, 'polygon')
          polygon.setAttributeNS(svgNS, 'class', ['polygon', layerId].join(' '))
          polygon.setAttributeNS(svgNS, 'points', points)
          polygon.setAttributeNS(svgNS, 'fill', fill.toString())
          svg.append(polygon)
        }
        break
      }
      default:
        break;
    }
  }

  return `<?xml version="1.0"?>\n${svg.outerHTML}`
}
