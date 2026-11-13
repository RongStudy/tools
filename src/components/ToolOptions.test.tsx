import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ToolOptions from './ToolOptions'

describe('ToolOptions', () => {
  it('reveals options on demand, shows active settings and restores focus on Escape', () => {
    render(<ToolOptions count={2}><button>Action</button></ToolOptions>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /选项/ })
    expect(trigger).toHaveTextContent('2')
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: '选项' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('retains settings while open and closes after an action when requested', () => {
    render(<ToolOptions closeOnAction><label><input type="checkbox" />Setting</label><button>Apply</button></ToolOptions>)
    fireEvent.click(screen.getByRole('button', { name: '选项' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Setting' }))
    expect(screen.getByRole('checkbox', { name: 'Setting' })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on outside pointer, focus, scroll or viewport resize', () => {
    render(<><ToolOptions><button>Action</button></ToolOptions><button>Outside</button></>)
    const trigger = screen.getByRole('button', { name: '选项' })
    for (const close of [
      () => fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' })),
      () => screen.getByRole('button', { name: 'Outside' }).focus(),
      () => fireEvent.scroll(document),
      () => fireEvent.resize(window),
    ]) {
      fireEvent.click(trigger)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      act(close)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
  })

  it('removes portalled options when a cached tool becomes inactive', async () => {
    const { rerender } = render(<div className="tool-route-panel" aria-hidden="false"><ToolOptions><button>Action</button></ToolOptions></div>)
    fireEvent.click(screen.getByRole('button', { name: '选项' }))
    rerender(<div className="tool-route-panel" aria-hidden="true"><ToolOptions><button>Action</button></ToolOptions></div>)
    await act(async () => {})
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
