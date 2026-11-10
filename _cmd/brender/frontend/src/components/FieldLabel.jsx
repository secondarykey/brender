import { useTranslation } from 'react-i18next'
import { MdLock } from 'react-icons/md'

// 入力欄のラベル（＋「未設定時 = …」や固定値の添え書き）。
// 必ず1行に収め、入りきらない分は「…」にして、全文は title で出す。
// 横に並んだ欄のうち1つだけラベルが折り返すと、その欄の入力だけ下へずれるため。
//   defaultValue … 未設定のときに使われる値（あれば「（未設定時 = 値）」を添える）
//   lockedValue  … 上位の設定で固定されている値（あれば鍵アイコン付きで添える。defaultValue より優先）
export default function FieldLabel({ text, defaultValue = null, lockedValue = null }) {
  const { t } = useTranslation()
  const tagText = lockedValue
    ? String(lockedValue)
    : defaultValue
      ? `（${t('workspace.defaultValueLabel', { value: defaultValue })}）`
      : ''
  return (
    <label className="form-label form-label-ellipsis" title={tagText ? `${text} ${tagText}` : text}>
      {text}
      {lockedValue
        ? <span className="form-lock-tag"><MdLock /> {lockedValue}</span>
        : (tagText && <span className="form-default-tag">{tagText}</span>)
      }
    </label>
  )
}
