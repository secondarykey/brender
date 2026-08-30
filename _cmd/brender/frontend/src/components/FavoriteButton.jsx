import { useTranslation } from 'react-i18next'
import { MdStar, MdStarBorder } from 'react-icons/md'
import { FavoriteApi } from '../lib/api'

/**
 * ファイルのお気に入り星ボタン。
 * 状態は呼び出し側が保持し（一覧では FavoriteApi.listIDs でまとめて解決する）、
 * トグル結果を onChange(fileID, favorite) で返す。
 *
 * variant:
 *   'overlay' — サムネイル上に重ねる（カード表示）
 *   'inline'  — テキスト行に並べる（リスト表示・ヘッダ）
 */
function FavoriteButton({ fileID, favorite, onChange, variant = 'inline', size }) {
  const { t } = useTranslation()

  const handleClick = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const next = !favorite
    // 楽観的に反映し、失敗したら元に戻す
    onChange?.(fileID, next)
    FavoriteApi.set({ fileID, favorite: next })
      .then(res => {
        if (typeof res === 'boolean' && res !== next) onChange?.(fileID, res)
      })
      .catch(() => onChange?.(fileID, !next))
  }

  return (
    <button
      type="button"
      className={`favorite-btn favorite-btn--${variant}${favorite ? ' is-favorite' : ''}`}
      onClick={handleClick}
      aria-pressed={favorite}
      title={favorite ? t('favorite.remove') : t('favorite.add')}
      aria-label={favorite ? t('favorite.remove') : t('favorite.add')}
      style={size ? { fontSize: size } : undefined}
    >
      {favorite ? <MdStar /> : <MdStarBorder />}
    </button>
  )
}

export default FavoriteButton
