import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WorkspaceApi, QueueApi } from '../../../lib/api'
import { useToast, useMessage } from '../../../lib/toast'
import { roleAtLeast } from '../../../lib/roles'
import { checkSavedSelections, NO_SELECTION_WARNINGS } from '../../../lib/blendSelections'
import ConfirmDialog from '../../../components/ConfirmDialog'
import NoteSection from '../../../components/NoteSection'
import FieldLabel from '../../../components/FieldLabel'
import RenderConfirmDialog from '../../../components/RenderConfirmDialog'
import { MdPlayArrow } from 'react-icons/md'
import { formFromWorkspace, updateParams } from './workspaceForm'
import { useRenderOptions } from './useRenderOptions'
import RenderSettingsFields from './RenderSettingsFields'
import SamplesComparisonDialog from './SamplesComparisonDialog'
import WorkspaceDeleteDialog from './WorkspaceDeleteDialog'

// ワークスペースの設定フォーム（ファイル画面の右側の左半分）。保存・Test・実行・複製・削除もここから行う。
// できることはファイルに対するロールで決まる:
//   runner 以上 … Test・実行・サンプル数の比較 / editor 以上 … 保存 / workspace_creator 以上 … 複製・削除
export default function WorkspaceSettingsForm({ projectID, projectName, fileID, fileName, workspaceID, detail, focusName, role, onUpdated, onCopied, onDeleted, onTestEnqueued, onRenderEnqueued, workDirLocked, navigate }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [form, setForm]                     = useState(null)
  const [note, setNote]                     = useState('')
  const [warnings, setWarnings]             = useState(NO_SELECTION_WARNINGS)
  const [saving, setSaving]                 = useState(false)
  const [copying, setCopying]               = useState(false)
  const [copyConfirm, setCopyConfirm]       = useState(false)
  const [error, setError]                   = useState('')
  const [deleteOpen, setDeleteOpen]         = useState(false)
  const [samplesOpen, setSamplesOpen]       = useState(false)
  const [testEnqueueing, setTestEnqueueing] = useState(false)
  const [testEnqueued, setTestEnqueued]     = useState(false)
  const [renderConfirm, setRenderConfirm]   = useState(null)
  const [renderEnqueuing, setRenderEnqueuing] = useState(false)
  const [resolvingRender, setResolvingRender] = useState(false)
  const nameRef      = useRef(null)
  const hasFocused   = useRef(false)
  const savedForm    = useRef(null)
  const savedNote    = useRef('')
  const renderSettingsRef = useRef(null)

  const canCopyDelete = roleAtLeast(role, 'workspace_creator')
  const canSave       = roleAtLeast(role, 'editor')
  const canRun        = roleAtLeast(role, 'runner')
  const readOnly      = !canSave // runner / viewer は設定編集不可

  const fid = detail?.workspace?.project_file_id
  const options = useRenderOptions(!!form, form?.blenderInstallID, fid)
  const { blenders, toolData, engines, toolLoading, enginesLoading } = options

  useEffect(() => {
    const next = formFromWorkspace(detail.workspace)
    setForm(next)
    savedForm.current = next
    const noteVal = detail.workspace.note || ''
    setNote(noteVal)
    savedNote.current = noteVal
    setError('')
  }, [detail])

  useEffect(() => {
    if (focusName && !hasFocused.current && nameRef.current) {
      nameRef.current.focus()
      nameRef.current.select()
      hasFocused.current = true
    }
  }, [focusName, form])

  // ── 保存値の存在チェック ─────────────────────────────────
  // .blend と Blender を読み終えたら、保存してあるシーン・カメラ・エンジンが今もあるか確かめる。
  // 無くなったものは空にし、知らせが見えるようレンダリング設定の欄を開く。
  useEffect(() => {
    if (!form || toolLoading || enginesLoading) return
    const r = checkSavedSelections(form, {
      scenes: toolData?.Scenes?.map(s => s.Name) || [],
      cameras: toolData?.Cameras || [],
      engines: engines || [],
    })
    setWarnings({ missingScene: r.missingScene, missingCamera: r.missingCamera, missingEngine: r.missingEngine, convertedEngine: r.convertedEngine })
    if (r.warned) {
      setForm(prev => ({ ...prev, scene: r.scene, camera: r.camera, engine: r.engine }))
      if (renderSettingsRef.current) renderSettingsRef.current.open = true
    }
  }, [toolLoading, enginesLoading])

  const clearWarnings = (...keys) => setWarnings(prev => {
    const next = { ...prev }
    for (const k of keys) next[k] = NO_SELECTION_WARNINGS[k]
    return next
  })

  // ── ファイルの設定（固定されている項目はワークスペースで変えられない） ──
  const fileRecord = detail?.project_files?.find(f => f.id === fid)
  const fileBlenderID    = fileRecord?.blender_install_id || 0
  const fileBlenderFixed = fileRecord?.blender_fixed || false
  const file = {
    scene:       fileRecord?.scene || '',
    sceneFixed:  fileRecord?.scene_fixed || false,
    camera:      fileRecord?.camera || '',
    cameraFixed: fileRecord?.camera_fixed || false,
    engine:      fileRecord?.engine || '',
    engineFixed: fileRecord?.engine_fixed || false,
  }

  const set = (key, val) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const handleCopy = async () => {
    setCopying(true)
    showError('')
    try {
      const newName = form.name.trim() + t('workspace.copySuffix')
      const newWS = await WorkspaceApi.copy({ projectID, workspaceID, newName })
      setCopyConfirm(false)
      showToast(t('workspace.copied'))
      onCopied()
      navigate('workspace', { projectID, projectName, fileID, fileName, workspaceID: newWS.id })
    } catch (err) {
      showError(String(err))
    } finally {
      setCopying(false)
    }
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) { setError(t('workspace.nameRequired')); return }
    setSaving(true)
    try {
      await WorkspaceApi.update({ projectID, workspaceID, ...updateParams(form, note) })
      savedForm.current = { ...form, name: form.name.trim() }
      savedNote.current = note
      showToast(t('common.saved'))
      onUpdated(form.name.trim())
    } catch (err) {
      showError(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTestEncode = async () => {
    showError('')
    setTestEnqueued(false)
    setTestEnqueueing(true)
    try {
      await QueueApi.testEnqueue({
        projectID,
        workspaceID,
        params: {
          blender_install_id: form.blenderInstallID,
          scene:       form.scene,
          camera:      form.camera,
          engine:      form.engine,
          start_frame:  form.startFrame,
          end_frame:    form.endFrame,
          thread:       form.thread,
          resolution_x: form.resolutionX,
          resolution_y: form.resolutionY,
        },
      })
      setTestEnqueued(true)
      if (onTestEnqueued) onTestEnqueued()
    } catch (err) {
      showError(String(err))
    } finally {
      setTestEnqueueing(false)
    }
  }

  const handleRenderClick = async () => {
    showError('')
    setResolvingRender(true)
    try {
      const preview = await QueueApi.previewRender({ projectID, workspaceID })
      setRenderConfirm(preview)
    } catch (err) {
      showError(String(err))
    } finally {
      setResolvingRender(false)
    }
  }

  const handleRenderEnqueue = async () => {
    if (!renderConfirm) return
    setRenderEnqueuing(true)
    showError('')
    try {
      await QueueApi.enqueueWithPreview({ projectID, workspaceID, preview: renderConfirm })
      setRenderConfirm(null)
      if (onRenderEnqueued) onRenderEnqueued()
    } catch (err) {
      showError(String(err))
      setRenderConfirm(null)
    } finally {
      setRenderEnqueuing(false)
    }
  }

  if (!form) return null

  const isFormDirty = savedForm.current === null || JSON.stringify(form) !== JSON.stringify(savedForm.current)
  const isNoteDirty = note !== savedNote.current
  const isDirty = isFormDirty || isNoteDirty

  const blenderDefault = !fileBlenderFixed && form.blenderInstallID === 0
    ? (blenders.find(b => b.id === fileBlenderID)?.name || blenders[0]?.name || null)
    : null
  const lockedBlenderName = fileBlenderFixed
    ? (fileBlenderID === 0
        ? (blenders[0]?.name || t('common.notSet'))
        : (blenders.find(b => b.id === fileBlenderID)?.name || t('common.notSet')))
    : null
  // サンプル数の比較で最初に出すフレーム（フレーム範囲の中ほど）
  const samplesFrame = Math.floor(((detail.workspace.start ?? 0) + (detail.workspace.end ?? 0)) / 2)

  return (
    <div className="form workspace" style={{ maxWidth: 640 }}>
      <div className="form-row">
        <div className="form-field" style={{ flex: 2 }}>
          <label className="form-label">{t('workspace.name')} <span className="required">*</span></label>
          <input ref={nameRef} className="form-input" value={form.name} onChange={e => set('name', e.target.value)} disabled={readOnly} />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <FieldLabel text={t('workspace.blender')} lockedValue={fileBlenderFixed ? (lockedBlenderName) : null} defaultValue={blenderDefault} />
          {fileBlenderFixed ? (
            <input className="form-input" value={lockedBlenderName} disabled style={{ opacity: 0.5 }} />
          ) : (
            <select className="form-select" value={form.blenderInstallID} onChange={e => set('blenderInstallID', Number(e.target.value))} disabled={readOnly}>
              <option value={0}>{t('common.notSet')}</option>
              {blenders.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <RenderSettingsFields
        form={form}
        set={set}
        setForm={setForm}
        readOnly={readOnly}
        options={options}
        file={file}
        warnings={warnings}
        clearWarnings={clearWarnings}
        detailsRef={renderSettingsRef}
        defaultOpen={!detail.workspace.auto_lock}
      />

      {error && <div className="error-msg">{error}</div>}
      {testEnqueued && <div className="warning-msg">{t('workspace.testEnqueued')}</div>}

      <NoteSection value={note} onChange={setNote} disabled={readOnly} />

      <div className="form-field">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" id="autoLock" checked={form.autoLock} onChange={e => set('autoLock', e.target.checked)} disabled={readOnly} />
          <label htmlFor="autoLock" className="form-label" style={{ marginBottom: 0, cursor: 'pointer' }}>{t('workspace.autoLock')}</label>
        </div>
        {form.autoLock && (
          <div className="form-row" style={{ marginTop: 8 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">{t('workspace.autoLockMinSize')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input className="form-input" style={{ width: 120, textAlign: 'right' }} type="number" min={0} value={Math.round(form.autoLockMinSize / (1024 * 1024))} onChange={e => set('autoLockMinSize', Number(e.target.value) * 1024 * 1024)} disabled={readOnly} />
                <span style={{ fontSize: '0.85rem', opacity: 0.7 }}>MB</span>
              </div>
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">{t('workspace.autoLockKeep')}</label>
              <input className="form-input" style={{ width: 80, textAlign: 'right' }} type="number" min={1} value={form.autoLockKeep} onChange={e => set('autoLockKeep', Math.max(1, Number(e.target.value)))} disabled={readOnly} />
            </div>
          </div>
        )}
      </div>

      {(canRun || canCopyDelete) && (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {canRun && (
        <button className="btn btn-outline btn-sm" onClick={() => setSamplesOpen(true)} disabled={workDirLocked || isFormDirty}>
          {t('workspace.samplesComparison')}
        </button>
        )}
        {canCopyDelete && (
        <button className="btn btn-outline btn-sm" onClick={() => setCopyConfirm(true)} disabled={copying}>
          {t('workspace.copy')}
        </button>
        )}
      </div>
      )}

      {(canRun || canSave || canCopyDelete) && (
      <div className="form-actions" style={canCopyDelete ? undefined : { justifyContent: 'flex-end' }}>
        {canCopyDelete && (
        <button className="btn btn-danger" onClick={() => setDeleteOpen(true)}>{t('common.delete')}</button>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          {canRun && (
          <button className="btn btn-run" onClick={handleTestEncode} disabled={testEnqueueing || workDirLocked} title={t('workspace.testHint')}>
            {testEnqueueing ? t('common.enqueueing') : t('workspace.testRender')}
          </button>
          )}
          {canRun && (
          <button className="btn btn-run" onClick={handleRenderClick} disabled={resolvingRender || workDirLocked || isFormDirty}>
            {resolvingRender ? t('common.processing') : <><MdPlayArrow /> {t('common.run')}</>}
          </button>
          )}
          {canSave && (
          <button className="btn btn-green" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? t('common.saving') : t('common.save')}
          </button>
          )}
        </div>
      </div>
      )}

      <RenderConfirmDialog
        preview={renderConfirm}
        busy={renderEnqueuing}
        onCancel={() => setRenderConfirm(null)}
        onConfirm={handleRenderEnqueue}
      />

      <SamplesComparisonDialog
        open={samplesOpen}
        onClose={() => setSamplesOpen(false)}
        projectID={projectID}
        workspaceID={workspaceID}
        initialFrame={samplesFrame}
        onEnqueued={() => navigate('queue')}
      />

      {deleteOpen && (
        <WorkspaceDeleteDialog
          projectID={projectID}
          workspaceID={workspaceID}
          workspaceName={detail.workspace.name}
          onCancel={() => setDeleteOpen(false)}
          onDeleted={onDeleted}
        />
      )}

      <ConfirmDialog
        open={copyConfirm}
        title={t('workspace.copy')}
        confirmLabel={t('workspace.copy')}
        confirmClassName="btn btn-outline"
        onConfirm={handleCopy}
        onCancel={() => setCopyConfirm(false)}
        busy={copying}
      >
        <p>{t('workspace.copyConfirmMsg')}</p>
      </ConfirmDialog>
    </div>
  )
}
