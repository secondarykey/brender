import { useState, useEffect } from 'react'
import { QueueApi } from '../lib/api'

function ImageViewerDialog({ job, onClose }) {
  const [images, setImages]         = useState([])
  const [index, setIndex]           = useState(0)
  const [imgSrc, setImgSrc]         = useState('')
  const [loadingList, setLoadingList] = useState(true)
  const [loadingImg, setLoadingImg] = useState(false)
  const [error, setError]           = useState('')

  // 画像ファイル一覧を取得
  useEffect(() => {
    if (!job) return
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
  useEffect(() => {
    if (images.length === 0) return
    setLoadingImg(true)
    QueueApi.getImageBase64({ path: images[index] })
      .then(src => {
        setImgSrc(src)
        setLoadingImg(false)
      })
      .catch(err => {
        setError(String(err))
        setLoadingImg(false)
      })
  }, [images, index])

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
              onChange={e => setIndex(Number(e.target.value))}
              className="image-viewer-slider"
              disabled={images.length <= 1}
            />
            <span className="image-viewer-counter">{images.length > 0 ? `${index + 1} / ${images.length}` : '— / —'}</span>
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
