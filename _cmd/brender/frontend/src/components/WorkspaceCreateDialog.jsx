import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BlenderApi, WorkspaceApi } from '../lib/api'
import Dialog from './Dialog'

function generateCombinations(engines, scenes, cameras) {
  const eList = engines.length > 0 ? engines : ['']
  const sList = scenes.length > 0 ? scenes : ['']
  const cList = cameras.length > 0 ? cameras : ['']
  const result = []
  for (const engine of eList) {
    for (const scene of sList) {
      for (const camera of cList) {
        result.push({ engine, scene, camera })
      }
    }
  }
  return result
}

function buildName(combo, useEngines, useScenes, useCameras, fileName) {
  const parts = []
  if (useEngines && combo.engine) parts.push(combo.engine)
  if (useScenes && combo.scene) parts.push(combo.scene)
  if (useCameras && combo.camera) parts.push(combo.camera)
  const suffix = parts.length > 0 ? `（${parts.join(' - ')}）` : ''
  return fileName ? `${fileName}${suffix}` : (suffix ? suffix.slice(1, -1) : 'New Workspace')
}

function CheckboxGroup({ label, enabled, onToggle, items, selected, onToggleItem, loading }) {
  const { t } = useTranslation()
  return (
    <div className="ws-create-section">
      <label className="ws-create-section-toggle">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
        <span>{label}</span>
      </label>
      {enabled && (
        <div className="ws-create-items">
          {loading
            ? <span className="form-hint">{t('common.loading')}</span>
            : items.length === 0
              ? <span className="form-hint">—</span>
              : items.map(item => (
                  <label key={item} className="ws-create-item-label">
                    <input
                      type="checkbox"
                      checked={selected.includes(item)}
                      onChange={e => onToggleItem(item, e.target.checked)}
                    />
                    <span className="ws-meta-chip">{item}</span>
                  </label>
                ))
          }
        </div>
      )}
    </div>
  )
}

export default function WorkspaceCreateDialog({ open, onClose, projectID, fileID, fileName, onCreated }) {
  const { t } = useTranslation()

  const [fetching, setFetching]               = useState(false)
  const [creating, setCreating]               = useState(false)
  const [error, setError]                     = useState('')
  const [availEngines, setAvailEngines]       = useState([])
  const [availScenes, setAvailScenes]         = useState([])
  const [availCameras, setAvailCameras]       = useState([])

  const [useMultiple, setUseMultiple]         = useState(false)
  const [useEngines, setUseEngines]           = useState(false)
  const [selectedEngines, setSelectedEngines] = useState([])
  const [useScenes, setUseScenes]             = useState(false)
  const [selectedScenes, setSelectedScenes]   = useState([])
  const [useCameras, setUseCameras]           = useState(false)
  const [selectedCameras, setSelectedCameras] = useState([])

  useEffect(() => {
    if (!open) return
    setError('')
    setUseMultiple(false)
    setUseEngines(false)
    setUseScenes(false)
    setUseCameras(false)
    setSelectedEngines([])
    setSelectedScenes([])
    setSelectedCameras([])

    // ダイアログ開放と同時にバックグラウンドで取得開始
    setFetching(true)
    Promise.all([
      BlenderApi.getToolData({ installID: 0, fileID }),
      BlenderApi.getEngines({ installID: 0 }),
    ]).then(([td, eng]) => {
      const engines = eng || []
      const scenes  = (td?.Scenes || []).map(s => s.Name)
      const cameras = (td?.Cameras || []).map(c => c.Name)
      setAvailEngines(engines)
      setAvailScenes(scenes)
      setAvailCameras(cameras)
      setSelectedEngines(engines)
      setSelectedScenes(scenes)
      setSelectedCameras(cameras)
    }).catch(err => {
      setError(String(err))
    }).finally(() => {
      setFetching(false)
    })
  }, [open, fileID])

  const toggleItem = (setter, item, checked) => {
    setter(prev => checked ? [...prev, item] : prev.filter(x => x !== item))
  }

  const combinations = useMultiple
    ? generateCombinations(
        useEngines ? selectedEngines : [],
        useScenes  ? selectedScenes  : [],
        useCameras ? selectedCameras : [],
      )
    : []

  const count = combinations.length > 0 ? combinations.length : 1

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const specs = combinations.length > 0
        ? combinations.map(c => ({
            Name:   buildName(c, useEngines, useScenes, useCameras, fileName),
            Scene:  c.scene,
            Camera: c.camera,
            Engine: c.engine,
          }))
        : [{ Name: 'New Workspace', Scene: '', Camera: '', Engine: '' }]

      const result = await WorkspaceApi.createBatch({ projectID, projectFileID: fileID, specs })
      onCreated(result || [])
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog
      open={open}
      title={t('workspace.createDialog.title')}
      onClose={onClose}
      closeOnBackdrop={!creating}
      message={error}
      messageSeverity="error"
      actions={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={creating}>
            {t('common.cancel')}
          </button>
          <button className="btn btn-green" onClick={handleCreate} disabled={creating}>
            {creating
              ? t('common.registering')
              : t('workspace.createDialog.createCount', { count })}
          </button>
        </>
      }
    >
      <div className="ws-create-form">
        <label className="ws-create-master-toggle">
          <input
            type="checkbox"
            checked={useMultiple}
            onChange={e => setUseMultiple(e.target.checked)}
          />
          <span>{t('workspace.createDialog.multipleFromFile')}</span>
        </label>

        {useMultiple && (
          <div className="ws-create-sections">
            <CheckboxGroup
              label={t('workspace.createDialog.engines')}
              enabled={useEngines}
              onToggle={setUseEngines}
              items={availEngines}
              selected={selectedEngines}
              onToggleItem={(item, checked) => toggleItem(setSelectedEngines, item, checked)}
              loading={fetching}
            />
            <CheckboxGroup
              label={t('workspace.createDialog.scenes')}
              enabled={useScenes}
              onToggle={setUseScenes}
              items={availScenes}
              selected={selectedScenes}
              onToggleItem={(item, checked) => toggleItem(setSelectedScenes, item, checked)}
              loading={fetching}
            />
            <CheckboxGroup
              label={t('workspace.createDialog.cameras')}
              enabled={useCameras}
              onToggle={setUseCameras}
              items={availCameras}
              selected={selectedCameras}
              onToggleItem={(item, checked) => toggleItem(setSelectedCameras, item, checked)}
              loading={fetching}
            />
          </div>
        )}
      </div>
    </Dialog>
  )
}
