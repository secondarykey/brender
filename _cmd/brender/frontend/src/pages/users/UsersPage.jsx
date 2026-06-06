import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthApi, EnvironmentApi } from '../../lib/api'
import { isWails } from '../../lib/api/_client'
import { useToast, useMessage } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'
import Dialog from '../../components/Dialog'

// ── ユーザ編集ダイアログ ──────────────────────────────────────
function UserDialog({ open, user, onClose, onSaved }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!user
  const isSystem = user?.is_system

  useEffect(() => {
    if (open) {
      setName(user?.name || '')
      setDisplayName(user?.display_name || '')
      setError('')
    }
  }, [open, user])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await AuthApi.updateUser({ id: user.id, name: name.trim(), displayName: displayName.trim() })
      } else {
        // 新規作成: name が空ならサーバ側でIDと同じ値を設定
        await AuthApi.createUser({ name: name.trim(), displayName: displayName.trim() })
      }
      showToast(t('common.saved'))
      onSaved()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={isEdit ? t('users.editUser') : t('users.createUser')}
      onClose={onClose}
      closeOnBackdrop={!saving}
      message={error || undefined}
      messageSeverity="error"
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-green" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <div className="form" style={{ maxWidth: 400 }}>
        <div className="form-field">
          <label className="form-label">{t('users.loginId')}</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            disabled={isSystem}
            placeholder={!isEdit ? t('users.loginIdPlaceholder') : ''}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
          <span className="form-hint">{t('users.loginIdHint')}</span>
        </div>
        <div className="form-field" style={{ marginTop: 12 }}>
          <label className="form-label">{t('users.displayName')}</label>
          <input
            className="form-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoFocus
            style={{ width: '100%' }}
          />
        </div>
        {isEdit && (
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="form-label">{t('users.id')}</label>
            <input className="form-input" value={user.id} disabled style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }} />
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ── グループ編集ダイアログ ────────────────────────────────────
function GroupDialog({ open, group, onClose, onSaved }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!group

  useEffect(() => {
    if (open) {
      setDisplayName(group?.display_name || '')
      setError('')
    }
  }, [open, group])

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError(t('users.displayNameRequired'))
      return
    }
    setSaving(true)
    setError('')
    try {
      if (isEdit) {
        await AuthApi.updateGroup({ id: group.id, displayName: displayName.trim() })
      } else {
        await AuthApi.createGroup({ displayName: displayName.trim() })
      }
      showToast(t('common.saved'))
      onSaved()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={isEdit ? t('users.editGroup') : t('users.createGroup')}
      onClose={onClose}
      closeOnBackdrop={!saving}
      message={error || undefined}
      messageSeverity="error"
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-green" onClick={handleSave} disabled={saving}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <div className="form" style={{ maxWidth: 400 }}>
        <div className="form-field">
          <label className="form-label">{t('users.displayName')}</label>
          <input
            className="form-input"
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            autoFocus
            style={{ width: '100%' }}
          />
        </div>
        {isEdit && (
          <div className="form-field" style={{ marginTop: 12 }}>
            <label className="form-label">{t('users.id')}</label>
            <input className="form-input" value={group.id} disabled style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }} />
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ── メンバー管理ダイアログ ────────────────────────────────────
function MembersDialog({ open, group, onClose }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [members, setMembers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [addUserID, setAddUserID] = useState('')
  const [error, setError] = useState('')

  const isAllGroup = group?.id === 'grp_all'

  const loadMembers = async () => {
    if (!group) return
    try {
      const list = await AuthApi.listUsersByGroup({ groupID: group.id })
      setMembers(list || [])
    } catch (err) {
      setError(String(err))
    }
  }

  useEffect(() => {
    if (open && group) {
      loadMembers()
      setError('')
      setAddUserID('')
      if (!isAllGroup) {
        AuthApi.listUsers().then(list => setAllUsers(list || [])).catch(() => {})
      }
    }
  }, [open, group])

  const nonMembers = allUsers.filter(u => !members.some(m => m.id === u.id))

  const handleAdd = async () => {
    if (!addUserID) return
    setError('')
    try {
      await AuthApi.addUserToGroup({ userID: addUserID, groupID: group.id })
      setAddUserID('')
      loadMembers()
      showToast(t('common.saved'))
    } catch (err) {
      setError(String(err))
    }
  }

  const handleRemove = async (userID) => {
    setError('')
    try {
      await AuthApi.removeUserFromGroup({ userID, groupID: group.id })
      loadMembers()
      showToast(t('common.saved'))
    } catch (err) {
      setError(String(err))
    }
  }

  return (
    <Dialog
      open={open}
      title={`${t('users.members')} — ${group?.display_name || ''}`}
      onClose={onClose}
      message={error || undefined}
      messageSeverity="error"
      wide
      actions={
        <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
      }
    >
      {isAllGroup && (
        <p className="form-hint" style={{ marginBottom: 12 }}>{t('users.allGroupHint')}</p>
      )}

      {members.length === 0 ? (
        <p className="empty-msg">{t('users.noMembers')}</p>
      ) : (
        <table className="blender-table">
          <thead>
            <tr>
              <th>{t('users.loginId')}</th>
              <th>{t('users.displayName')}</th>
              <th>{t('users.id')}</th>
              {!isAllGroup && <th style={{ width: 80 }}></th>}
            </tr>
          </thead>
          <tbody>
            {members.map(u => (
              <tr key={u.id}>
                <td>
                  {u.is_system && <span className="default-badge" style={{ marginRight: 6 }}>{t('users.systemBadge')}</span>}
                  {u.name}
                </td>
                <td>{u.display_name}</td>
                <td className="path-cell">{u.id}</td>
                {!isAllGroup && (
                  <td>
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemove(u.id)}>
                      {t('users.removeMember')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isAllGroup && nonMembers.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
          <select
            className="form-select"
            value={addUserID}
            onChange={e => setAddUserID(e.target.value)}
            style={{ flex: 1 }}
          >
            <option value="">{t('users.addMember')}</option>
            {nonMembers.map(u => (
              <option key={u.id} value={u.id}>{u.display_name} ({u.name})</option>
            ))}
          </select>
          <button className="btn btn-green btn-sm" onClick={handleAdd} disabled={!addUserID}>
            {t('common.create')}
          </button>
        </div>
      )}
    </Dialog>
  )
}

// ── サーバオリジン取得ヘルパー ───────────────────────────────
async function getServerOrigin() {
  if (isWails()) {
    const env = await EnvironmentApi.get()
    const host = env?.server_host || 'localhost'
    const port = env?.server_port || 8080
    return `http://${host}:${port}`
  }
  return window.location.origin
}

// ── パスワードリセットURL管理ダイアログ ──────────────────────
function ResetTokenDialog({ open, user, onClose }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [issuing, setIssuing] = useState(false)
  const [resetURL, setResetURL] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  // ダイアログを開いた時に既存トークンを取得
  useEffect(() => {
    if (!open || !user) return
    setLoading(true)
    setResetURL('')
    setExpiresAt('')
    setError('')
    setCopied(false)
    AuthApi.getActiveResetToken({ userID: user.id })
      .then(async (info) => {
        if (info?.url_path) {
          const origin = await getServerOrigin()
          setResetURL(`${origin}${info.url_path}`)
          setExpiresAt(info.expires_at)
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [open, user])

  const handleIssue = async () => {
    setIssuing(true)
    setError('')
    setCopied(false)
    try {
      const urlPath = await AuthApi.generateResetToken({ userID: user.id })
      const origin = await getServerOrigin()
      setResetURL(`${origin}${urlPath}`)
      setExpiresAt('') // 今発行したので24時間後
    } catch (err) {
      setError(String(err))
    } finally {
      setIssuing(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resetURL)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const el = document.getElementById('reset-url-input')
      if (el) { el.select() }
    }
  }

  const formatExpiry = (iso) => {
    if (!iso) return t('users.resetTokenExpiryNew')
    try {
      const d = new Date(iso)
      return t('users.resetTokenExpiryAt', { time: d.toLocaleString() })
    } catch {
      return ''
    }
  }

  return (
    <Dialog
      open={open}
      title={`${t('users.resetTokenTitle')} — ${user?.display_name || user?.name || ''}`}
      onClose={onClose}
      message={error || undefined}
      messageSeverity="error"
      actions={
        <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
      }
    >
      {loading ? (
        <p style={{ color: 'rgba(var(--fg),0.5)' }}>{t('common.loading')}</p>
      ) : resetURL ? (
        <>
          <p className="form-hint" style={{ marginBottom: 12 }}>{t('users.resetTokenHint')}</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              id="reset-url-input"
              className="form-input"
              value={resetURL}
              readOnly
              onClick={e => e.target.select()}
              style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.82rem' }}
            />
            <button className="btn btn-sm" onClick={handleCopy}>
              {copied ? t('users.copied') : t('users.copy')}
            </button>
          </div>
          <p className="form-hint" style={{ marginTop: 8 }}>{formatExpiry(expiresAt)}</p>
          <div style={{ marginTop: 16, borderTop: '1px solid rgba(var(--fg),0.08)', paddingTop: 12 }}>
            <p className="form-hint" style={{ marginBottom: 8 }}>{t('users.reissueHint')}</p>
            <button className="btn btn-outline btn-sm" onClick={handleIssue} disabled={issuing}>
              {issuing ? t('common.processing') : t('users.reissueToken')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="form-hint" style={{ marginBottom: 16 }}>{t('users.noActiveToken')}</p>
          <button className="btn btn-run" onClick={handleIssue} disabled={issuing}>
            {issuing ? t('common.processing') : t('users.issueToken')}
          </button>
        </>
      )}
    </Dialog>
  )
}

// ── ユーザタブ ──────────────────────────────────────────────
function UsersTab() {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [users, setUsers] = useState([])
  const [editUser, setEditUser] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [groupsDialog, setGroupsDialog] = useState(null)
  const [resetTokenUser, setResetTokenUser] = useState(null)

  const load = () => {
    AuthApi.listUsersWithStatus()
      .then(list => setUsers(list || []))
      .catch(() => {
        AuthApi.listUsers()
          .then(list => setUsers(list || []))
          .catch(err => showError(String(err)))
      })
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await AuthApi.deleteUser({ id: deleteTarget.id })
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {users.length === 0 ? (
        <p className="empty-msg">{t('users.noUsers')}</p>
      ) : (
        <table className="blender-table">
          <thead>
            <tr>
              <th>{t('users.loginId')}</th>
              <th>{t('users.displayName')}</th>
              <th>{t('users.password')}</th>
              <th>{t('users.id')}</th>
              <th>{t('users.groups')}</th>
              <th style={{ width: 220 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  {u.is_system && <span className="default-badge" style={{ marginRight: 6 }}>{t('users.systemBadge')}</span>}
                  {u.name}
                </td>
                <td>{u.display_name}</td>
                <td>
                  {u.has_password
                    ? <span className="pw-badge pw-set">{t('users.pwSet')}</span>
                    : <span className="pw-badge pw-unset">{t('users.pwUnset')}</span>
                  }
                </td>
                <td className="path-cell">{u.id}</td>
                <td>
                  <UserGroupsBadges userID={u.id} onClick={() => setGroupsDialog(u)} />
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-run btn-sm" onClick={() => setResetTokenUser(u)}
                          title={t('users.issueTokenTitle')}>
                    {t('users.issueToken')}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditUser(u)}>
                    {t('common.edit')}
                  </button>
                  {!u.is_system && (
                    <button className="btn btn-danger btn-sm" onClick={() => { setDeleteTarget(u); setDeleteError('') }}>
                      {t('common.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-green" onClick={() => setShowCreate(true)}>
          {t('users.addUser')}
        </button>
      </div>

      <UserDialog
        open={showCreate}
        user={null}
        onClose={() => setShowCreate(false)}
        onSaved={load}
      />

      <UserDialog
        open={!!editUser}
        user={editUser}
        onClose={() => setEditUser(null)}
        onSaved={load}
      />

      <UserGroupsDialog
        open={!!groupsDialog}
        user={groupsDialog}
        onClose={() => setGroupsDialog(null)}
      />

      <ResetTokenDialog
        open={!!resetTokenUser}
        user={resetTokenUser}
        onClose={() => setResetTokenUser(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('users.confirmDeleteUser')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
        message={deleteError || undefined}
      >
        {deleteTarget && (
          <>
            <p><span className="dialog-label">{t('users.loginId')}</span>{deleteTarget.name}</p>
            <p><span className="dialog-label">{t('users.displayName')}</span>{deleteTarget.display_name}</p>
            <p><span className="dialog-label">{t('users.id')}</span>{deleteTarget.id}</p>
            <p style={{ marginTop: 12, color: 'rgba(var(--fg),0.6)', fontSize: '0.85rem' }}>{t('users.deleteUserWarning')}</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}

// ── ユーザの所属グループバッジ ────────────────────────────────
function UserGroupsBadges({ userID, onClick }) {
  const [groups, setGroups] = useState([])

  useEffect(() => {
    AuthApi.listGroupsByUser({ userID })
      .then(list => setGroups(list || []))
      .catch(() => {})
  }, [userID])

  return (
    <span style={{ cursor: 'pointer' }} onClick={onClick} title="Click to view groups">
      {groups.map(g => (
        <span key={g.id} className="user-group-badge">{g.display_name}</span>
      ))}
    </span>
  )
}

// ── ユーザ所属グループ表示ダイアログ ──────────────────────────
function UserGroupsDialog({ open, user, onClose }) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState([])

  useEffect(() => {
    if (open && user) {
      AuthApi.listGroupsByUser({ userID: user.id })
        .then(list => setGroups(list || []))
        .catch(() => {})
    }
  }, [open, user])

  return (
    <Dialog
      open={open}
      title={`${t('users.groups')} — ${user?.display_name || user?.name || ''}`}
      onClose={onClose}
      actions={
        <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
      }
    >
      {groups.length === 0 ? (
        <p className="empty-msg">{t('users.noGroups')}</p>
      ) : (
        <table className="blender-table">
          <thead>
            <tr>
              <th>{t('users.displayName')}</th>
              <th>{t('users.id')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td>
                  {g.is_system && <span className="default-badge" style={{ marginRight: 6 }}>{t('users.systemBadge')}</span>}
                  {g.display_name}
                </td>
                <td className="path-cell">{g.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  )
}

// ── グループタブ ─────────────────────────────────────────────
function GroupsTab() {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [groups, setGroups] = useState([])
  const [editGroup, setEditGroup] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [membersTarget, setMembersTarget] = useState(null)

  const load = () => {
    AuthApi.listGroups()
      .then(list => setGroups(list || []))
      .catch(err => showError(String(err)))
  }

  useEffect(() => { load() }, [])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await AuthApi.deleteGroup({ id: deleteTarget.id })
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteError(String(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      {groups.length === 0 ? (
        <p className="empty-msg">{t('users.noGroups')}</p>
      ) : (
        <table className="blender-table">
          <thead>
            <tr>
              <th>{t('users.displayName')}</th>
              <th>{t('users.id')}</th>
              <th>{t('users.members')}</th>
              <th style={{ width: 200 }}></th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.id}>
                <td>
                  {g.is_system && <span className="default-badge" style={{ marginRight: 6 }}>{t('users.systemBadge')}</span>}
                  {g.display_name}
                </td>
                <td className="path-cell">{g.id}</td>
                <td>
                  <GroupMemberCount groupID={g.id} onClick={() => setMembersTarget(g)} />
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => setMembersTarget(g)}>
                    {t('users.members')}
                  </button>
                  <button className="btn btn-sm" onClick={() => setEditGroup(g)}>
                    {t('common.edit')}
                  </button>
                  {!g.is_system && (
                    <button className="btn btn-danger btn-sm" onClick={() => { setDeleteTarget(g); setDeleteError('') }}>
                      {t('common.delete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-green" onClick={() => setShowCreate(true)}>
          {t('users.addGroup')}
        </button>
      </div>

      <GroupDialog
        open={showCreate}
        group={null}
        onClose={() => setShowCreate(false)}
        onSaved={load}
      />

      <GroupDialog
        open={!!editGroup}
        group={editGroup}
        onClose={() => setEditGroup(null)}
        onSaved={load}
      />

      <MembersDialog
        open={!!membersTarget}
        group={membersTarget}
        onClose={() => setMembersTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('users.confirmDeleteGroup')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
        message={deleteError || undefined}
      >
        {deleteTarget && (
          <>
            <p><span className="dialog-label">{t('users.displayName')}</span>{deleteTarget.display_name}</p>
            <p><span className="dialog-label">{t('users.id')}</span>{deleteTarget.id}</p>
            <p style={{ marginTop: 12, color: 'rgba(var(--fg),0.6)', fontSize: '0.85rem' }}>{t('users.deleteGroupWarning')}</p>
          </>
        )}
      </ConfirmDialog>
    </div>
  )
}

// ── グループのメンバー数表示 ──────────────────────────────────
function GroupMemberCount({ groupID, onClick }) {
  const { t } = useTranslation()
  const [count, setCount] = useState(null)

  useEffect(() => {
    AuthApi.listUsersByGroup({ groupID })
      .then(list => setCount((list || []).length))
      .catch(() => setCount(0))
  }, [groupID])

  return (
    <span
      style={{ cursor: 'pointer', color: '#4a7cdc' }}
      onClick={onClick}
      title="Click to manage members"
    >
      {count !== null ? t('users.memberCount', { count }) : '...'}
    </span>
  )
}

// ── メインページ ─────────────────────────────────────────────
function UsersPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState('users')

  const tabs = [
    { id: 'users',  label: t('users.tabUsers') },
    { id: 'groups', label: t('users.tabGroups') },
  ]

  return (
    <div className="page">
      <div className="tab-nav">
        {tabs.map(tb => (
          <button
            key={tb.id}
            className={`tab-btn${tab === tb.id ? ' active' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === 'users'  && <UsersTab />}
        {tab === 'groups' && <GroupsTab />}
      </div>
    </div>
  )
}

export default UsersPage
