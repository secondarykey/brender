import { useState, useEffect } from 'react'
import MainLayout from './layouts/MainLayout'
import ProjectListPage from './pages/projects/ProjectListPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import FileDetailPage from './pages/projects/FileDetailPage'
import WorkspaceDetailPage from './pages/projects/WorkspaceDetailPage'
import QueuePage from './pages/queue/QueuePage'
import SettingsPage from './pages/settings/SettingsPage'
import { EnvironmentService } from '../bindings/changeme'

function App() {
  const [nav, setNav] = useState({ page: 'projects', params: {} })

  useEffect(() => {
    EnvironmentService.Get()
      .then(env => {
        if (!env || !env.root) {
          setNav({ page: 'settings', params: {} })
        }
      })
      .catch(() => {})
  }, [])

  const navigate = (page, params = {}) => setNav({ page, params })

  const renderPage = () => {
    const p = nav.params
    switch (nav.page) {
      case 'projects':
        return <ProjectListPage navigate={navigate} />
      case 'project':
        return <ProjectDetailPage id={p.id} navigate={navigate} />
      case 'file':
        return (
          <FileDetailPage
            projectID={p.projectID}
            projectName={p.projectName}
            fileID={p.fileID}
            fileName={p.fileName}
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
            navigate={navigate}
          />
        )
      case 'queue':
        return <QueuePage navigate={navigate} />
      case 'settings':
        return <SettingsPage />
      default:
        return <ProjectListPage navigate={navigate} />
    }
  }

  const section = ['project', 'file', 'workspace'].includes(nav.page) ? 'projects' : nav.page

  return (
    <MainLayout currentPage={section} onNavigate={(p) => navigate(p)}>
      {renderPage()}
    </MainLayout>
  )
}

export default App
