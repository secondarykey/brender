import { useState, useRef, useCallback } from 'react'
import MovieTitleBar from './components/MovieTitleBar'

const TITLEBAR_H = 48

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

function aspectRatio(w, h) {
  const g = gcd(w, h)
  return `${w / g}:${h / g}`
}

function formatDuration(sec) {
  if (!isFinite(sec) || sec <= 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

function MovieViewerApp() {
  const params    = new URLSearchParams(window.location.search)
  const moviePath = params.get('movie') || ''
  const title     = moviePath.replace(/\\/g, '/').split('/').pop()

  const videoRef      = useRef(null)
  const rafIdRef      = useRef(null)
  const fpsTimesRef   = useRef([])

  const [showInfo, setShowInfo] = useState(true)
  const [info, setInfo]         = useState({ width: 0, height: 0, duration: 0, fps: null })

  const handleMetadata = async (e) => {
    const video = e.currentTarget
    const vw = video.videoWidth
    const vh = video.videoHeight
    setInfo(prev => ({ ...prev, width: vw, height: vh, duration: video.duration }))
    if (!vw || !vh) return
    try {
      const { Window } = await import('@wailsio/runtime')
      const maxW = Math.min(screen.width  * 0.9, 1920)
      const maxH = Math.min(screen.height * 0.9, 1080)
      const scale = Math.min(maxW / vw, (maxH - TITLEBAR_H) / vh, 1)
      await Window.SetSize(Math.round(vw * scale), Math.round(vh * scale) + TITLEBAR_H)
      Window.Centre()
    } catch (_) {}
  }

  const measureFps = useCallback((now) => {
    const video = videoRef.current
    if (!video) return
    fpsTimesRef.current.push(now)
    const cutoff = now - 2000
    fpsTimesRef.current = fpsTimesRef.current.filter(t => t >= cutoff)
    const samples = fpsTimesRef.current
    if (samples.length >= 8) {
      const fps = Math.round((samples.length - 1) * 1000 / (now - samples[0]))
      setInfo(prev => prev.fps === fps ? prev : { ...prev, fps })
    }
    if (!video.paused && !video.ended) {
      rafIdRef.current = video.requestVideoFrameCallback(measureFps)
    }
  }, [])

  const handlePlay = useCallback(() => {
    const video = videoRef.current
    if (video?.requestVideoFrameCallback) {
      fpsTimesRef.current = []
      rafIdRef.current = video.requestVideoFrameCallback(measureFps)
    }
  }, [measureFps])

  const handlePause = useCallback(() => {
    const video = videoRef.current
    if (video?.cancelVideoFrameCallback && rafIdRef.current != null) {
      video.cancelVideoFrameCallback(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  const hasInfo = info.width > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
      <MovieTitleBar title={title} showInfo={showInfo} onToggleInfo={() => setShowInfo(v => !v)} />
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <video
          ref={videoRef}
          src={`/_movie?path=${encodeURIComponent(moviePath)}`}
          controls
          autoPlay
          loop
          onLoadedMetadata={handleMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handlePause}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
        {showInfo && hasInfo && (
          <div className="movie-info-overlay">
            <div>{info.width} × {info.height}　{aspectRatio(info.width, info.height)}</div>
            <div>{formatDuration(info.duration)}</div>
            {info.fps !== null && <div>{info.fps} fps</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default MovieViewerApp
