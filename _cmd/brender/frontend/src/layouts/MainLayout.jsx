import { useState, useEffect } from 'react'
import { QueueApi, EnvironmentApi } from '../lib/api'
import { onAppEvent } from '../lib/appEvents'
import TitleBar from '../components/TitleBar'
import { useTranslation } from "react-i18next"
import { useToast, useMessage } from '../lib/toast'
import { isWails } from '../lib/api/_client'
import { MdGridView, MdSearch, MdSchedule, MdPerson, MdSettings } from 'react-icons/md'


function NavItem({ label, icon, active, onClick, badge }) {
  return (
    <button
      className={`nav-item${active ? ' active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="nav-icon">{icon}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

function MainLayout({ currentPage, onNavigate, children }) {

  const { t } = useTranslation()
  const { toast } = useToast()
  const { error, clearError, showError } = useMessage()
  const [queueCount, setQueueCount] = useState(0)
  const [serverMode, setServerMode] = useState(false)

  useEffect(() => {
    // 初期件数取得
    QueueApi.list().then(list => setQueueCount((list || []).length)).catch(() => {})
    // イベント購読
    const off = onAppEvent('queue:changed', data => setQueueCount(Number(data) || 0))
    return off
  }, [])

  useEffect(() => {
    if (isWails()) {
      EnvironmentApi.get()
        .then(env => { if (env?.server && env?.server_auth) setServerMode(true) })
        .catch(() => {})
    }
  }, [])

  useEffect(() => {
    const off = onAppEvent('blender:warning', data => {
      const warnings = Array.isArray(data) ? data : [data]
      if (warnings.length > 0) {
        showError(warnings.join('\n'))
      }
    })
    return off
  }, [])

  const topNav = [
    { id: 'projects', label: t('menu.project'), icon: <MdGridView /> },
    { id: 'search',   label: t('menu.search'),  icon: <MdSearch /> },
    { id: 'queue',    label: t('menu.queue'),    icon: <MdSchedule />, badge: queueCount },
  ]

  const bottomNav = [
    ...(serverMode ? [
      { id: 'users', label: t('menu.users'), icon: <MdPerson /> },
    ] : []),
    { id: 'settings', label: t('menu.settings'), icon: <MdSettings /> },
  ]

  return (
    <div className="app-frame">
      {isWails() && <TitleBar />}
      {error && (
        <div className="app-message-bar">
          <span className="app-message-text" style={{ whiteSpace: 'pre-line' }}>{error}</span>
          <button className="app-message-close" onClick={clearError} aria-label="close">×</button>
        </div>
      )}
      <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <nav className="nav-top">
            {topNav.map(item => (
              <NavItem
                key={item.id}
                {...item}
                active={currentPage === item.id}
                onClick={() => onNavigate(item.id)}
                badge={item.badge || 0}
              />
            ))}
          </nav>
        </div>
        <nav className="nav-bottom">
          {bottomNav.map(item => (
            <NavItem
              key={item.id}
              {...item}
              active={currentPage === item.id}
              onClick={() => onNavigate(item.id)}
            />
          ))}
        </nav>
      </aside>
      <main className="content">
        {children}
      </main>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default MainLayout
