import React, {  useCallback} from 'react';
import './App.css';
import { GeoloniaMap } from '@geolonia/embed-react'
import type { Map } from '@geolonia/embed';
import { download, toFeatures, toSvg } from './lib';
import { moveToPoint2, selectPoint1 } from './maplibre';


function App() {
  const onLoadCallback = useCallback((map: Map) => {

    map.on('click', (e) => {
      const point = [e.lngLat.lng, e.lngLat.lat]
      selectPoint1(map, point, (sourceId: string) => {
        // @ts-ignore
        const mask = map.getSource(sourceId)?.serialize().data.features[0]
        const features = toFeatures(map, mask)
        const svgString = toSvg(map, features, mask)
        download(svgString)
        download(svgString, 'in-new-tab')
      })
    })

    map.on('mousemove', (e) => {
      const cursor = [e.lngLat.lng, e.lngLat.lat]
      moveToPoint2(map, cursor)
    })
  }, [])

  return (
    <div className="App">
      <GeoloniaMap hash="on" onLoad={ onLoadCallback } style={{ width: '100%', height: '100%' }}></GeoloniaMap>
    </div>
  );
}

export default App;
