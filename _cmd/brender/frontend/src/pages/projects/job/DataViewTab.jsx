import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { saveFile } from '../../../lib/dialogs'
import { QueueApi } from '../../../lib/api'
import { useMessage } from '../../../lib/toast'
import { roleAtLeast } from '../../../lib/roles'
import { formatDate } from '../../../lib/dateFormat'
import ConfirmDialog from '../../../components/ConfirmDialog'
import Dialog from '../../../components/Dialog'
import { MdFolder, MdPlayArrow, MdImage } from 'react-icons/md'
import { IMAGE_EXTS, VIDEO_EXTS, LOG_EXTS, isVideoFile, isImageFile, hasFileExt, isJobLocked, formatBytes, downloadDataUri } from './jobFiles'
import { useMoviePlayer } from './useMoviePlayer'

const ZIP_FILTER = [{ DisplayName: 'ZIP Archive', Pattern: '*.zip' }]

// 実行結果の「データ表示」タブ。出力フォルダのファイル一覧から選んでダウンロード・削除する
// （動画は再生、画像はプレビュー）。runner 以上が削除できる。ロック中は削除できない。
export default function DataViewTab({ job, role }) {
  const { t } = useTranslation()
  const { showError } = useMessage()
  const [files, setFiles]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [selected, setSelected]         = useState(new Set())
  const [downloading, setDownloading]   = useState(false)
  const [deleting, setDeleting]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewImgSrc, setPreviewImgSrc]   = useState('')
  const [previewImgName, setPreviewImgName] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [playMovie, movieDialog] = useMoviePlayer()

  const canDelete = roleAtLeast(role, 'runner')

  const handlePreviewImage = (path, name) => {
    setPreviewImgName(name)
    setPreviewImgSrc('')
    setPreviewLoading(true)
    QueueApi.getImageBase64({ path })
      .then(src => { setPreviewImgSrc(src); setPreviewLoading(false) })
      .catch(err => { showError(String(err)); setPreviewLoading(false); setPreviewImgName('') })
  }

  useEffect(() => {
    if (!job) return
    setLoading(true)
    showError('')
    setSelected(new Set())
    QueueApi.listJobFiles({ id: job.id })
      .then(list => { setFiles(list || []); setLoading(false) })
      .catch(err => { showError(String(err)); setLoading(false) })
  }, [job])

  const selectableFiles = files.filter(f => !f.is_dir)
  const allSelected     = selectableFiles.length > 0 && selectableFiles.every(f => selected.has(f.path))
  const someSelected    = selectableFiles.some(f => selected.has(f.path))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(selectableFiles.map(f => f.path)))
    }
  }

  // 拡張子の種類ごとにまとめて選ぶ（全部選ばれていれば外す）
  const selectByExts = (exts) => {
    const paths = selectableFiles.filter(f => hasFileExt(f.name, exts)).map(f => f.path)
    const allAlreadySelected = paths.length > 0 && paths.every(p => selected.has(p))
    setSelected(prev => {
      const next = new Set(prev)
      if (allAlreadySelected) {
        paths.forEach(p => next.delete(p))
      } else {
        paths.forEach(p => next.add(p))
      }
      return next
    })
  }

  const toggleFile = (path) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  // 1つだけ選んだときはそのファイルを、2つ以上なら zip にしてダウンロードする
  const handleDownloadSelected = async () => {
    if (selected.size === 1) {
      const filePath = [...selected][0]
      const file = files.find(f => f.path === filePath)
      if (!file) return
      setDownloading(true); showError('')
      try {
        const dataUri = await QueueApi.getImageBase64({ path: filePath })
        downloadDataUri(dataUri, file.name)
      } catch (err) {
        showError(String(err))
      } finally {
        setDownloading(false)
      }
      return
    }
    showError('')
    try {
      const savePath = await saveFile({
        DefaultFilename: job.id + '_selected.zip',
        Filters: ZIP_FILTER,
      })
      if (!savePath) return
      setDownloading(true)
      await QueueApi.zipJobSelectedFiles({ id: job.id, filePaths: [...selected], savePath })
    } catch (err) {
      showError(String(err))
    } finally {
      setDownloading(false)
    }
  }

  const handleDeleteSelected = async () => {
    setDeleting(true); showError('')
    try {
      await QueueApi.deleteJobFiles({ id: job.id, filePaths: [...selected] })
      setSelected(new Set())
      const list = await QueueApi.listJobFiles({ id: job.id })
      setFiles(list || [])
      setConfirmDelete(false)
    } catch (err) {
      showError(String(err))
      setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) return <p className="setting-desc">{t('common.loading')}</p>
  if (files.length === 0) return <p className="empty-msg">{t('job.noFiles')}</p>

  const isLocked  = job && isJobLocked(job.data_status)
  const totalSize = selectableFiles.reduce((sum, f) => sum + (f.size || 0), 0)

  return (
    <div className="job-data-view">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <p className="setting-desc job-data-path" style={{ margin: 0 }}>{job.output_dir}</p>
        <span className="setting-desc" style={{ margin: 0, whiteSpace: 'nowrap', marginLeft: 12 }}>{formatBytes(totalSize)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-sm" onClick={handleDownloadSelected} disabled={downloading || !someSelected}>
            {downloading
              ? t('common.downloading')
              : selected.size === 1
                ? `${t('common.download')} (1)`
                : `${t('common.downloadZip')}${someSelected ? ` (${selected.size})` : ''}`}
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(IMAGE_EXTS)}>{t('job.filterImage')}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(VIDEO_EXTS)}>{t('job.filterVideo')}</button>
          <button className="btn btn-sm btn-ghost" onClick={() => selectByExts(LOG_EXTS)}>{t('job.filterLog')}</button>
        </div>
        {canDelete && (
          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)} disabled={deleting || isLocked || !someSelected}>
            {deleting ? t('common.deleting') : `${t('common.deleteSelected')}${someSelected ? ` (${selected.size})` : ''}`}
          </button>
        )}
      </div>
      <table className="queue-table">
        <thead>
          <tr>
            <th style={{ width: 32, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                onChange={toggleAll}
                title={allSelected ? t('common.deselectAll') : t('common.selectAll')}
              />
            </th>
            <th>{t('table.name')}</th>
            <th style={{ textAlign: 'right' }}>{t('table.size')}</th>
            <th style={{ textAlign: 'center' }}>{t('table.updatedAt')}</th>
          </tr>
        </thead>
        <tbody>
          {files.map(f => {
            const canPlay = !f.is_dir && isVideoFile(f.name)
            const canView = !f.is_dir && isImageFile(f.name)
            const isSelected = !f.is_dir && selected.has(f.path)
            const rowClick = canPlay ? () => playMovie(f.path)
                           : canView ? () => handlePreviewImage(f.path, f.name)
                           : undefined
            const rowTitle = canPlay ? t('viewer.playMovie')
                           : canView ? f.name
                           : undefined
            return (
              <tr
                key={f.name}
                className={`${f.is_dir ? 'job-data-row-dir' : ''} ${canPlay ? 'job-data-row-video' : ''} ${canView ? 'job-data-row-image' : ''} ${isSelected ? 'job-data-row-selected' : ''}`.trim()}
                onClick={rowClick}
                title={rowTitle}
                style={canView ? { cursor: 'pointer' } : undefined}
              >
                <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  {!f.is_dir && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleFile(f.path)}
                    />
                  )}
                </td>
                <td style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {f.is_dir ? <MdFolder /> : canPlay ? <MdPlayArrow /> : canView ? <MdImage /> : null}
                  {f.name}
                </td>
                <td style={{ textAlign: 'right' }}>{f.is_dir ? '—' : formatBytes(f.size)}</td>
                <td className="date-cell">{formatDate(f.mod_time)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ConfirmDialog
        open={confirmDelete}
        title={t('common.deleteSelected')}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDeleteSelected}
        confirmLabel={deleting ? t('common.deleting') : t('common.delete')}
        busy={deleting}
      >
        <p>{t('common.confirmDeleteFiles')}</p>
      </ConfirmDialog>

      {movieDialog}

      {previewImgName && (
        <Dialog open={true} title={previewImgName} onClose={() => { setPreviewImgName(''); setPreviewImgSrc('') }} wide>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            {previewLoading
              ? <span>{t('common.loading')}</span>
              : previewImgSrc && <img src={previewImgSrc} alt={previewImgName} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
            }
          </div>
        </Dialog>
      )}
    </div>
  )
}
