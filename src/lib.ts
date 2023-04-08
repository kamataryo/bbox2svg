
import type { Map } from '@geolonia/embed';
import type GeoJSON from 'geojson'
import * as turf from '@turf/turf'

const svgNS = "http://www.w3.org/2000/svg"
const svgTextAnchor: { [key: string]: string } = {
  top: 'middle',
  bottom: 'middle',
  left: 'left',
  right: 'right',
}

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
      feature.properties.layer = feature.layer
      // うまくクリップできてない時がある。できないより全部返す方がマシ
      if(feature.geometry.type === 'MultiPolygon') {
        return feature
      }
      const clipped = turf.bboxClip(
        // @ts-ignore
        feature.geometry,
        turf.bbox(mask.geometry),
      )
      // @ts-ignore
      clipped.properties.layer = feature.layer
      return clipped
    }
  }).filter(x => !!x) as GeoJSON.Feature<GeoJSON.Geometry, { layer: any }>[]

  const layerIds = map.getStyle().layers.map(l => l.id)
  features.sort((fa, fb) => {
    return layerIds.indexOf(fa.properties.layer.id) - layerIds.indexOf(fb.properties.layer.id)
  })

  // console.log(map.getPaintProperty('background', 'background-color'))

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

  const layerGroupBuffer: { [layerId: string]: SVGElement[] } = {}

  for (const { geometry, properties } of features) {
    const { type } = geometry
    const { id: layerId, paint, layout, type: layerType } = properties.layer
    if(!layerGroupBuffer[layerId]) {
      layerGroupBuffer[layerId] = []
    }
    switch (type) {
      case 'Point':
      case 'MultiPoint':
      {
        const coordinatesList = Array.isArray(geometry.coordinates[0]) ? geometry.coordinates.flat() : [geometry.coordinates]
        for (const coordinates of coordinatesList) {
          const { x, y } = map.project(coordinates as [number, number]);

          if(layerType === 'symbol') {
            const textField = layout['text-field'].toString()

            if(textField) {
              const fill = paint['text-color'].toString()
              const textSize = layout['text-size']
              const textAnchor = layout['text-anchor'] as string
              const textFont = Array.isArray(layout['text-font']) ? layout['text-font'][0] : layout['text-font']
              const text = document.createElementNS(svgNS, 'text');
              text.setAttributeNS(svgNS, 'x', x.toString())
              text.setAttributeNS(svgNS, 'y', y.toString())
              text.setAttributeNS(svgNS, 'fill', fill)
              text.setAttributeNS(svgNS, 'font-size', textSize)
              text.setAttributeNS(svgNS, 'text-anchor', svgTextAnchor[textAnchor])
              textFont && text.setAttributeNS(svgNS, 'font-family', textFont)
              text.textContent = textField
              layerGroupBuffer[layerId].push(text)
            }
          } else if (layerType === 'circle') {
            const circle = document.createElementNS(svgNS, "circle");
            circle.setAttributeNS(svgNS, 'cx', x.toString())
            circle.setAttributeNS(svgNS, 'cy', y.toString())
            circle.setAttributeNS(svgNS, 'r', '5')
            circle.setAttributeNS(svgNS, 'fill', 'red')
            layerGroupBuffer[layerId].push(circle)
          }
        }
        break;
      }
      case 'LineString':
      case 'MultiLineString':
      {
        const lineColor = paint['line-color']
        if(lineColor) {
          if(geometry.coordinates.length === 0) {
            break
          }
          const coordinatesList = Array.isArray(geometry.coordinates[0][0]) ? geometry.coordinates : [geometry.coordinates]
          for (const coordinates of coordinatesList) {
            const d = coordinates.map((position, index) => {
              const command = index === 0 ? 'M' : 'L'
              const { x, y } = map.project(position as [number, number])
              return `${command} ${x},${y}`
            }).join(' ')
            const lineWidth = paint['line-width']
            const lineOpacity = paint['line-opacity'] || 1
            const lineDasharray = paint['line-dasharray']
            const lineCap = layout['line-cap']
            const lineJoin = layout['line-join']

            const path = document.createElementNS(svgNS, 'path')
            path.setAttributeNS(svgNS, 'class', type)
            path.setAttributeNS(svgNS, 'd', d)
            path.setAttributeNS(svgNS, 'stroke', lineColor)
            path.setAttributeNS(svgNS, 'stroke-width', lineWidth)
            path.setAttributeNS(svgNS, 'stroke-opacity', lineOpacity.toString())
            path.setAttributeNS(svgNS, 'stroke-dasharray', lineDasharray && [...lineDasharray.from].join(' '))
            path.setAttributeNS(svgNS, 'fill', 'none')
            path.setAttributeNS(svgNS, 'stroke-linecap', lineCap)
            path.setAttributeNS(svgNS, 'stroke-linejoin', lineJoin)
            layerGroupBuffer[layerId].push(path)
          }
        }
        break;
      }
      case 'Polygon':
      case 'MultiPolygon':
      {
        const fill = paint['fill-color']
        const stroke = paint['fill-outline-color']
        if(fill || stroke) {
          if(
            geometry.coordinates.length === 0 ||
            geometry.coordinates[0].length === 0
          ) {
            break
          }

          const coordinatesList = (Array.isArray(geometry.coordinates[0][0][0])) ? geometry.coordinates.flat() : geometry.coordinates
          for (const coordinates of coordinatesList) {
            const points = coordinates.map((position) => {
              const { x, y } = map.project(position as [number, number])
              return `${x},${y}`
            }).join(' ')
            const polygon = document.createElementNS(svgNS, 'polygon')
            polygon.setAttributeNS(svgNS, 'class', [type, layerId].join(' '))
            polygon.setAttributeNS(svgNS, 'points', points)
            fill && polygon.setAttributeNS(svgNS, 'fill', fill.toString())
            stroke && polygon.setAttributeNS(svgNS, 'stroke', stroke)
            layerGroupBuffer[layerId].push(polygon)
          }
        }
        break
      }
      default:
      {
        console.warn(`Unhandled feature type: ${type}`)
        break;
      }
    }
  }

  const layerIdSeq = map.getStyle().layers.map(layer => layer.id)
  for (const layerId of layerIdSeq) {
    if(layerGroupBuffer[layerId]) {
      const g = document.createElementNS(svgNS, 'g')
      for (const element of layerGroupBuffer[layerId]) {
        g.setAttributeNS(svgNS, 'id', layerId)
        g.append(element)
      }
      svg.append(g)
    }
  }

  return { xml: `<?xml version="1.0"?>\n${svg.outerHTML}`, width, height}
}

export const toByteLabel = (byte: number) => {
  let num = byte
  let unit
  if(num > 1024 ** 2) {
    num = Math.round((num / 1024 ** 2) * 100) / 100
    unit = 'MB'
  } else if (num > 1024 ** 1) {
    num = Math.round((num / 1024 ** 1) * 100) / 100
    unit = 'kB'
  } else {
    num = Math.round((num / 1024 ** 0) * 100) / 100
    unit = 'B'
  }
  return `${num} ${unit}`
}
