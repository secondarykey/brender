import { useTranslation } from 'react-i18next'
import EntityIcon, { entityClass } from './EntityIcon'

// 「いま見ているものが何か」を示す見出し帯。種別ラベル（ファイル / ワークスペース …）と名称を並べる。
// パンくずは道筋、こちらは現在地の表札。種別ごとの文言・アイコン・色をページ側に散らさないため、
// プロジェクト / ファイル / ワークスペースの見出しは必ずこれで出す。
//   thumb    … 左端に出すサムネイル等（任意）
//   suffix   … 名称の右に差し込むマーク（任意）
//   children … 右端に並べる操作（任意）
export default function EntityHeader({ type, name, thumb = null, suffix = null, children = null }) {
  const { t } = useTranslation()
  return (
    <div className={`entity-header ${entityClass(type)}`}>
      {thumb}
      <div className="entity-header-text">
        <span className="entity-header-kind">
          <EntityIcon type={type} size={14} />
          {t(`entity.${type}`)}
        </span>
        <h2 className="entity-header-name" title={name}>
          <span className="entity-header-name-text">{name}</span>
          {suffix}
        </h2>
      </div>
      {children && <div className="entity-header-actions">{children}</div>}
    </div>
  )
}
