import { useState, useEffect } from 'react'
import { ToastProvider } from './lib/toast'
import MainLayout from './layouts/MainLayout'
import ProjectListPage from './pages/projects/ProjectListPage'
import ProjectDetailPage from './pages/projects/ProjectDetailPage'
import FileDetailPage from './pages/projects/FileDetailPage'
import JobPage from './pages/projects/JobPage'
import QueuePage from './pages/queue/QueuePage'
import SettingsPage from './pages/settings/SettingsPage'
import SearchPage from './pages/search/SearchPage'
import UsersPage from './pages/users/UsersPage'
import LoginPage from './pages/login/LoginPage'
import { EnvironmentApi, WorkDirApi, AuthApi } from './lib/api'
import { isWails } from './lib/api/_client'

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
  // ログイン状態管理（サーバモード + 認証ON の場合のみ使用）
  const [authChecked, setAuthChecked] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)

  // サーバモードの認証チェック
  useEffect(() => {
    if (isWails()) {
      // Wails モードではログイン不要
      setAuthChecked(true)
      return
    }
    // サーバモード: 認証が有効かチェック → 有効ならセッション検証
    AuthApi.isAuthEnabled()
      .then(enabled => {
        if (!enabled) {
          setAuthChecked(true)
          return
        }
        // セッション検証
        return AuthApi.me().then(user => {
          if (!user) {
            setNeedsLogin(true)
          }
          setAuthChecked(true)
        })
      })
      .catch(() => {
        // エラー時はログイン不要とみなす
        setAuthChecked(true)
      })
  }, [])

  useEffect(() => {
    // ログインが必要な場合や認証チェック中はスキップ
    if (!authChecked || needsLogin) return
    WorkDirApi.list()
      .then(list => {
        const hasActive = (list || []).some(w => w.status === 'active')
        if (!hasActive) setNav({ page: 'settings', params: { tab: 'directory' } })
      })
      .catch(() => {})
  }, [authChecked, needsLogin])

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
      // ワークスペースは単独のページを持たず、ファイル画面の中で開く。
      // 'workspace' は「そのワークスペースを開いた状態のファイル画面」への入口として残してある。
      case 'file':
      case 'workspace':
        return (
          <FileDetailPage
            key={p.fileID || p.workspaceID}
            projectID={p.projectID}
            projectName={p.projectName}
            fileID={p.fileID}
            fileName={p.fileName}
            workspaceID={p.workspaceID}
            focusName={p.focusName}
            initialTab={p.initialTab}
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
      case 'search':
        return <SearchPage navigate={navigate} />
      case 'queue':
        return <QueuePage key={queueKey} navigate={navigate} />
      case 'users':
        return <UsersPage navigate={navigate} />
      case 'settings':
        return <SettingsPage initialTab={p.tab} navigate={navigate} />
      default:
        return <ProjectListPage navigate={navigate} />
    }
  }

  const section = ['project', 'file', 'workspace', 'job'].includes(nav.page) ? 'projects' : nav.page

  // 認証チェック中はローディング表示
  if (!authChecked) {
    return (
      <ToastProvider>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg)' }}>
          <span style={{ color: 'rgba(var(--fg), 0.4)' }}>Loading...</span>
        </div>
      </ToastProvider>
    )
  }

  // ログインが必要な場合
  if (needsLogin) {
    return (
      <ToastProvider>
        <LoginPage onLogin={() => setNeedsLogin(false)} />
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <MainLayout currentPage={section} onNavigate={(p) => navigate(p)}>
        {renderPage()}
      </MainLayout>
    </ToastProvider>
  )
}

export default App
