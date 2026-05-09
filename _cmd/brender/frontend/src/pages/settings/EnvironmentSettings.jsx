import { useState, useEffect } from 'react'
import { Dialogs } from '@wailsio/runtime'
import { EnvironmentApi } from '../../lib/api'

function EnvironmentSettings() {
  const [root, setRoot]       = useState('')
  const [workDir, setWorkDir] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [saved, setSaved]     = useState(false)

  useEffect(() => {
    EnvironmentApi.get()
      .then(env => { if (env) setRoot(env.root || '') })
      .catch(err => setError(String(err)))
    EnvironmentApi.getWorkDir()
      .then(d => setWorkDir(d || ''))
      .catch(() => {})
  }, [])

  const handleSelectDir = async () => {
    setError('')
    setSaved(false)
    try {
      const defaultDir = root || workDir || undefined
      const dir = await Dialogs.OpenFile({
        CanChooseDirectories: true,
        CanChooseFiles: false,
        DefaultDirectory: defaultDir,
      })
      if (!dir) return
      setSaving(true)
      await EnvironmentApi.setRoot({ root: dir })
      setRoot(dir)
      setSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="section-title">作業ディレクトリ</h2>
      <p className="setting-desc">プロジェクトとレンダリング結果を保存するフォルダを指定します。</p>

      <div className="setting-row">
        <span className="setting-path">{root || '未設定'}</span>
        <button className="btn" onClick={handleSelectDir} disabled={saving}>
          {saving ? '保存中...' : 'フォルダを選択'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">保存しました</div>}
    </div>
  )
}

export default EnvironmentSettings
