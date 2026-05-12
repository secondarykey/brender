import { useState, useEffect, useRef } from 'react'
import { QueueApi } from '../lib/api'

function ImageViewerDialog({ job, onClose }) {
  const [images, setImages]           = useState([])
  const [index, setIndex]             = useState(0)
  const [imgSrc, setImgSrc]           = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingImg, setLoadingImg]   = useState(false)
  const [error, setError]             = useState('')
  const [playing, setPlaying]         = useState(false)
  const [loop, setLoop]               = useState(false)
  const playingRef                    = useRef(false)
  const loopRef                       = useRef(false)

  const stopPlay = () => { playingRef.current = false; setPlaying(false) }
  const toggleLoop = () => { const v = !loopRef.current; loopRef.current = v; setLoop(v) }

  // 画像ファイル一覧を取得
  useEffect(() => {
    if (!job) return
    stopPlay()
    setLoadingList(true)
    setError('')
    setImages([])
    setIndex(0)
    setImgSrc('')
    QueueApi.listJobImages({ id: job.id })
      .then(list => {
        setImages(list || [])
        setLoadingList(false)
      })
      .catch(err => {
        setError(String(err))
        setLoadingList(false)
      })
  }, [job])

  // インデックスが変わったら画像を読み込む（前の画像は読み込み完了まで表示したまま）
  // 再生中は読み込み完了後に次のインデックスへ自動進行する
  useEffect(() => {
    if (images.length === 0) return
    setLoadingImg(true)
    QueueApi.getImageBase64({ path: images[index] })
      .then(src => {
        setImgSrc(src)
        setLoadingImg(false)
        if (playingRef.current) {
          setIndex(prev => {
            if (prev < images.length - 1) return prev + 1
            if (loopRef.current) return 0   // ループON: 先頭へ戻る
            playingRef.current = false
            setPlaying(false)
            return prev
          })
        }
      })
      .catch(err => {
        setError(String(err))
        setLoadingImg(false)
        stopPlay()
      })
  }, [images, index])

  const handleTogglePlay = () => {
    if (playing) {
      stopPlay()
      return
    }
    playingRef.current = true
    setPlaying(true)
    if (index >= images.length - 1) {
      // 最後のフレームなら先頭から再生（effect が再実行されて .then() が進行を引き継ぐ）
      setIndex(0)
    } else if (!loadingImg) {
      // 読み込み済みなら即座に次へ進める（.then() はすでに終わっているため自分で進行）
      setIndex(prev => prev + 1)
    }
    // loadingImg 中なら .then() が playingRef を見て進行するので何もしない
  }

  if (!job) return null

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog image-viewer-dialog" onClick={e => e.stopPropagation()}>
        <h3 className="dialog-title">
          レンダリング結果 — {job.workspace_name}
        </h3>

        <div className="image-viewer-body">
          {loadingList && <div className="image-viewer-loading">読み込み中...</div>}
          {imgSrc && (
            <img src={imgSrc} alt={filename} className="image-viewer-img" />
          )}
          {!loadingList && !imgSrc && !error && images.length === 0 && (
            <div className="image-viewer-empty">画像ファイルが見つかりません</div>
          )}
          {error && <div className="error-msg">{error}</div>}
        </div>

        <div className="image-viewer-controls" style={{ visibility: images.length > 0 ? 'visible' : 'hidden' }}>
          <span className="image-viewer-filename" title={filename}>
            {filename}{loadingImg && <span className="image-viewer-loading-inline"> 読み込み中...</span>}
          </span>
          <div className="image-viewer-slider-row">
            <input
              type="range"
              min={0}
              max={Math.max(0, images.length - 1)}
              value={index}
              onChange={e => { stopPlay(); setIndex(Number(e.target.value)) }}
              className="image-viewer-slider"
              disabled={images.length <= 1}
            />
            <span className="image-viewer-counter">{images.length > 0 ? `${index + 1} / ${images.length}` : '— / —'}</span>
          </div>
          <div className="image-viewer-play-row">
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleTogglePlay}
              disabled={images.length <= 1}
            >{playing ? '⏹ 停止' : '▶ 再生'}</button>
            <button
              className={`btn btn-sm ${loop ? '' : 'btn-ghost'} image-viewer-loop-btn`}
              onClick={toggleLoop}
              disabled={images.length <= 1}
              title="ループ"
            >⟳ ループ</button>
          </div>
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}

export default ImageViewerDialog
