import type { ReactNode } from 'react'

export type ToolIconName = 'home' | 'json' | 'diff' | 'regex' | 'codec' | 'diagram' | 'clock' | 'note' | 'search' | 'animation'

const shapes: Record<ToolIconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h5v-6h4v6h5V9" /></>,
  json: <><path d="M9 4H7a2 2 0 0 0-2 2v3a3 3 0 0 1-2 3 3 3 0 0 1 2 3v3a2 2 0 0 0 2 2h2M15 4h2a2 2 0 0 1 2 2v3a3 3 0 0 0 2 3 3 3 0 0 0-2 3v3a2 2 0 0 1-2 2h-2" /><circle cx="12" cy="9" r=".7" /><circle cx="12" cy="15" r=".7" /></>,
  diff: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16M6 9h3M6 15h3M15 12h3M16.5 10.5v3" /></>,
  regex: <><circle cx="5" cy="17" r="1" /><path d="M15 5v12M9.8 8l10.4 6M9.8 14l10.4-6" /></>,
  codec: <><path d="m7 8-4 4 4 4m10-8 4 4-4 4M14 5l-4 14" /></>,
  diagram: <><rect x="9" y="3" width="6" height="5" rx="1" /><rect x="2" y="16" width="7" height="5" rx="1" /><rect x="15" y="16" width="7" height="5" rx="1" /><path d="M12 8v4H5.5v4M12 12h6.5v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  note: <><path d="M14 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10Z" /><path d="M14 3v7h7M7 14h10M7 17h7" /></>,
  animation: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m10 8 5 4-5 4z" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
}

type ToolIconProps = {
  name?: ToolIconName
  src?: string
}

// Set iconSrc in the tool registry to replace a placeholder with an imported SVG/PNG.
const ToolIcon = ({ name = 'note', src }: ToolIconProps) => {
  const imageSrc = src
  return imageSrc ? (
    <img className="tool-icon-image" src={imageSrc} alt="" aria-hidden="true" draggable={false} />
  ) : (
    <svg className="tool-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {shapes[name]}
    </svg>
  )
}

export default ToolIcon
