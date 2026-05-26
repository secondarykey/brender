import ReactDOM from 'react-dom/client'
import App from './App'
import LogViewerApp from './LogViewerApp'
import MovieViewerApp from './MovieViewerApp'
import MiniMonitorApp from './MiniMonitorApp'
import './languages'
import { initTheme } from './lib/theme'

initTheme()

const params = new URLSearchParams(window.location.search)
const isLogWindow = params.has('log') || params.has('syslog')
const moviePath = params.get('movie')
const isMiniMonitor = params.has('minimonitor')

let Root

if (moviePath) {
  Root = MovieViewerApp
} else if (isLogWindow) {
  Root = LogViewerApp
} else if (isMiniMonitor) {
  Root = MiniMonitorApp
} else {
  Root = App
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
