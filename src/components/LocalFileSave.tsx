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
  if (!file) return null
  const dirty = file.content !== content
  return (
    <div className="local-file-save">
      <button type="button" className="btn-small" title={`保存到 ${file.name}`} disabled={disabled || !dirty} onClick={onSave}>{label}</button>
      <small className="local-file-status" role="status" aria-label={`${label}状态`} aria-live="polite">
        {saving ? '保存中' : dirty ? '未保存' : '已保存'}
      </small>
    </div>
  )
}
