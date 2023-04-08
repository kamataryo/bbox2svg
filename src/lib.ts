
import type { Map } from '@geolonia/embed';
import type GeoJSON from 'geojson'
import * as turf from '@turf/turf'
// @ts-ignore
import rewind from '@mapbox/geojson-rewind'

const svgNS = "http://www.w3.org/2000/svg"
const svgTextAnchor: { [key: string]: string } = {
  top: 'middle',
  bottom: 'middle',
  left: 'left',
  right: 'right',
}

let spriteContainer: {
  imageURL: string,
  locationMap: { [name: string]: { width: number, height: number, x: number, y: number, pixelRatio: number } },
  image: HTMLImageElement,
} | null = null

const loadSprite = async (name: string, url: string) => {
  if(!spriteContainer) {
    // TODO: @2x に対応する
    const [locationMap, spritePng] = await Promise.all([
      fetch(`${url}.json`).then(resp => resp.json()),
      fetch(`${url}.png`).then(resp => resp.blob()),
    ])
    const imageURL = URL.createObjectURL(spritePng)
    const image = new Image()
    image.src = imageURL
    await new Promise(resolve => image.onload = resolve)
    spriteContainer = { imageURL , locationMap, image }
  }

  const { image, locationMap } = spriteContainer
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  const targetSpriteLocation = locationMap[name]
  if(!targetSpriteLocation) {
    return null
  }
  const { width, height, x, y } = targetSpriteLocation
  canvas.width = width
  canvas.height = height
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height)
  const dataURL = canvas.toDataURL()
  canvas.remove()
  return { dataURL, width, height }
}

export const toFeatures = (map: Map, bbox: turf.helpers.BBox) => {
  const bboxPolygon = turf.bboxPolygon(bbox)
  const features = map.queryRenderedFeatures([
    map.project([bbox[0], bbox[1]]),
    map.project([bbox[2], bbox[3]])]).map(renderedFeature => {
    const feature = rewind(renderedFeature.toJSON())
    feature.properties.layer = renderedFeature.layer

    if(feature.geometry.type === 'Point') {
      if(turf.inside(feature.geometry, bboxPolygon)) {
        return feature as GeoJSON.Feature<GeoJSON.Point>
      } else {
        return null
      }
    } else {
      const clipped = turf.bboxClip(
        // @ts-ignore
        feature.geometry,
        bbox,
      )
       if(clipped.geometry.type === 'MultiPolygon') {
        clipped.geometry.coordinates = clipped.geometry.coordinates.filter(x => x.length > 0)
       }
      // @ts-ignore
      clipped.properties.layer = feature.properties.layer
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

export const toSvg = async (map: Map, features: GeoJSON.Feature<GeoJSON.Geometry, { layer: any }>[], bbox: turf.helpers.BBox) => {
  const [left, bottom, right, top] = bbox
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

  const spriteURL = map.getStyle().sprite

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
            const iconImage = layout['icon-image']
            const textField = layout['text-field']
            const textOffset = layout['text-offset'] || [0, 0]
            const textHaloWidth = paint['text-halo-width']
            const textSize = layout['text-size']
            const textAnchor = layout['text-anchor'] as string
            const textFont = Array.isArray(layout['text-font']) ? layout['text-font'][0] : layout['text-font']
            const textGroup: SVGGElement = document.createElementNS(svgNS, 'g')

            if(iconImage && spriteURL) {
              const sprite = await loadSprite(iconImage, spriteURL)
              if(sprite) {
                const { dataURL, width, height } = sprite
                const image = document.createElementNS(svgNS, 'image');
                image.setAttributeNS(svgNS, 'href', dataURL)
                image.setAttributeNS(svgNS, 'x', (x - width / 2).toString()) // NOTE: なぜこれで位置が合うのか分からない
                image.setAttributeNS(svgNS, 'y', (y - height).toString())
                image.setAttributeNS(svgNS, 'width', width.toString())
                image.setAttributeNS(svgNS, 'height', height.toString())
                textGroup.append(image)
              }
            }

            if(textField && textHaloWidth > 0) {
              const textHalloColor = paint['text-halo-color']
              const textHallo = document.createElementNS(svgNS, 'text');
              textHallo.setAttributeNS(svgNS, 'aria-hidden', 'true')
              textHallo.setAttributeNS(svgNS, 'x', (x + textOffset[0] * textSize).toString())
              textHallo.setAttributeNS(svgNS, 'y', (y + textOffset[1] * textSize).toString())
              textHallo.setAttributeNS(svgNS, 'fill', textHalloColor.toString())
              textHallo.setAttributeNS(svgNS, 'font-size', textSize.toString())
              textHallo.setAttributeNS(svgNS, 'stroke', textHalloColor.toString())
              textHallo.setAttributeNS(svgNS, 'stroke-width', (textHaloWidth * 2).toString())
              textHallo.setAttributeNS(svgNS, 'text-anchor', svgTextAnchor[textAnchor]) // offset との組み合わせでうまく動いているのか？
              textFont && textHallo.setAttributeNS(svgNS, 'font-family', textFont)
              textHallo.textContent = textField.toString()
              textGroup.append(textHallo)
            }

            if(textField) {
              const fill = paint['text-color']
              const text = document.createElementNS(svgNS, 'text');
              text.setAttributeNS(svgNS, 'x', (x + textOffset[0] * textSize).toString())
              text.setAttributeNS(svgNS, 'y', (y + textOffset[1] * textSize).toString())
              text.setAttributeNS(svgNS, 'fill', fill.toString())
              text.setAttributeNS(svgNS, 'font-size', textSize.toString())
              text.setAttributeNS(svgNS, 'text-anchor', svgTextAnchor[textAnchor]) // offset との組み合わせでうまく動いているのか？
              textFont && text.setAttributeNS(svgNS, 'font-family', textFont)
              text.textContent = textField.toString()

              textGroup.append(text)
              layerGroupBuffer[layerId].push(textGroup)
            }
          } else if (layerType === 'circle') {
            const circle = document.createElementNS(svgNS, "circle");
            const circleRadius = paint['circle-radius']
            const circleColor = paint['circle-color']

            circle.setAttributeNS(svgNS, 'cx', x.toString())
            circle.setAttributeNS(svgNS, 'cy', y.toString())
            circle.setAttributeNS(svgNS, 'r', circleRadius.toString())
            circle.setAttributeNS(svgNS, 'fill', circleColor.toString())
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
