import { useState, useEffect, useRef } from 'react'
import { Dialogs } from '@wailsio/runtime'
import { BlenderService } from '../../../bindings/changeme'

function BlenderSettings() {
  const [blenders, setBlenders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dragIndex = useRef(null)
  const [dragOver, setDragOver] = useState(null)

  const load = () => {
    BlenderService.List()
      .then(list => setBlenders(list || []))
      .catch(err => setError(String(err)))
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    setError('')
    const filters = window.navigator.platform.startsWith('Win')
      ? [{ DisplayName: 'Blender Executable', Pattern: '*.exe' }]
      : []
    try {
      const result = await Dialogs.OpenFile({ Filters: filters })
      if (!result) return
      setLoading(true)
      await BlenderService.Register(result)
      load()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    setError('')
    try {
      await BlenderService.Delete(id)
      load()
    } catch (err) {
      setError(String(err))
    }
  }

  const handleDragStart = (e, index) => {
    dragIndex.current = index
    e.dataTransfer.effectAllowed = 'move'
    // Firefox requires data to be set
    e.dataTransfer.setData('text/plain', index)
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(index)
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault()
    setDragOver(null)
    const from = dragIndex.current
    dragIndex.current = null
    if (from === null || from === dropIndex) return

    const newList = [...blenders]
    const [moved] = newList.splice(from, 1)
    newList.splice(dropIndex, 0, moved)
    setBlenders(newList)

    try {
      await BlenderService.Reorder(newList.map(b => b.id))
    } catch (err) {
      setError(String(err))
      load()
    }
  }

  const handleDragEnd = () => {
    dragIndex.current = null
    setDragOver(null)
  }

  return (
    <div>
      <h2 className="section-title">Blender</h2>

      <div className="toolbar">
        <button className="btn" onClick={handleAdd} disabled={loading}>
          {loading ? '登録中...' : '+ Blender を追加'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {blenders.length === 0 ? (
        <p className="empty-msg">登録されたBlenderはありません</p>
      ) : (
        <>
          <p className="setting-desc" style={{ marginBottom: 8 }}>
            ≡ をドラッグして順序を変更できます。一番上のBlenderがデフォルトとして使用されます。
          </p>
          <table className="blender-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>名前</th>
                <th>バージョン</th>
                <th>パス</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blenders.map((b, index) => (
                <tr
                  key={b.id}
                  draggable
                  onDragStart={e => handleDragStart(e, index)}
                  onDragOver={e => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  className={dragOver === index ? 'drag-over' : ''}
                >
                  <td className="drag-handle" title="ドラッグで並び替え">≡</td>
                  <td>
                    {index === 0 && <span className="default-badge">デフォルト</span>}
                    {b.name}
                  </td>
                  <td>{b.version || '—'}</td>
                  <td className="path-cell">{b.path}</td>
                  <td>
                    <button className="btn btn-danger" onClick={() => handleDelete(b.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

export default BlenderSettings
