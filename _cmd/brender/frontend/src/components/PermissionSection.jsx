import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, AuthApi } from '../lib/api'
import { useToast, useMessage } from '../lib/toast'
import Dialog from './Dialog'
import ConfirmDialog from './ConfirmDialog'

const ROLES = ['owner', 'runner', 'editor', 'viewer']

/**
 * PermissionSection — プロジェクト権限の折りたたみセクション
 * @param {{ projectID: string }} props
 */
function PermissionSection({ projectID }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()

  const [open, setOpen]           = useState(false)
  const [perms, setPerms]         = useState([])
  const [edited, setEdited]       = useState({})  // targetID -> newRole
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)

  // 追加ダイアログ
  const [addOpen, setAddOpen]     = useState(false)
  const [addType, setAddType]     = useState('user') // 'user' | 'group'
  const [addTarget, setAddTarget] = useState('')
  const [addRole, setAddRole]     = useState('viewer')
  const [users, setUsers]         = useState([])
  const [groups, setGroups]       = useState([])
  const [addBusy, setAddBusy]     = useState(false)

  // 削除確認
  const [removeTarget, setRemoveTarget] = useState(null) // { target_id, target_name }
  const [removing, setRemoving]   = useState(false)

  const load = () => {
    ProjectApi.listPermissions({ projectID })
      .then(list => {
        setPerms(list || [])
        setEdited({})
        setDirty(false)
      })
      .catch(err => showError(String(err)))
  }

  useEffect(() => {
    if (open) load()
  }, [open, projectID])

  const handleRoleChange = (targetID, newRole) => {
    const original = perms.find(p => p.target_id === targetID)
    setEdited(prev => {
      const next = { ...prev }
      if (original && original.role === newRole) {
        delete next[targetID]
      } else {
        next[targetID] = newRole
      }
      return next
    })
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const entries = Object.entries(edited)
      for (const [targetID, role] of entries) {
        await ProjectApi.setPermission({ projectID, targetID, role })
      }
      showToast(t('permission.saved'))
      load()
    } catch (err) {
      showError(String(err))
    } finally {
      setSaving(false)
    }
  }

  // 追加ダイアログを開くとき、ユーザ/グループ一覧を取得
  const openAddDialog = async () => {
    try {
      const [u, g] = await Promise.all([
        AuthApi.listUsers(),
        AuthApi.listGroups(),
      ])
      setUsers(u || [])
      setGroups(g || [])
      setAddType('user')
      setAddRole('viewer')
      setAddTarget('')
      setAddOpen(true)
    } catch (err) {
      showError(String(err))
    }
  }

  // 追加ダイアログの候補（既に設定済みのものを除外）
  const existingIDs = new Set(perms.map(p => p.target_id))
  const candidates = addType === 'user'
    ? users.filter(u => !existingIDs.has(u.id))
    : groups.filter(g => !existingIDs.has(g.id))

  const handleAdd = async () => {
    if (!addTarget) return
    setAddBusy(true)
    try {
      await ProjectApi.setPermission({ projectID, targetID: addTarget, role: addRole })
      showToast(t('permission.saved'))
      setAddOpen(false)
      load()
    } catch (err) {
      showError(String(err))
    } finally {
      setAddBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await ProjectApi.removePermission({ projectID, targetID: removeTarget.target_id })
      showToast(t('permission.removed'))
      setRemoveTarget(null)
      load()
    } catch (err) {
      showError(String(err))
    } finally {
      setRemoving(false)
    }
  }

  const hasChanges = Object.keys(edited).length > 0

  return (
    <div style={{ marginTop: 24 }}>
      <h3
        className="ws-detail-section-title"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        {open ? '▾' : '▸'} {t('permission.title')}
      </h3>

      {open && (
        <div>
          {perms.length === 0 ? (
            <p style={{ fontSize: 13, color: 'rgba(var(--fg), 0.4)' }}>
              {t('permission.noPermissions')}
            </p>
          ) : (
            <table className="perm-table">
              <thead>
                <tr>
                  <th>{t('permission.target')}</th>
                  <th>{t('permission.role')}</th>
                  <th style={{ width: 60 }}>{t('permission.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {perms.map(p => {
                  const currentRole = edited[p.target_id] ?? p.role
                  const isUser = p.target_id.startsWith('usr_')
                  return (
                    <tr key={p.target_id}>
                      <td>
                        <span className={`perm-type-badge ${isUser ? 'perm-type-user' : 'perm-type-group'}`}>
                          {isUser ? t('permission.user') : t('permission.group')}
                        </span>
                        {p.target_name}
                        {p.target_is_system && (
                          <span className="perm-system-badge">{t('users.systemBadge')}</span>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={currentRole}
                          onChange={e => handleRoleChange(p.target_id, e.target.value)}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{t(`permission.roles.${r}`)}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-icon-danger"
                          title={t('common.delete')}
                          onClick={() => setRemoveTarget({ target_id: p.target_id, target_name: p.target_name })}
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'space-between' }}>
            <button className="btn btn-sm btn-outline" onClick={openAddDialog}>
              {t('permission.add')}
            </button>
            {hasChanges && (
              <button className="btn btn-sm btn-green" onClick={handleSave} disabled={saving}>
                {saving ? t('common.saving') : t('common.save')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 追加ダイアログ */}
      <Dialog
        open={addOpen}
        title={t('permission.addTitle')}
        onClose={() => setAddOpen(false)}
        closeOnBackdrop={!addBusy}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setAddOpen(false)} disabled={addBusy}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-green"
              onClick={handleAdd}
              disabled={addBusy || !addTarget}
            >
              {t('common.create')}
            </button>
          </>
        }
      >
        <div className="form" style={{ maxWidth: 400 }}>
          {/* ユーザ/グループ切り替え */}
          <div className="form-field">
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                className={`btn btn-sm ${addType === 'user' ? '' : 'btn-outline'}`}
                onClick={() => { setAddType('user'); setAddTarget('') }}
              >
                {t('permission.user')}
              </button>
              <button
                className={`btn btn-sm ${addType === 'group' ? '' : 'btn-outline'}`}
                onClick={() => { setAddType('group'); setAddTarget('') }}
              >
                {t('permission.group')}
              </button>
            </div>
          </div>

          {/* 対象セレクト */}
          <div className="form-field">
            <label className="form-label">{t('permission.addTarget')}</label>
            {candidates.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(var(--fg), 0.4)' }}>
                {t('permission.noTargets')}
              </p>
            ) : (
              <select
                className="form-select"
                style={{ width: '100%' }}
                value={addTarget}
                onChange={e => setAddTarget(e.target.value)}
              >
                <option value="">---</option>
                {candidates.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.display_name || c.name}
                    {c.is_system ? ` (${t('users.systemBadge')})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* ロールセレクト */}
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="form-label">{t('permission.role')}</label>
            <select
              className="form-select"
              style={{ width: '100%' }}
              value={addRole}
              onChange={e => setAddRole(e.target.value)}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>{t(`permission.roles.${r}`)}</option>
              ))}
            </select>
          </div>
        </div>
      </Dialog>

      {/* 削除確認 */}
      <ConfirmDialog
        open={!!removeTarget}
        title={t('permission.confirmRemove')}
        onCancel={() => setRemoveTarget(null)}
        onConfirm={handleRemove}
        confirmLabel={removing ? t('common.deleting') : t('common.delete')}
        busy={removing}
      >
        {removeTarget && (
          <p>
            <span className="dialog-label">{t('permission.target')}</span>
            {removeTarget.target_name}
          </p>
        )}
      </ConfirmDialog>
    </div>
  )
}

export default PermissionSection
