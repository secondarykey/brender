import ReactDOM from 'react-dom/client'
import App from './App'
import LogViewerApp from './LogViewerApp'
import MovieViewerApp from './MovieViewerApp'
import './languages'

const params = new URLSearchParams(window.location.search)
const isLogWindow = params.has('log') || params.has('syslog')
const moviePath = params.get('movie')

let Root

if (moviePath) {
  Root = MovieViewerApp
} else if (isLogWindow) {
  Root = LogViewerApp
} else {
  Root = App
}

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
