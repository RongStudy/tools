import { t, useLocale } from '../i18n'
import type { ReactNode } from 'react'

type ToolLayoutProps = {
  title: string
  actions?: ReactNode
  controls?: ReactNode
  status?: ReactNode
  hideHeader?: boolean
  className?: string
  children: ReactNode
}

const ToolLayout = ({
  title,
  actions,
  controls,
  status,
  hideHeader = false,
  className = '',
  children,
}: ToolLayoutProps) => {
  useLocale()
  return (
    <section className={`tool-layout ${className}`.trim()}>
      {!hideHeader && (
        <>
          <header className="tool-layout-header">
            <div className="tool-layout-title">
              <h2>{title}</h2>
            </div>
            {actions && <div className="tool-layout-actions">{actions}</div>}
          </header>
        </>
      )}
      {!hideHeader && controls && <div className="tool-layout-controls">{controls}</div>}
      {children}
      {!hideHeader && status !== undefined && (
        <div className="tool-layout-status" aria-live="polite">
          {status || <span>{t("就绪")}</span>}
        </div>
      )}
    </section>
  )
}

export default ToolLayout
