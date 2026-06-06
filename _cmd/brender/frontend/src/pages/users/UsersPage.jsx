import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthApi } from '../../lib/api'
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

  const load = () => {
    AuthApi.listUsers()
      .then(list => setUsers(list || []))
      .catch(err => showError(String(err)))
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
              <th>{t('users.id')}</th>
              <th>{t('users.groups')}</th>
              <th style={{ width: 140 }}></th>
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
                <td className="path-cell">{u.id}</td>
                <td>
                  <UserGroupsBadges userID={u.id} onClick={() => setGroupsDialog(u)} />
                </td>
                <td style={{ display: 'flex', gap: 6 }}>
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
