import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, WorkspaceApi } from '../lib/api'
import Dialog from './Dialog'

function ImageViewerDialog({ job, onClose }) {
  const { t } = useTranslation()
  const [images, setImages]               = useState([])
  const [index, setIndex]                 = useState(0)
  const [imgSrc, setImgSrc]               = useState('')
  const [loadingList, setLoadingList]     = useState(true)
  const [loadingImg, setLoadingImg]       = useState(false)
  const [error, setError]                 = useState('')
  const [playing, setPlaying]             = useState(false)
  const [loop, setLoop]                   = useState(false)
  const [thumbMsg, setThumbMsg]           = useState('')
  const [settingThumb, setSettingThumb]   = useState(false)
  const playingRef                        = useRef(false)
  const loopRef                           = useRef(false)

  const stopPlay = () => { playingRef.current = false; setPlaying(false) }
  const toggleLoop = () => { const v = !loopRef.current; loopRef.current = v; setLoop(v) }

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
            if (loopRef.current) return 0
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
      setIndex(0)
    } else if (!loadingImg) {
      setIndex(prev => prev + 1)
    }
  }

  const handleSetThumbnail = async () => {
    if (settingThumb || !images[index]) return
    setSettingThumb(true)
    setThumbMsg('')
    try {
      await WorkspaceApi.setThumbnail({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        imagePath:   images[index],
      })
      setThumbMsg(t('viewer.thumbnailSet'))
    } catch (e) {
      setThumbMsg(String(e))
    } finally {
      setSettingThumb(false)
    }
  }

  const handleCreateMovie = async () => {
    try {
      await WorkspaceApi.createMovie({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        jobID:       job.id,
      })
      setThumbMsg(t('viewer.movieCreated'))
    } catch (e) {
      setThumbMsg(String(e))
    }
  }

  if (!job) return null

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <Dialog
      open
      className="image-viewer-dialog"
      title={`${t('dialog.renderResults')}${job.workspace_name}`}
      onClose={onClose}
      message={thumbMsg || undefined}
      messageSeverity="info"
    >
      <div className="image-viewer-body">
        {loadingList && <div className="image-viewer-loading">{t('common.loading')}</div>}
        {imgSrc && (
          <img src={imgSrc} alt={filename} className="image-viewer-img" />
        )}
        {!loadingList && !imgSrc && !error && images.length === 0 && (
          <div className="image-viewer-empty">{t('viewer.noImages')}</div>
        )}
        {error && <div className="error-msg">{error}</div>}
      </div>

      <div className="image-viewer-controls" style={{ visibility: images.length > 0 ? 'visible' : 'hidden' }}>
        <span className="image-viewer-filename" title={filename}>
          {filename}{loadingImg && <span className="image-viewer-loading-inline"> {t('common.loading')}</span>}
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
      </div>

      <div className="dialog-actions" style={{ justifyContent: 'space-between', visibility: images.length > 0 ? 'visible' : 'hidden' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-ghost"
            onClick={handleTogglePlay}
            disabled={images.length <= 1}
          >{playing ? t('viewer.stop') : t('viewer.play')}</button>
          <button
            className={`btn btn-sm ${loop ? '' : 'btn-ghost'} image-viewer-loop-btn`}
            onClick={toggleLoop}
            disabled={images.length <= 1}
            title={t('common.loop')}
          >⟳ {t('common.loop')}</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

          <button
            className="btn btn-sm btn-green"
            onClick={handleCreateMovie}
            disabled={settingThumb || images.length === 0}
          >{t('viewer.createMovie')}</button>

          <button
            className="btn btn-sm btn-outline"
            onClick={handleSetThumbnail}
            disabled={settingThumb || images.length === 0}
          >{settingThumb ? '...' : t('viewer.setAsThumbnail')}</button>

          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </Dialog>
  )
}

export default ImageViewerDialog
