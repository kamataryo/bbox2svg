import './App.css';
import React, { useState, useCallback, useRef } from 'react';
import { GeoloniaMap } from '@geolonia/embed-react'
import Modal from 'react-modal'
import { toByteLabel, toFeatures, toSvg } from './lib';
import { moveToPoint2, selectPoint1, bboxSourceId, unselectPoints } from './maplibre';

import type { Map } from '@geolonia/embed';

Modal.setAppElement('body');


const modalStyleContent = {
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  padding: '3rem',
  paddingBottom: '2rem',
  position: 'fixed' as const,
  bottom: 'auto',
  left: '50%',
  right: 'auto',
  top: '50%',
  transform: 'translate(-50%,-50%)',
  minHeight: '10rem',
  minWidth: '20rem',
  maxWidth: '80%',
  maxHeight: '80%',
  width: 'auto',
}
const modalStyleOverlay = {
  zIndex: 999999,
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
          <a href="https://github.com/kamataryo/bbox2svg" target="_blank" rel="noreferrer">
            <h1 className={'m-1 p-1 text-md text-gray-600 bg-opacity-30 bg-zinc-50 rounded-sm'}>
              {'SVG変換'}
              <svg className="inline h-4 w-4 ml-0.5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </h1>
          </a>
        </GeoloniaMap.Control>
      </GeoloniaMap>
      <Modal
        isOpen={!!svgStat}
        style={ {
          overlay: modalStyleOverlay,
          content: modalStyleContent,
        } }
        onRequestClose={closeModal}
      >
        <button onClick={closeModal} type="button" className="fixed top-4 right-5 bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Close Modal</span>
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path style={{ display: 'inline' }} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        { svgStat && <>
          <a title="SVG を別タブで開く" href={svgStat.url} target={'_blank'} rel="noreferrer">
            <img className="mt-4 h-auto w-full rounded-lg border border-sky-500" src={svgStat.url} alt="description" />
          </a>
          <p className={'m-2'}>
            {`ファイルサイズ: ${toByteLabel(svgStat.size)}`}
          </p>
          <p>
            <a className={'mt-2 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgStat.url} download={'map'}>
              {'SVG 形式でダウンロード'}
            </a>
            <svg className="inline ml-0.5 h-5 w-5 text-gray-400"  width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path stroke="none" d="M0 0h24v24H0z"/>
                <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
                <polyline points="7 11 12 16 17 11" />
                <line x1="12" y1="4" x2="12" y2="16" />
              </svg>
            <a className={'ml-4 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgStat.url} target={'_blank'} rel="noreferrer">
              {'SVG ファイルを別タブで開く'}
            </a>
            <svg className="inline ml-0.5 h-5 w-5 text-gray-400"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </p>
        </> }
        <hr className="mt-4" />
        <div className='mt-4 text-sm'>
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
