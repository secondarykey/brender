import { VideoPlayer } from './App'
import LogTitleBar from './components/LogTitleBar'

function MovieViewerApp() {
  const params    = new URLSearchParams(window.location.search)
  const moviePath = params.get('movie') || ''
  const title     = moviePath.replace(/\\/g, '/').split('/').pop()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000' }}>
      <LogTitleBar title={title} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <VideoPlayer path={moviePath} />
      </div>
    </div>
  )
}

export default MovieViewerApp
