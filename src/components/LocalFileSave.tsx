import { t, useLocale } from '../i18n'
import type { OpenLocalFile } from '../utils/localFile'

type Props = {
  file?: OpenLocalFile
  content: string
  label: string
  saving: boolean
  disabled: boolean
  onSave: () => void
}

export default function LocalFileSave({ file, content, label, saving, disabled, onSave }: Props) {
  useLocale()
  if (!file) return null
  const dirty = file.content !== content
  return (
    <div className="local-file-save">
      <button type="button" className="btn-small" title={t("保存到 {value0}", { value0: file.name })} disabled={disabled || !dirty} onClick={onSave}>{label}</button>
      <small className="local-file-status" role="status" aria-label={t("{value0}状态", { value0: label })} aria-live="polite">
        {saving ? t("保存中") : dirty ? t("未保存") : t("已保存")}
      </small>
    </div>
  )
}
