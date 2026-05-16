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

function CheckboxGroup({ label, enabled, onToggle, items, selected, onToggleItem, emptyKey }) {
  const { t } = useTranslation()
  return (
    <div className="ws-create-section">
      <label className="ws-create-section-toggle">
        <input type="checkbox" checked={enabled} onChange={e => onToggle(e.target.checked)} />
        <span>{label}</span>
      </label>
      {enabled && (
        <div className="ws-create-items">
          {items.length === 0
            ? <span className="form-hint">{t(emptyKey)}</span>
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

  const [loading, setLoading]               = useState(false)
  const [creating, setCreating]             = useState(false)
  const [error, setError]                   = useState('')
  const [availEngines, setAvailEngines]     = useState([])
  const [availScenes, setAvailScenes]       = useState([])
  const [availCameras, setAvailCameras]     = useState([])

  const [useEngines, setUseEngines]         = useState(false)
  const [selectedEngines, setSelectedEngines] = useState([])
  const [useScenes, setUseScenes]           = useState(false)
  const [selectedScenes, setSelectedScenes] = useState([])
  const [useCameras, setUseCameras]         = useState(false)
  const [selectedCameras, setSelectedCameras] = useState([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError('')
    setAvailEngines([])
    setAvailScenes([])
    setAvailCameras([])
    setUseEngines(false)
    setUseScenes(false)
    setUseCameras(false)
    setSelectedEngines([])
    setSelectedScenes([])
    setSelectedCameras([])

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
      setLoading(false)
    })
  }, [open, fileID])

  const toggleItem = (setter, item, checked) => {
    setter(prev => checked ? [...prev, item] : prev.filter(x => x !== item))
  }

  const combinations = generateCombinations(
    useEngines ? selectedEngines : [],
    useScenes  ? selectedScenes  : [],
    useCameras ? selectedCameras : [],
  )

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

  const count = Math.max(1, combinations.length)

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
          <button className="btn btn-green" onClick={handleCreate} disabled={loading || creating}>
            {creating
              ? t('common.registering')
              : t('workspace.createDialog.createCount', { count })}
          </button>
        </>
      }
    >
      {loading ? (
        <p className="form-hint">{t('workspace.createDialog.loading')}</p>
      ) : (
        <div className="ws-create-form">
          <CheckboxGroup
            label={t('workspace.createDialog.byEngine')}
            enabled={useEngines}
            onToggle={setUseEngines}
            items={availEngines}
            selected={selectedEngines}
            onToggleItem={(item, checked) => toggleItem(setSelectedEngines, item, checked)}
            emptyKey="workspace.createDialog.noEngines"
          />
          <CheckboxGroup
            label={t('workspace.createDialog.byScene')}
            enabled={useScenes}
            onToggle={setUseScenes}
            items={availScenes}
            selected={selectedScenes}
            onToggleItem={(item, checked) => toggleItem(setSelectedScenes, item, checked)}
            emptyKey="workspace.createDialog.noScenes"
          />
          <CheckboxGroup
            label={t('workspace.createDialog.byCamera')}
            enabled={useCameras}
            onToggle={setUseCameras}
            items={availCameras}
            selected={selectedCameras}
            onToggleItem={(item, checked) => toggleItem(setSelectedCameras, item, checked)}
            emptyKey="workspace.createDialog.noCameras"
          />
        </div>
      )}
    </Dialog>
  )
}
