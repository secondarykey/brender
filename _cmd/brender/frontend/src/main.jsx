import ReactDOM from 'react-dom/client'
import App, { VideoPlayer } from './App'
import LogViewerApp from './LogViewerApp'
import './languages'

const params = new URLSearchParams(window.location.search)
const moviePath = params.get('movie')
const isLogWindow = params.has('log')

let Root
if (moviePath) {
  Root = () => <VideoPlayer path={moviePath} />
} else if (isLogWindow) {
  Root = LogViewerApp
} else {
  Root = App
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
