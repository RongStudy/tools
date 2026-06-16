import type { ReactNode } from 'react'

type ToolLayoutProps = {
  title: string
  description?: string
  actions?: ReactNode
  status?: ReactNode
  hideHeader?: boolean
  className?: string
  children: ReactNode
}

const ToolLayout = ({
  title,
  description,
  actions,
  status,
  hideHeader = false,
  className = '',
  children,
}: ToolLayoutProps) => {
  return (
    <section className={`tool-layout ${className}`.trim()}>
      {!hideHeader && (
        <>
          <header className="tool-layout-header">
            <div className="tool-layout-title">
              <h2>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            {actions && <div className="tool-layout-actions">{actions}</div>}
          </header>
          {status}
        </>
      )}
      {children}
    </section>
  )
}

export default ToolLayout
