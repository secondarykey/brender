import ReactDOM from 'react-dom/client'
import App from './App'
import LogViewerApp from './LogViewerApp'
import './languages'

const params = new URLSearchParams(window.location.search)
const isLogWindow = params.has('log') || params.has('syslog')
const Root = isLogWindow ? LogViewerApp : App

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
