import TitleBar from '../components/TitleBar'

function NavItem({ label, icon, active, onClick }) {
  return (
    <button
      className={`nav-item${active ? ' active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
    </button>
  )
}

function MainLayout({ currentPage, onNavigate, children }) {
  const topNav = [
    { id: 'projects', label: 'プロジェクト', icon: '▦' },
    { id: 'queue',    label: 'キュー',         icon: '⏱' },
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
