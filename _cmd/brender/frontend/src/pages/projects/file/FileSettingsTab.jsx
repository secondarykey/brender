import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ProjectApi, BlenderApi, TagApi } from '../../../lib/api'
import { useToast, useMessage } from '../../../lib/toast'
import { roleAtLeast } from '../../../lib/roles'
import { checkSavedSelections, NO_SELECTION_WARNINGS } from '../../../lib/blendSelections'
import { isWails } from '../../../lib/api/_client'
import NoteSection from '../../../components/NoteSection'
import FieldLabel from '../../../components/FieldLabel'
import ThumbnailPicker from '../../../components/ThumbnailPicker'
import FavoriteButton from '../../../components/FavoriteButton'
import TagInput from '../../../components/TagInput'
import PermissionSection from '../../../components/PermissionSection'
import FileDeleteDialog from './FileDeleteDialog'

// ファイルの既定の設定。Blender・シーン・カメラ・エンジンは「固定」にすると、ワークスペースでは変えられない
const EMPTY_SETTINGS = {
  name: '', note: '',
  blenderInstallID: 0, blenderFixed: false,
  scene: '', sceneFixed: false,
  camera: '', cameraFixed: false,
  engine: '', engineFixed: false,
}

function settingsFromFile(f, fallbackName) {
  return {
    name: f?.name || fallbackName,
    note: f?.note || '',
    blenderInstallID: f?.blender_install_id || 0,
    blenderFixed: f?.blender_fixed || false,
    scene: f?.scene || '',
    sceneFixed: f?.scene_fixed || false,
    camera: f?.camera || '',
    cameraFixed: f?.camera_fixed || false,
    engine: f?.engine || '',
    engineFixed: f?.engine_fixed || false,
  }
}

// 「固定」のチェック
function FixedCheckbox({ checked, onChange, disabled }) {
  const { t } = useTranslation()
  return (
    <label className="form-checkbox-label" style={{ marginTop: 6 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
      <span style={{ marginLeft: 6 }}>{t('file.fixed')}</span>
    </label>
  )
}

// ファイル画面の「ファイル設定」タブ。左: 既定の設定・メモ・権限 / 右: サムネイル・お気に入り・タグ。
// editor 以上が保存でき、owner だけが削除と権限の設定をできる。
export default function FileSettingsTab({ projectID, fileID, fileName, role, onUpdated, onDeleted, favorite, onFavoriteChange }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()
  const [values, setValues]           = useState({ ...EMPTY_SETTINGS, name: fileName })
  const [warnings, setWarnings]       = useState(NO_SELECTION_WARNINGS)
  const [blenders, setBlenders]       = useState([])
  const [toolData, setToolData]       = useState(null)
  const [toolLoading, setToolLoading] = useState(false)
  const [filePath, setFilePath]       = useState('')
  const [openingFile, setOpeningFile] = useState(false)
  const [saving, setSaving]           = useState(false)
  const [deleteOpen, setDeleteOpen]   = useState(false)
  const [fileTags, setFileTags]       = useState([])

  const isOwner  = role === 'owner'
  const canEdit  = roleAtLeast(role, 'editor') // editor 以上は保存可能
  const readOnly = !canEdit                    // runner / viewer は設定閲覧のみ

  const set = (patch) => setValues(prev => ({ ...prev, ...patch }))

  const fetchToolData = (installID) => {
    setToolLoading(true)
    BlenderApi.getToolData({ installID, fileID })
      .then(data => setToolData(data || null))
      .catch(() => setToolData(null))
      .finally(() => setToolLoading(false))
  }

  useEffect(() => {
    Promise.all([
      ProjectApi.getFile({ fileID }).catch(() => null),
      BlenderApi.list().catch(() => []),
    ]).then(([f, list]) => {
      setBlenders(list || [])
      const next = settingsFromFile(f, fileName)
      setValues(next)
      setFilePath(f?.path || '')
      fetchToolData(next.blenderInstallID)
    })
    TagApi.getFileTags({ projectFileID: fileID })
      .then(tags => setFileTags(tags || []))
      .catch(() => setFileTags([]))
  }, [fileID])

  // .blend を読み終えたら、保存してあるシーン・カメラ・エンジンが今もあるか確かめる（無くなったものは空にする）
  useEffect(() => {
    if (toolLoading || !toolData) return
    const r = checkSavedSelections(values, {
      scenes: toolData?.Scenes?.map(s => s.Name) || [],
      cameras: toolData?.Cameras || [],
      engines: toolData?.Engines || [],
    })
    setWarnings({ missingScene: r.missingScene, missingCamera: r.missingCamera, missingEngine: r.missingEngine, convertedEngine: r.convertedEngine })
    if (r.warned) set({ scene: r.scene, camera: r.camera, engine: r.engine })
  }, [toolLoading])

  const clearWarnings = (...keys) => setWarnings(prev => {
    const next = { ...prev }
    for (const k of keys) next[k] = NO_SELECTION_WARNINGS[k]
    return next
  })

  const handleBlenderChange = (installID) => {
    set({ blenderInstallID: installID })
    fetchToolData(installID)
  }

  const handleSceneChange = (val) => {
    set({ scene: val, camera: '' })
    clearWarnings('missingScene', 'missingCamera')
  }

  const handleSave = async () => {
    if (!values.name.trim()) return
    setSaving(true)
    showError('')
    try {
      const { blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed, note } = values
      const updated = await ProjectApi.updateFile({ fileID, name: values.name.trim(), note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed })
      showToast(t('common.saved'))
      if (onUpdated) onUpdated(updated)
    } catch (e) {
      showError(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleOpenInBlender = async () => {
    setOpeningFile(true)
    try {
      await BlenderApi.openFile({ installID: values.blenderInstallID || 0, filePath })
    } catch (e) {
      showError(e?.message ?? String(e))
    } finally {
      setOpeningFile(false)
    }
  }

  const { name, note, blenderInstallID, blenderFixed, scene, sceneFixed, camera, cameraFixed, engine, engineFixed } = values
  const activeScene    = toolData?.Scenes?.find(s => s.Active) || null
  const effectiveScene = scene || activeScene?.Name || ''
  const sceneInfo      = toolData?.Scenes?.find(s => s.Name === effectiveScene) || activeScene
  const scenes         = toolData?.Scenes?.map(s => s.Name) || []
  const allCameras     = toolData?.Cameras || []

  const blenderDefault = !blenderFixed && blenderInstallID === 0 ? (blenders[0]?.name || null) : null
  const sceneDefault  = !scene ? (activeScene?.Name || null) : null
  const cameraDefault = !camera && sceneInfo?.Camera ? sceneInfo.Camera : null
  const engineDefault = !engine ? (sceneInfo?.Engine || null) : null

  // ブラウザ（サーバモード）は、アップロードした .blend（{projectID}/{fileID}/{fileID}.blend）でないと開けない
  const serverIncompatible = !isWails() && filePath &&
    !filePath.replace(/\\/g, '/').endsWith(`${projectID}/${fileID}/${fileID}.blend`)

  return (
    <div className="ws-detail-split">
      <div className="ws-detail-left">
        <div className="form workspace" style={{ maxWidth: 640 }}>
          {serverIncompatible && (
            <div className="pack-warning-bar">{t('file.serverIncompatible')}</div>
          )}
          <div className="form-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label className="form-label">{t('file.displayName')} <span className="required">*</span></label>
              <input
                className="form-input"
                value={name}
                onChange={e => set({ name: e.target.value })}
                disabled={readOnly}
              />
              {isWails() && (
                <button
                  className="btn btn-run btn-sm"
                  style={{ marginTop: 6, alignSelf: 'flex-start' }}
                  disabled={openingFile || !filePath}
                  onClick={handleOpenInBlender}
                >
                  {openingFile ? '...' : t('common.open')}
                </button>
              )}
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <FieldLabel text={t('file.defaultBlender')} defaultValue={blenderDefault} />
              {blenders.length === 0 ? (
                <p className="setting-desc">{t('settings.noBlenderRegistered')}</p>
              ) : (
                <select
                  className="form-select"
                  value={blenderInstallID}
                  onChange={e => handleBlenderChange(Number(e.target.value))}
                  disabled={readOnly}
                >
                  <option value={0}>{t('common.notSet')}</option>
                  {blenders.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.version || t('common.versionUnknown')})</option>
                  ))}
                </select>
              )}
              <FixedCheckbox checked={blenderFixed} onChange={v => set({ blenderFixed: v })} disabled={readOnly} />
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
            <div className="form-field" style={{ flex: 2 }}>
              <FieldLabel text={t('file.defaultEngine')} defaultValue={engineDefault} />
              {(toolData?.Engines?.length ?? 0) > 0 ? (
                <select
                  className="form-select"
                  value={engine}
                  onChange={e => { set({ engine: e.target.value }); clearWarnings('missingEngine', 'convertedEngine') }}
                  disabled={toolLoading || readOnly}
                >
                  <option value="">{t('common.notSet')}</option>
                  {toolData.Engines.map(eng => <option key={eng} value={eng}>{eng}</option>)}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={engine}
                  onChange={e => set({ engine: e.target.value })}
                  placeholder={t('workspace.enginePlaceholder')}
                  disabled={readOnly}
                />
              )}
              {warnings.missingEngine && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.engineMissing', { name: warnings.missingEngine })}</span>}
              {warnings.convertedEngine && <span className="form-hint" style={{ color: '#e0a030' }}>{t('workspace.engineConverted', { from: warnings.convertedEngine.from, to: warnings.convertedEngine.to })}</span>}
              <FixedCheckbox checked={engineFixed} onChange={v => set({ engineFixed: v })} disabled={readOnly} />
            </div>
          </div>

          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <div className="form-field" style={{ flex: 1 }}>
              <FieldLabel text={t('file.defaultScene')} defaultValue={sceneDefault} />
              {scenes.length > 0 ? (
                <select
                  className="form-select"
                  value={scene}
                  onChange={e => handleSceneChange(e.target.value)}
                  disabled={toolLoading || readOnly}
                >
                  <option value="">{t('common.notSet')}</option>
                  {scenes.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={scene}
                  onChange={e => handleSceneChange(e.target.value)}
                  placeholder={t('common.notSetPlaceholder')}
                  disabled={readOnly}
                />
              )}
              {warnings.missingScene && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.sceneMissing', { name: warnings.missingScene })}</span>}
              <FixedCheckbox checked={sceneFixed} onChange={v => set({ sceneFixed: v })} disabled={readOnly} />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <FieldLabel text={t('file.defaultCamera')} defaultValue={cameraDefault} />
              <select
                className="form-select"
                value={camera}
                onChange={e => { set({ camera: e.target.value }); clearWarnings('missingCamera') }}
                disabled={toolLoading || readOnly}
              >
                <option value="">{t('common.notSet')}</option>
                {allCameras
                  .filter(c => !scene || (c.Scenes && c.Scenes.includes(scene)))
                  .map(c => <option key={c.Name} value={c.Name}>{c.Name}</option>)
                }
              </select>
              {warnings.missingCamera && <span className="form-hint" style={{ color: '#e74c3c' }}>{t('workspace.cameraMissing', { name: warnings.missingCamera })}</span>}
              <FixedCheckbox checked={cameraFixed} onChange={v => set({ cameraFixed: v })} disabled={readOnly} />
            </div>
          </div>

          <NoteSection value={note} onChange={v => set({ note: v })} disabled={readOnly} />

          {canEdit && (
          <div className="form-actions" style={isOwner ? undefined : { justifyContent: 'flex-end' }}>
            {isOwner && (
            <button className="btn btn-danger" onClick={() => setDeleteOpen(true)}>{t('common.delete')}</button>
            )}
            <button className="btn btn-green" onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
          )}
        </div>

        {isOwner && deleteOpen && (
          <FileDeleteDialog
            fileID={fileID}
            fileName={fileName}
            onCancel={() => setDeleteOpen(false)}
            onDeleted={onDeleted}
          />
        )}

        {isOwner && (
        <PermissionSection mode="file" resourceID={fileID} />
        )}
      </div>

      <div className="ws-detail-right">
        <ThumbnailPicker
          fetcher={() => ProjectApi.getFileThumbnail({ projectID, fileID })}
          deps={[projectID, fileID]}
          save={imagePath => ProjectApi.setFileThumbnail({ projectID, fileID, imagePath })}
        />
        <div style={{ marginTop: 20 }}>
          <h3 className="ws-detail-section-title">{t('favorite.favorites')}</h3>
          <FavoriteButton
            fileID={fileID}
            favorite={favorite}
            onChange={(_, v) => onFavoriteChange(v)}
            variant="row"
            label
          />
        </div>
        <div style={{ marginTop: 20 }}>
          <h3 className="ws-detail-section-title">{t('tag.tags')}</h3>
          <TagInput
            projectFileID={fileID}
            tags={fileTags}
            onTagsChanged={setFileTags}
          />
        </div>
      </div>
    </div>
  )
}
