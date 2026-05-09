import { useState, useEffect } from 'react'
import { QueueApi } from '../lib/api'
import { onAppEvent } from '../lib/appEvents'
import TitleBar from '../components/TitleBar'

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
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    // 初期件数取得
    QueueApi.list().then(list => setQueueCount((list || []).length)).catch(() => {})
    // イベント購読
    const off = onAppEvent('queue:changed', data => setQueueCount(Number(data) || 0))
    return off
  }, [])

  const topNav = [
    { id: 'projects', label: 'プロジェクト', icon: '▦' },
    { id: 'queue',    label: 'キュー',         icon: '⏱', badge: queueCount },
  ]

  const bottomNav = [
    { id: 'settings', label: '設定', icon: '⚙' },
  ]

  return (
    <div className="app-frame">
      <TitleBar />
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
    </div>
  )
}

export default MainLayout
