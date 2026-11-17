import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { openFile } from '../lib/dialogs'
import { useThumbnail } from '../lib/useThumbnail'

const IMAGE_FILTER = [{ DisplayName: 'Image', Pattern: '*.jpg;*.jpeg;*.png;*.bmp;*.webp' }]

// サムネイルの欄。クリックで画像を選んで差し替える（ファイル設定とワークスペースで共通）。
//   fetcher, deps … 今のサムネイルの取り方（useThumbnail に渡す）
//   save          … (imagePath) => 差し替えたあとのサムネイル（ウィンドウは base64、ブラウザは URL）
//   disabled      … 差し替えさせない
export default function ThumbnailPicker({ fetcher, deps, save, disabled }) {
  const { t } = useTranslation()
  const [src, setSrc] = useThumbnail(fetcher, deps)
  const [uploading, setUploading] = useState(false)

  const handleClick = async () => {
    if (uploading || disabled) return
    try {
      const path = await openFile({ Filters: IMAGE_FILTER })
      if (!path) return
      setUploading(true)
      const data = await save(path)
      setSrc(data || null)
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="thumbnail-panel">
      <h3 className="ws-detail-section-title">{t('workspace.thumbnail')}</h3>
      <div className="thumbnail-clickable" onClick={handleClick} title={t('workspace.clickToChangeThumbnail')}>
        {src
          ? <img className="thumbnail-img" src={src} alt="thumbnail" />
          : <div className="thumbnail-placeholder">No Image</div>
        }
      </div>
    </div>
  )
}
