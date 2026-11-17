import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { QueueApi, WorkspaceApi, EnvironmentApi, CodesApi } from '../../../lib/api'
import { onAppEvent } from '../../../lib/appEvents'
import { useToast, useMessage } from '../../../lib/toast'
import { roleAtLeast } from '../../../lib/roles'
import { MdLoop } from 'react-icons/md'
import { isVideoFile, hasJobData } from './jobFiles'
import { useMoviePlayer } from './useMoviePlayer'
import MovieCreateDialog from './MovieCreateDialog'

const DEFAULT_PLAY_FPS = 30

// 実行結果の「レンダリング結果」タブ。出力の連番画像をスライダーで送り、再生できる。
// editor 以上はいま出している画像をワークスペースのサムネイルにでき、runner 以上は連番から動画を作れる。
export default function RenderResultTab({ job, role }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [images, setImages]             = useState([])
  const [index, setIndex]               = useState(0)
  const [imgSrc, setImgSrc]             = useState('')
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingImg, setLoadingImg]     = useState(false)
  const [playing, setPlaying]           = useState(false)
  const [loop, setLoop]                 = useState(false)
  const [settingThumb, setSettingThumb] = useState(false)
  const [moviePath, setMoviePath]           = useState('')
  const [creatingMovie, setCreatingMovie]   = useState(false)
  const [movieDefaults, setMovieDefaults]   = useState(null) // 動画作成ダイアログを開いているあいだだけ
  const [playFps, setPlayFps]               = useState(DEFAULT_PLAY_FPS)
  const [playMovie, movieDialog]            = useMoviePlayer()
  const loopRef      = useRef(false)
  const shownPathRef = useRef('') // いま imgSrc に出している画像のパス
  const frameStep    = job?.frame_step || 1

  const canSetThumbnail = roleAtLeast(role, 'editor')
  const canCreateMovie  = roleAtLeast(role, 'runner')

  const stopPlay = () => setPlaying(false)
  const toggleLoop = () => { const v = !loopRef.current; loopRef.current = v; setLoop(v) }

  // 再生のフレームレート: ジョブに記録したシーンの FPS → 設定（動画）の FPS → 30
  useEffect(() => {
    if (job?.fps > 0) { setPlayFps(job.fps); return }
    setPlayFps(DEFAULT_PLAY_FPS)
    let alive = true
    EnvironmentApi.get()
      .then(env => { if (alive && env?.ffmpeg_fps > 0) setPlayFps(env.ffmpeg_fps) })
      .catch(() => {})
    return () => { alive = false }
  }, [job])

  useEffect(() => {
    if (!job) return
    stopPlay()
    shownPathRef.current = ''
    setLoadingList(true); setImages([]); setIndex(0); setImgSrc(''); setMoviePath('')
    if (hasJobData(job.data_status)) {
      QueueApi.listJobImages({ id: job.id })
        .then(list => { setImages(list || []); setLoadingList(false) })
        .catch(err => { showError(String(err)); setLoadingList(false) })
    } else {
      setLoadingList(false)
    }
    // 動画ファイルは data_status に関係なく検索（画像削除後も動画だけ残っていれば再生可能）
    QueueApi.listJobFiles({ id: job.id })
      .then(files => {
        const movie = (files || []).find(f => !f.is_dir && isVideoFile(f.name))
        if (movie) setMoviePath(movie.path)
      })
      .catch(err => { console.error('[RenderResultTab] listJobFiles error:', err) })
  }, [job])

  // 止まっている間: 選んだフレームを読み込んで出す
  useEffect(() => {
    if (playing || images.length === 0) return
    const path = images[index]
    if (!path || path === shownPathRef.current) return
    let alive = true
    setLoadingImg(true)
    QueueApi.getImageBase64({ path })
      .then(src => {
        if (!alive) return
        setImgSrc(src); shownPathRef.current = path; setLoadingImg(false)
      })
      .catch(err => { if (alive) { showError(String(err)); setLoadingImg(false) } })
    return () => { alive = false; setLoadingImg(false) }
  }, [images, index, playing])

  // 再生中: 次のフレームを読み込みながら、前のフレームを出してから 1 フレーム分経ったところで出す。
  // frame_step が 2 以上なら 1 枚が step フレーム分なので、その分長く出す（実時間に合わせる）。
  // 読み込みが 1 フレーム分より遅いときは、読み込めしだい出す（遅いぶんは追いつかない）。
  useEffect(() => {
    if (!playing || images.length <= 1) return
    let alive = true
    let timer = null
    const frameMs = 1000 * Math.max(1, frameStep) / playFps
    // 最後のフレームから再生したときは先頭からすぐ出す
    let cur = index >= images.length - 1 ? -1 : index
    let shownAt = performance.now() - (cur === -1 ? frameMs : 0)
    const step = () => {
      let next = cur + 1
      if (next >= images.length) {
        if (!loopRef.current) { stopPlay(); return }
        next = 0
      }
      const path = images[next]
      QueueApi.getImageBase64({ path })
        .then(src => {
          if (!alive) return
          timer = setTimeout(() => {
            if (!alive) return
            setImgSrc(src); shownPathRef.current = path; setIndex(next)
            cur = next; shownAt = performance.now()
            step()
          }, Math.max(0, shownAt + frameMs - performance.now()))
        })
        .catch(err => { if (alive) { showError(String(err)); stopPlay() } })
    }
    step()
    return () => { alive = false; clearTimeout(timer) }
    // index は再生を始めた位置としてだけ読む（再生中の setIndex で作り直さない）
  }, [playing, images, playFps, frameStep])

  const handleTogglePlay = () => {
    if (images.length <= 1) return
    setPlaying(p => !p)
  }

  const handleSetThumbnail = async () => {
    if (settingThumb || !images[index]) return
    setSettingThumb(true)
    try {
      await WorkspaceApi.setThumbnail({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        imagePath:   images[index],
      })
      showToast(t('viewer.thumbnailSet'))
    } catch (e) { showError(String(e)) }
    finally { setSettingThumb(false) }
  }

  useEffect(() => {
    return onAppEvent('movie:created', (data) => {
      if (data.job_id !== job.id) return
      setCreatingMovie(false)
      if (data.error) {
        showError(data.error)
      } else {
        setMoviePath(data.path || '')
        showToast(t('viewer.movieCreated'))
      }
    })
  }, [job.id, t, showToast, showError])

  const handleOpenMovieDialog = async () => {
    // FPS の初期値: ジョブに記録したシーンの FPS（frame_step で間引いた分は割る。動画の FPS は整数）→ 設定の FPS → 30
    const jobMovieFps = job?.fps > 0 ? Math.max(1, Math.round(job.fps / frameStep)) : 0
    let env = null
    let videoFormats = []
    try {
      const [e, formats] = await Promise.all([
        EnvironmentApi.get(),
        CodesApi.getVideoFormats(),
      ])
      env = e
      videoFormats = formats || []
    } catch (_) {}
    setMovieDefaults({
      fps:       String(jobMovieFps > 0 ? jobMovieFps : (env?.ffmpeg_fps > 0 ? env.ffmpeg_fps : 30)),
      outext:    env?.ffmpeg_out_ext || 'mp4',
      extraArgs: env?.ffmpeg_args || '',
      videoFormats,
    })
  }

  const handleCreateMovie = async ({ fps, outext, extraArgs }) => {
    setMovieDefaults(null)
    showError('')
    setCreatingMovie(true)
    try {
      await WorkspaceApi.createMovie({
        projectID:   job.project_id,
        fileID:      job.project_file_id,
        workspaceID: job.workspace_id,
        jobID:       job.id,
        fps:         parseInt(fps, 10) || 30,
        outext:      outext || 'mp4',
        extraArgs,
      })
    } catch (e) {
      setCreatingMovie(false)
      showError(String(e))
    }
  }

  const filename = images[index] ? images[index].replace(/\\/g, '/').split('/').pop() : ''

  return (
    <div className="job-page-viewer">
      {canSetThumbnail && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <button className="btn btn-sm btn-outline" onClick={handleSetThumbnail} disabled={settingThumb || images.length === 0}>
            {settingThumb ? '...' : t('viewer.setAsThumbnail')}
          </button>
        </div>
      )}

      <div className="image-viewer-body">
        {loadingList && <div className="image-viewer-loading">{t('common.loading')}</div>}
        {imgSrc && <img src={imgSrc} alt={filename} className="image-viewer-img" />}
        {!loadingList && !imgSrc && images.length === 0 && (
          <div className="image-viewer-empty">{t('viewer.noImages')}</div>
        )}
      </div>

      <div className="image-viewer-controls" style={{ visibility: images.length > 0 ? 'visible' : 'hidden' }}>
        <span className="image-viewer-filename" title={filename}>
          {filename}{loadingImg && <span className="image-viewer-loading-inline"> {t('common.loading')}</span>}
        </span>
        <div className="image-viewer-slider-row">
          <input
            type="range" min={0} max={Math.max(0, images.length - 1)} value={index}
            onChange={e => { stopPlay(); setIndex(Number(e.target.value)) }}
            className="image-viewer-slider" disabled={images.length <= 1}
          />
          <span className="image-viewer-counter">{images.length > 0 ? `${index + 1} / ${images.length}` : '— / —'}</span>
        </div>
      </div>

      <div className="dialog-actions" style={{ justifyContent: 'space-between', visibility: images.length > 0 || moviePath ? 'visible' : 'hidden', marginTop: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-ghost" onClick={handleTogglePlay} disabled={images.length <= 1}
            title={`${Math.round(playFps * 100) / 100} fps`}
          >
            {playing ? t('viewer.stop') : t('viewer.play')}
          </button>
          <button
            className={`btn btn-sm ${loop ? '' : 'btn-ghost'} image-viewer-loop-btn`}
            onClick={toggleLoop} disabled={images.length <= 1} title={t('common.loop')}
          ><MdLoop /> {t('common.loop')}</button>
          {moviePath && (
            <button className="btn btn-sm" onClick={() => playMovie(moviePath)}>
              {t('viewer.playMovie')}
            </button>
          )}
        </div>
        {canCreateMovie && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="btn btn-sm btn-green" onClick={handleOpenMovieDialog} disabled={creatingMovie || images.length <= 1}>
              {creatingMovie ? t('viewer.movieCreating') : t('viewer.createMovie')}
            </button>
          </div>
        )}
      </div>

      {movieDefaults && (
        <MovieCreateDialog
          defaults={movieDefaults}
          onClose={() => setMovieDefaults(null)}
          onCreate={handleCreateMovie}
        />
      )}

      {movieDialog}
    </div>
  )
}
