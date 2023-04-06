import React, {  useCallback} from 'react';
import './App.css';
import { GeoloniaMap } from '@geolonia/embed-react'
import type { Map } from '@geolonia/embed';

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
        map.addLayer({
          id: fillLayerId,
          source: sourceId,
          type: 'fill',
          paint: {
            'fill-color': "red",
            'fill-opacity': .2,
          }
        })
        // @ts-ignore
        const mask = map.getSource(sourceId)?.serialize().data.features[0]
        const features = map.queryRenderedFeatures(mask.geometry)
        features.push(mask)
        console.log(features)
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
      <GeoloniaMap onLoad={ onLoadCallback } style={{ width: '100%', height: '100%' }}></GeoloniaMap>
    </div>
  );
}

export default App;
