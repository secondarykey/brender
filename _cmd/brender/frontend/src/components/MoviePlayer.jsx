import { useState, useRef, useCallback } from 'react'

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

/**
 * 動画プレーヤーコンポーネント（MovieViewerApp と共通ロジック）
 * @param {{ moviePath: string, showInfo?: boolean }} props
 */
function MoviePlayer({ moviePath, showInfo = true }) {
  const videoRef    = useRef(null)
  const rafIdRef    = useRef(null)
  const fpsTimesRef = useRef([])

  const [info, setInfo] = useState({ width: 0, height: 0, duration: 0, fps: null })

  const handleMetadata = (e) => {
    const video = e.currentTarget
    setInfo(prev => ({ ...prev, width: video.videoWidth, height: video.videoHeight, duration: video.duration }))
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
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
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
  )
}

export default MoviePlayer
