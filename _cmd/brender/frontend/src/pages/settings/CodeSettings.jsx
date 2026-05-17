import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CodesApi } from '../../lib/api/codes'
import { useToast, useMessage } from '../../lib/toast'
import ConfirmDialog from '../../components/ConfirmDialog'

const BLENDER_FORMAT_URL = 'https://docs.blender.org/manual/en/5.1/advanced/command_line/arguments.html#format-options'

const CATEGORIES = [
  { key: 'imageFormats',      labelKey: 'code.imageFormats' },
  { key: 'videoFormats',      labelKey: 'code.videoFormats' },
  { key: 'resolutionPresets', labelKey: 'code.resolutionPresets' },
]

function CodeSettings() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { showError } = useMessage()

  const [category, setCategory] = useState('imageFormats')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async (cat) => {
    setLoading(true)
    try {
      let data
      if (cat === 'imageFormats')      data = await CodesApi.getImageFormats()
      else if (cat === 'videoFormats') data = await CodesApi.getVideoFormats()
      else                             data = await CodesApi.getResolutionPresets()
      setRows(data ?? [])
    } catch (e) {
      showError(String(e))
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => { load(category) }, [category, load])

  const handleCategoryChange = (e) => setCategory(e.target.value)

  const handleCellChange = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const handleAddRow = async () => {
    try {
      const id = await CodesApi.generateID()
      const newRow = category === 'imageFormats'
        ? { code: id, label: '', ext: '', blender_value: '' }
        : category === 'videoFormats'
        ? { code: id, label: '', ext: '' }
        : { code: id, label: '', width: 0, height: 0 }
      setRows(prev => [...prev, newRow])
    } catch (e) {
      showError(String(e))
    }
  }

  const handleDeleteRow = (idx) => {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (category === 'imageFormats')      await CodesApi.saveImageFormats(rows)
      else if (category === 'videoFormats') await CodesApi.saveVideoFormats(rows)
      else                                  await CodesApi.saveResolutionPresets(rows)
      showToast(t('common.saved'))
    } catch (e) {
      showError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      if (category === 'imageFormats')      await CodesApi.resetImageFormats()
      else if (category === 'videoFormats') await CodesApi.resetVideoFormats()
      else                                  await CodesApi.resetResolutionPresets()
      setResetOpen(false)
      await load(category)
      showToast(t('common.saved'))
    } catch (e) {
      showError(String(e))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div style={{ padding: '24px', maxWidth: 900 }}>
      <div style={{ marginBottom: 8 }}>
        <select
          className="form-select"
          value={category}
          onChange={handleCategoryChange}
          style={{ width: 220 }}
        >
          {CATEGORIES.map(c => (
            <option key={c.key} value={c.key}>{t(c.labelKey)}</option>
          ))}
        </select>
      </div>

      <CategoryDesc category={category} t={t} />

      {loading ? (
        <div style={{ color: '#888', padding: '16px 0' }}>{t('common.loading')}</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <ColHeaders category={category} t={t} />
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.code} style={{ borderBottom: '1px solid #222' }}>
                <RowCells category={category} row={row} idx={idx} onChange={handleCellChange} />
                <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteRow(idx)}
                    style={{ padding: '2px 8px', fontSize: 12 }}
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-outline btn-sm" onClick={handleAddRow}>
          {t('code.addRow')}
        </button>
      </div>

      <div className="form-actions" style={{ marginTop: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setResetOpen(true)}>
          {t('code.reset')}
        </button>
        <button className="btn btn-green" onClick={handleSave} disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title={t('code.reset')}
        onConfirm={handleReset}
        onCancel={() => setResetOpen(false)}
        busy={resetting}
      >
        {t('code.resetConfirm')}
      </ConfirmDialog>
    </div>
  )
}

function CategoryDesc({ category, t }) {
  const descKey = category + 'Desc'
  return (
    <div style={{ marginBottom: 20, padding: '10px 12px', background: '#1e1e1e', borderRadius: 6, fontSize: 12, color: '#aaa', lineHeight: 1.6 }}>
      {t('code.' + descKey)}
      {category === 'imageFormats' && (
        <>
          {' '}
          <a href={BLENDER_FORMAT_URL} target="_blank" rel="noreferrer" style={{ color: '#4a7cdc' }}>
            {t('code.imageFormatsLink')}
          </a>
        </>
      )}
    </div>
  )
}

function ColHeaders({ category, t }) {
  if (category === 'imageFormats') return (
    <>
      <th style={thStyle}>{t('code.colLabel')}</th>
      <th style={thStyle}>{t('code.colExt')}</th>
      <th style={thStyle}>{t('code.colBlenderValue')}</th>
    </>
  )
  if (category === 'videoFormats') return (
    <>
      <th style={thStyle}>{t('code.colLabel')}</th>
      <th style={thStyle}>{t('code.colExt')}</th>
    </>
  )
  return (
    <>
      <th style={thStyle}>{t('code.colLabel')}</th>
      <th style={{ ...thStyle, width: 120 }}>{t('code.colWidth')}</th>
      <th style={{ ...thStyle, width: 120 }}>{t('code.colHeight')}</th>
    </>
  )
}

function RowCells({ category, row, idx, onChange }) {
  const cell = (field, type = 'text', extra = {}) => (
    <td style={tdStyle}>
      <input
        className="form-input"
        style={{ ...inputStyle, ...(type === 'number' ? { textAlign: 'right' } : {}) }}
        type={type}
        value={row[field] ?? (type === 'number' ? 0 : '')}
        onChange={e => onChange(idx, field, type === 'number' ? Number(e.target.value) : e.target.value)}
        {...extra}
      />
    </td>
  )

  if (category === 'imageFormats') return (
    <>{cell('label')}{cell('ext')}{cell('blender_value')}</>
  )
  if (category === 'videoFormats') return (
    <>{cell('label')}{cell('ext')}</>
  )
  return (
    <>{cell('label')}{cell('width', 'number')}{cell('height', 'number')}</>
  )
}

const thStyle = { padding: '6px 8px', textAlign: 'left', color: '#888', fontWeight: 'normal', fontSize: 12 }
const tdStyle = { padding: '4px 8px' }
const inputStyle = { width: '100%', height: 30, fontSize: 13 }

export default CodeSettings
