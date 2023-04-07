import React, { useState, useCallback } from 'react';
import './App.css';
import { GeoloniaMap } from '@geolonia/embed-react'
import type { Map } from '@geolonia/embed';
import { toFeatures, toSvg } from './lib';
import { moveToPoint2, selectPoint1 } from './maplibre';
import Modal from 'react-modal'

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

  const [svgUrl, setSvgUrl] = useState<null | string>(null)

  const onLoadCallback = useCallback((map: Map) => {
    map.on('click', (e) => {
      const point = [e.lngLat.lng, e.lngLat.lat]
      selectPoint1(map, point, (sourceId: string) => {
        // @ts-ignore
        const mask = map.getSource(sourceId)?.serialize().data.features[0]
        const features = toFeatures(map, mask)
        const svgString = toSvg(map, features, mask)
        const url = URL.createObjectURL(new Blob([svgString],{ type: 'image/svg+xml' }))
        setSvgUrl(url)
        // download(svgString)
        // download(svgString, 'in-new-tab')
      })
    })

    map.on('mousemove', (e) => {
      const cursor = [e.lngLat.lng, e.lngLat.lat]
      moveToPoint2(map, cursor)
    })
  }, [])

  const closeModal = useCallback(() => {
    svgUrl && URL.revokeObjectURL(svgUrl)
    setSvgUrl(null)
  }, [svgUrl])

  return (
    <div className="App">
      <GeoloniaMap hash="on" onLoad={ onLoadCallback } style={{ width: '100%', height: '100%' }}></GeoloniaMap>
      <Modal isOpen={!!svgUrl} style={ {content: modalStyleContent as any} }>
        <button onClick={closeModal} type="button" className="fixed top-5 right-5 bg-white rounded-md p-2 inline-flex items-center justify-center text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span className="sr-only">Close menu</span>
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img className="m-4 h-auto max-w-full rounded-lg border border-sky-500" src={svgUrl!} alt="description" />
        <div className="m-auto">
          <a className={'m-4 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgUrl!} download={'map'}>ダウンロード</a>
          <a className={'m-4 underline text-blue-600 hover:text-blue-800 visited:text-purple-600'} href={svgUrl!} target={'_blank'} rel="noreferrer">別タブで開く</a>
        </div>
        <hr className="m-4" />
        <div className='m-4 text-sm'>
          <h4>メモ</h4>
          <ul className={'ml-4 list-disc'}>
            <li><strong>{'データを利用する場合はライセンスの表示が必要です'}</strong></li>
            <li>{'低ズームでの書き出しや海の近くではポリゴンの塗りが乱れる場合があります'}</li>
            <li><a className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://github.com/kamataryo/bbox2svg/issues">{'バグ報告'}</a></li>
            <li><a className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600" href="https://github.com/kamataryo/bbox2svg/pulls">{'改善提案（プルリクエスト）'}</a></li>
            <li>今後対応するかもしれない機能 (TODO)
              <ul className={'ml-4 list-decimal'}>
                <li className="italic">background レイヤーの追加</li>
                <li className="italic">ラスターレイヤーの追加</li>
                <li className="italic">ライセンス表示の自動生成</li>
                <li className="italic">MultiLineString への対応</li>
                <li className="italic">塗りの裏表逆転への対応</li>
                <li className="italic">テキストのオフセット表示</li>
                <li className="italic">アイコン画像の表示</li>
              </ul>
            </li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}

export default App;
