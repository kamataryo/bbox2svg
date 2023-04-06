import React, {  useCallback} from 'react';
import './App.css';
import { GeoloniaMap } from '@geolonia/embed-react'
import type { Map } from '@geolonia/embed';
import * as turf from '@turf/turf'
import { toSvg } from './lib';

const sourceId = 'bbox2svg__bbox-polygon-draft'
const lineLayerId = 'bbox2svg__bbox-polygon-draft-layer-line'
const fillLayerId = 'bbox2svg__bbox-polygon-draft-layer-fill'

function App() {
  const onLoadCallback = useCallback((map: Map) => {
    let point1: number[] | null = null
    let point2: number[] | null = null
    map.on('click', (e) => {
      const point = [e.lngLat.lng, e.lngLat.lat]
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
        // clip and downloading
        // @ts-ignore
        const mask = map.getSource(sourceId)?.serialize().data.features[0]
        const features = map.queryRenderedFeatures(mask.geometry).map(feature => {
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

        const svgString = toSvg(map, features, mask)
        const url = URL.createObjectURL(new Blob([svgString],{ type: 'image/svg+xml' }))
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.setAttribute('target', '_blank')
        anchor.click()
        anchor.setAttribute('download', 'map')
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)
      }
    })
    map.on('mousemove', (e) => {
      const cursor = [e.lngLat.lng, e.lngLat.lat]

      if(point1) {
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
    })
  }, [])

  return (
    <div className="App">
      <GeoloniaMap hash="on" onLoad={ onLoadCallback } style={{ width: '100%', height: '100%' }}></GeoloniaMap>
    </div>
  );
}

export default App;
