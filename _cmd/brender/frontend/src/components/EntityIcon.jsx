import { MdFolder, MdViewInAr, MdTune } from 'react-icons/md'

// 階層エンティティの種別アイコン。プロジェクト / ファイル / ワークスペースは
// 一覧の見た目が近いため、種別ごとにアイコンとアクセント色を固定して混同を防ぐ。
const ENTITY = {
  project:   MdFolder,
  file:      MdViewInAr,
  workspace: MdTune,
}

// entityClass は種別アクセント色（--entity-accent）を与えるクラス名を返す。
// タイル・行のコンテナに entityClass(type) と 'entity-bar' を付けると左端に色帯が出る。
export function entityClass(type) {
  return ENTITY[type] ? `entity-${type}` : ''
}

export default function EntityIcon({ type, size = 16, className = '' }) {
  const Icon = ENTITY[type]
  if (!Icon) return null
  return (
    <Icon
      className={`entity-icon ${entityClass(type)}${className ? ` ${className}` : ''}`}
      size={size}
      aria-hidden="true"
    />
  )
}
