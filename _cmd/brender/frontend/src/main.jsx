import ReactDOM from 'react-dom/client'
import App from './App'
import LogViewerApp from './LogViewerApp'
import './languages'

const isLogWindow = new URLSearchParams(window.location.search).has('log')
const Root = isLogWindow ? LogViewerApp : App

ReactDOM.createRoot(document.getElementById('root')).render(<Root />)
