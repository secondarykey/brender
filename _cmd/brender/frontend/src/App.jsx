import { useState, useEffect } from 'react'
import { ToastProvider } from './lib/toast'
import MainLayout from './layouts/MainLayout'
import ProjectListPage from './pages/projects/ProjectListPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import FileDetailPage from './pages/projects/FileDetailPage'
import WorkspaceDetailPage from './pages/projects/WorkspaceDetailPage'
import JobPage from './pages/projects/JobPage'
import QueuePage from './pages/queue/QueuePage'
import SettingsPage from './pages/settings/SettingsPage'
import DirectoryPage from './pages/directory/DirectoryPage'
import { EnvironmentApi, WorkDirApi } from './lib/api'

export function VideoPlayer({ path }) {
  const handleMetadata = async (e) => {
    const video = e.currentTarget
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return
    try {
      const { Window } = await import('@wailsio/runtime')
      const maxW = Math.min(screen.width  * 0.9, 1920)
      const maxH = Math.min(screen.height * 0.9, 1080)
      const scale = Math.min(maxW / vw, maxH / vh, 1)
      const w = Math.round(vw * scale)
      const h = Math.round(vh * scale)
      await Window.SetSize(w, h)
      Window.Centre()
    } catch (_) {
      // Wails runtime が利用できない環境（ブラウザ等）では無視
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <video
        src={`/_movie?path=${encodeURIComponent(path)}`}
        controls
        autoPlay
        loop
        onLoadedMetadata={handleMetadata}
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />
    </div>
  )
}

function App() {

  const [nav, setNav]         = useState({ page: 'projects', params: {} })
  const [queueKey, setQueueKey] = useState(0)

  useEffect(() => {
    WorkDirApi.list()
      .then(list => {
        const hasActive = (list || []).some(w => w.status === 'active')
        if (!hasActive) setNav({ page: 'directory', params: {} })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const handler = e => {
      if (e.key === 'F12') EnvironmentApi.openSystemLogWindow()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const navigate = (page, params = {}) => {
    if (page === 'queue') setQueueKey(k => k + 1)
    setNav({ page, params })
  }

  const renderPage = () => {
    const p = nav.params
    switch (nav.page) {
      case 'projects':
        return <ProjectListPage navigate={navigate} />
      case 'project':
        return <ProjectDetailPage id={p.id} initialTab={p.initialTab} focusName={p.focusName} navigate={navigate} />
      case 'file':
        return (
          <FileDetailPage
            projectID={p.projectID}
            projectName={p.projectName}
            fileID={p.fileID}
            fileName={p.fileName}
            initialTab={p.initialTab}
            navigate={navigate}
          />
        )
      case 'workspace':
        return (
          <WorkspaceDetailPage
            projectID={p.projectID}
            projectName={p.projectName}
            fileID={p.fileID}
            fileName={p.fileName}
            workspaceID={p.workspaceID}
            focusName={p.focusName}
            navigate={navigate}
          />
        )
      case 'job':
        return (
          <JobPage
            job={p.job}
            jobID={p.jobID}
            navigate={navigate}
            backPage={p.backPage}
            backParams={p.backParams}
            initialTab={p.initialTab}
          />
        )
      case 'queue':
        return <QueuePage key={queueKey} navigate={navigate} />
      case 'directory':
        return <DirectoryPage initialTab={p.tab} navigate={navigate} />
      case 'settings':
        return <SettingsPage initialTab={p.tab} navigate={navigate} />
      default:
        return <ProjectListPage navigate={navigate} />
    }
  }

  const section = ['project', 'file', 'workspace', 'job'].includes(nav.page) ? 'projects' : nav.page

  return (
    <ToastProvider>
      <MainLayout currentPage={section} onNavigate={(p) => navigate(p)}>
        {renderPage()}
      </MainLayout>
    </ToastProvider>
  )
}

export default App
