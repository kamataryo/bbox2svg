
import type { Map } from '@geolonia/embed';
import type GeoJSON from 'geojson'

const svgNS = "http://www.w3.org/2000/svg"

export const toSvg = (map: Map, features: GeoJSON.Feature[], bbox: GeoJSON.Feature<GeoJSON.Polygon>) => {
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

  for (const feature of features) {
    switch (feature.geometry.type) {
      case 'Point':
      {
        const { coordinates }: GeoJSON.Point = feature.geometry
        const circle = document.createElementNS(svgNS, "circle");
        let { x: cx, y: cy } = map.project(coordinates as [number, number]);
        circle.setAttributeNS(svgNS, 'cx', cx.toString())
        circle.setAttributeNS(svgNS, 'cy', cy.toString())
        circle.setAttributeNS(svgNS, 'r', '1')
        circle.setAttributeNS(svgNS, 'fill', 'black')
        svg.append(circle)
        break;
      }
      case 'LineString':
      case 'Polygon':
      {
        const { coordinates, type } :GeoJSON.LineString | GeoJSON.Polygon = feature.geometry
        const path = document.createElementNS(svgNS, 'path')
        const d = (type === 'Polygon' ? coordinates[0] : coordinates).map((position, index) => {
          const command = index === 0 ? 'M' : 'L'
          const { x, y } = map.project(position as [number, number])
          return `${command} ${x},${y}`
        }).join(' ')
        path.setAttributeNS(svgNS, 'd', d)
        path.setAttributeNS(svgNS, 'stroke', type === 'LineString' ? 'black' : 'red')
        path.setAttributeNS(svgNS, 'stroke-width', '1')
        path.setAttributeNS(svgNS, 'fill', 'none')
        svg.append(path)
        break
      }
      default:
        break;
    }
  }

  return `<?xml version="1.0"?>\n${svg.outerHTML}`
}
