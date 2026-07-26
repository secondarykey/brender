import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthApi } from '../../lib/api'

function LoginPage({ onLogin }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !password) return

    setLoading(true)
    setError('')
    try {
      const user = await AuthApi.login({ name: name.trim(), password })
      if (user) {
        onLogin(user)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Brender</h1>
        <p className="login-subtitle">{t('login.subtitle')}</p>
        <p style={{ textAlign: 'center', marginBottom: 16 }}>
          <span className="badge-experimental">{t('common.experimental')}</span>
        </p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label">{t('login.loginId')}</label>
            <input
              className="form-input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="username"
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="form-label">{t('login.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ width: '100%' }}
            />
          </div>
          <button
            type="submit"
            className="btn btn-green login-btn"
            disabled={loading || !name.trim() || !password}
          >
            {loading ? t('login.loggingIn') : t('login.login')}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
