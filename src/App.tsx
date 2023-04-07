import './App.css';
import React, { useState, useCallback, useRef } from 'react';
import { GeoloniaMap } from '@geolonia/embed-react'
import Modal from 'react-modal'
import { toByteLabel, toFeatures, toSvg } from './lib';
import { moveToPoint2, selectPoint1, bboxSourceId, unselectPoints } from './maplibre';

import type { Map } from '@geolonia/embed';

Modal.setAppElement('body');


const modalStyleContent = {
  borderRadius: '4px',
  border: '1px solid #cbd5e1',
  bottom: 'auto',
  minHeight: '10rem',
  left: '50%',
  padding: '3rem',
  paddingBottom: '2rem',
  position: 'fixed',
  right: 'auto',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  minWidth: '20rem',
  maxWidth: '80%',
  width: 'auto',
}

function App() {

  const [svgStat, setSvgStat] = useState<null | { url: string, size: number }>(null)
  const mapRef = useRef<Map>(null)

  const onLoadCallback = useCallback((map: Map) => {
    map.on('click', (e) => {
      const point = [e.lngLat.lng, e.lngLat.lat]
      selectPoint1(map, point, () => {
        const source = map.getSource(bboxSourceId)
        if(source) {
          const mask = source.serialize().data.features[0]
          const features = toFeatures(map, mask)
          const svgString = toSvg(map, features, mask)
          const blob = new Blob([svgString],{ type: 'image/svg+xml' })
          const url = URL.createObjectURL(blob)
          const size = blob.size
          setSvgStat({ url, size })
        }
      })
    })

    map.on('mousemove', (e) => {
      const cursor = [e.lngLat.lng, e.lngLat.lat]
      moveToPoint2(map, cursor)
    })
  }, [])

  const closeModal = useCallback(() => {
    svgStat && URL.revokeObjectURL(svgStat.url)
    setSvgStat(null)
    if(mapRef.current) {
      unselectPoints(mapRef.current)
    }
  }, [svgStat])

  return (
    <div className="App">
      {/* @ts-ignore */}
      <GeoloniaMap mapRef={mapRef} hash="on" onLoad={ onLoadCallback } style={{ width: '100%', height: '100%' }}>
        <GeoloniaMap.Control containerProps={ { className: 'maplibregl-ctrl' } } position={'top-left'}>
          <h1 className={'m-1 text-md text-gray-900 bg-opacity-10 bg-zinc-50'}>{'SVG変換'}</h1>
        </GeoloniaMap.Control>
      </GeoloniaMap>
      <Modal
        isOpen={!!svgStat}
        style={ {content: modalStyleContent as any} }
        onRequestClose={closeModal}
      >
        <button onClick={closeModal} type="button" className="fixed top-5 right-5 bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Close Modal</span>
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path style={{ display: 'inline' }} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        { svgStat && <>
          <img className="m-4 h-auto max-w-full rounded-lg border border-sky-500" src={svgStat.url} alt="description" />
          <p className={'m-4'}>
            {`ファイルサイズ: ${toByteLabel(svgStat.size)}`}
          </p>
          <p className="m-auto">
            <a className={'m-4 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgStat.url} download={'map'}>
              SVG 形式でダウンロード
            </a>
            <a className={'m-4 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgStat.url} target={'_blank'} rel="noreferrer">SVG ファイルを別タブで開く</a>
          </p>
        </> }
        <hr className="m-4" />
        <div className='m-4 text-sm'>
          <h4>メモ</h4>
          <ul className={'ml-4 list-disc'}>
            <li><strong>{'データを利用する場合はライセンスの表示が必要です'}</strong></li>
            <li>{'低ズームでの書き出しはきれいな結果が得られない場合があります'}</li>
            <li><a className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://github.com/kamataryo/bbox2svg/issues">{'バグ報告'}</a></li>
            <li><a className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://github.com/kamataryo/bbox2svg/pulls">{'改善提案（プルリクエスト）'}</a></li>
            <li>今後対応するかもしれない機能 (TODO)
              <ul className={'ml-4 list-decimal'}>
                <li className="italic">ズーム10以下で島が消える</li>
                <li className="italic">クリッピングがうまくいってない</li>
                <li className="italic">background レイヤーの追加</li>
                <li className="italic">ライセンス表示の自動生成</li>
              </ul>
            </li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}

export default App;
