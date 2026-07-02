---
version: beta
name: Developer Tools Workbench
description: "A dense, dark, keyboard-friendly workspace for everyday developer utilities. The interface prioritizes readable editors, stable panels, fast scanning, and low-distraction controls over marketing polish."

colors:
  bg: "#010102"
  surface: "#0f1011"
  surface-muted: "#141516"
  surface-raised: "#18191a"
  surface-deep: "#191a1b"
  text: "#f7f8f8"
  muted: "#8a8f98"
  subtle: "#62666d"
  border: "#23252a"
  border-strong: "#34343a"
  border-tertiary: "#3e3e44"
  primary: "#5e6ad2"
  primary-hover: "#828fff"
  primary-soft: "rgba(94, 106, 210, 0.14)"
  primary-border: "rgba(94, 106, 210, 0.46)"
  primary-muted: "#d0d6e0"
  danger: "#f87171"
  danger-hover: "#fca5a5"
  danger-soft: "rgba(248, 113, 113, 0.12)"
  success: "#27a644"
  success-hover: "#31c655"
  info: "#7a7fad"
  info-hover: "#8e94c4"
  focus: "rgba(94, 105, 209, 0.5)"

typography:
  display:
    fontFamily: "SF Pro Display, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  text:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
  mono:
    fontFamily: "SF Mono, JetBrains Mono, ui-monospace, Menlo, Monaco, Consolas, monospace"
  page-title:
    fontSize: "23px to 28px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontSize: "14px to 16px"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontSize: "12px to 13px"
    fontWeight: 400
    lineHeight: 1.4
  button:
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.2

radii:
  compact: "6px"
  control: "8px"
  card: "12px"
  panel: "16px"
  full: "9999px"

spacing:
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design Intent

This project is a developer utility workbench, not a marketing site. Design decisions should make repeated tool use faster, calmer, and more legible.

The product should feel like a precise desktop tool: dark, compact, stable, and functional. Decoration is acceptable only when it reinforces orientation, state, or the specific utility being used.

# Principles

1. Tool first
   The active editor, input, output, preview, or result area is always the visual priority.

2. Stable layout
   Buttons, tabs, editor panels, status messages, and split views must not shift when content changes.

3. Dense but breathable
   Use compact controls and short labels, while keeping enough spacing for scanning and touch targets.

4. Low chroma
   Lavender is the primary action and focus color. Red, green, and info colors are reserved for semantic states.

5. No marketing components
   Do not introduce pricing cards, testimonials, logo grids, oversized CTA banners, or decorative product mockups.

6. Existing patterns first
   New pages should reuse the existing shell, layout, panel, button, and toast patterns before adding new visual systems.

# Color System

The application uses a near-black canvas with a small surface ladder. The interface should stay quiet and legible during long editor sessions.

Primary surfaces:

| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#010102` | App canvas, sidebar background, fullscreen background |
| `--color-surface` | `#0f1011` | Panels, secondary buttons, inputs |
| `--color-surface-muted` | `#141516` | Panel headers, active nav rows, hover fills |
| `--color-surface-raised` | `#18191a` | Hovered compact controls, subtle lifted areas |
| `--color-surface-deep` | `#191a1b` | Rare deepest nested surfaces |

Text and borders:

| Token | Value | Use |
| --- | --- | --- |
| `--color-text` | `#f7f8f8` | Primary text |
| `--color-muted` | `#8a8f98` | Descriptions, secondary labels, empty states |
| `--color-subtle` | `#62666d` | Disabled text, tertiary labels |
| `--color-border` | `#23252a` | Default borders and dividers |
| `--color-border-strong` | `#34343a` | Hover borders and emphasized separation |
| `--color-border-tertiary` | `#3e3e44` | Nested or fullscreen separators |

Accent and state:

| Token | Value | Use |
| --- | --- | --- |
| `--color-primary` | `#5e6ad2` | Primary action, active icon, strong selected state |
| `--color-primary-hover` | `#828fff` | Primary hover, small accent text |
| `--color-primary-soft` | `rgba(94, 106, 210, 0.14)` | Soft selected backgrounds |
| `--color-primary-border` | `rgba(94, 106, 210, 0.46)` | Active borders |
| `--color-focus` | `rgba(94, 105, 209, 0.5)` | Focus outlines |
| `--color-danger` | `#f87171` | Destructive actions and errors |
| `--color-success` | `#27a644` | Successful completion or valid states |
| `--color-info` | `#7a7fad` | Neutral informational accents |

Use semantic colors sparingly. Do not use red, green, or info colors as page decoration.

# Typography

Use the existing font variables:

- Display: `--font-display`
- UI text: `--font-text`
- Code: `--font-mono`

Guidelines:

- Page titles: 23-28px, 600 weight, line-height 1.2.
- Panel titles: 14-16px, 600 weight.
- Body and control text: 14-16px, line-height 1.4-1.5.
- Captions and nav descriptions: 12-13px, muted.
- Code and timestamp values use the mono stack.
- Avoid negative letter spacing below 16px.
- Keep Chinese labels short and direct. Prefer familiar product terms over decorative copy.

# App Shell

The app uses a persistent left sidebar and a full-height main workspace.

Sidebar:

- Default width: 300px.
- Collapsed width: 76px.
- Background: `--color-bg`.
- Right border: `--color-border`.
- The brand mark is a compact square, not a logo lockup.
- Tool groups use muted category labels.
- Tool rows show title plus short capability text.
- Active tool rows use `--color-surface-muted` and `--color-primary-border`.
- Collapsed mode shows stable initials or icons with tooltips/titles.

Main workspace:

- Height: 100vh.
- Padding: 24px on desktop, 16px on tablet, 12px on small screens.
- Keep page overflow contained. Editors and panels should scroll internally when needed.
- Avoid page-level scrolling for primary tool flows unless the tool naturally needs a document-like layout.

# Home

The home page is a tool launcher, not a landing page.

Rules:

- Show available tools immediately.
- Tool cards should be compact, scannable, and clearly clickable.
- The current canvas animation style is acceptable because it is subtle and product-relevant.
- Motion must respect `prefers-reduced-motion`.
- Do not add marketing sections, large CTAs, customer logos, testimonials, or pricing blocks.

# Tool Pages

Every tool page should use `ToolLayout` unless it has a specific interaction model that requires a custom shell.

Tool header:

- Use one clear title and one short description.
- Place page-level actions on the right on desktop.
- Let actions wrap below the title on narrow screens.
- Do not use hero-scale type inside tool pages.

Tool body:

- Put the core interaction above secondary settings.
- Prefer side-by-side layouts for input/output workflows on desktop.
- Collapse side-by-side panels to stacked panels on narrow screens.
- Preserve editor height while loading, validating, or showing errors.

# Panels

Editor panels are the primary component family.

Editor panel:

- Background: `--color-surface`.
- Border: 1px solid `--color-border`.
- Radius: 16px.
- Header background: `--color-surface-muted`.
- Header minimum height: 56px.
- Body fills available height.
- Use an inset top highlight only when it improves separation on dark surfaces.

Panel headers:

- Left side names the content.
- Right side contains actions.
- Actions wrap instead of overflowing.
- Use short button labels.
- Do not put a card inside another card.

Non-editor panels:

- Use the same surface ladder and border logic.
- Radius should usually be 12px or 16px.
- Avoid decorative shadow; dark-surface separation comes from borders and background steps.

# Editors

Monaco editor surfaces should feel integrated with the app.

Rules:

- Use dark editor themes by default.
- Loading states must preserve final editor dimensions.
- Fullscreen mode removes radius and fills the viewport.
- Split editors collapse to stacked panels on smaller screens.
- Do not resize panels when validation messages appear.
- Code uses `--font-mono`.
- Long code, URLs, or timestamps may scroll horizontally inside editor surfaces.

# Controls

Buttons:

| Class | Use | Treatment |
| --- | --- | --- |
| `.btn-primary` | Main affirmative action | Lavender fill, white text |
| `.btn-secondary` | Normal action | Dark surface, border, white text |
| `.btn-danger` | Destructive action | Soft red fill, red text |
| `.btn-small` | Panel toolbar actions | 32px minimum height |
| `.btn-fullscreen` | Editor focus mode | Soft lavender treatment |

Button rules:

- Normal buttons should be at least 40px tall.
- Small toolbar buttons should be at least 32px tall.
- Use 8px radius for normal controls and 6px for compact controls.
- Disabled buttons must remain legible and clearly inactive.
- Prefer concise labels: "复制", "格式化", "压缩", "交换", "全屏".

Inputs and selects:

- Background: `--color-surface`.
- Border: `--color-border`.
- Radius: 8px.
- Focus: 2px `--color-focus` outline with 1px offset.
- Minimum height: 38px desktop, 44px for touch-heavy contexts.
- Place labels close to their controls.

Segmented controls:

- Use for view modes, unit modes, and mutually exclusive options.
- Selected state must be visible without relying only on color.
- Keep options short and avoid wrapping inside each segment.

# Feedback

Toast:

- Appears without shifting layout.
- Uses semantic color only for state.
- Text should be short and action-oriented.
- Prefer "已复制", "格式化成功", "JSON 无效" over long explanations.

Errors:

- Show near the relevant input, editor, or panel.
- Preserve panel dimensions.
- Use `--color-danger` and concise recovery text.
- Do not rely only on red; include text.

Success:

- Use green only for completed actions or valid states.
- Avoid decorative green accents elsewhere.

Empty states:

- Use muted text.
- Keep them useful: say what is missing and what the user can do next.

# Responsive Behavior

Desktop:

- Sidebar plus main workspace.
- Multi-panel tools can use side-by-side layouts.
- Tool actions align to the right when space allows.

Tablet:

- Keep the sidebar if it remains usable.
- Tool headers may stack title and actions.
- Two-column editor layouts may remain if each panel is still readable.

Mobile:

- Prefer single-column panels.
- Avoid horizontal page scrolling except inside code editors.
- Controls must keep readable labels and practical touch targets.
- Tool card grids become one column.
- Panel actions wrap to the next line.

# Accessibility

- All interactive controls need visible focus states.
- Color must not be the only state indicator.
- Buttons need accessible names through text, `aria-label`, or `title`.
- Motion must respect `prefers-reduced-motion`.
- Text must not overlap or truncate critical information.
- Use `aria-label` for navigation and grouped tool launchers.
- Preserve keyboard access for search, navigation, editor actions, and fullscreen exits.

# Implementation Notes

Prefer these existing classes and components before adding new patterns:

- `AppShell`
- `ToolLayout`
- `Toast`
- `.editor-panel`
- `.panel-header`
- `.panel-actions`
- `.btn`
- `.btn-primary`
- `.btn-secondary`
- `.btn-danger`
- `.btn-small`
- `.btn-fullscreen`

When adding a new tool:

1. Register it in `src/tools/registry.tsx`.
2. Use `ToolLayout` for the page frame.
3. Use editor panels or compact form panels for the main interaction.
4. Reuse existing button and panel classes.
5. Add only the page-specific CSS needed for layout or unique states.
6. Test desktop and narrow viewport behavior.

# Do

- Keep the active tool's working surface visually dominant.
- Reuse the existing dark tokens and panel structure.
- Use compact, direct Chinese UI labels.
- Preserve heights while async states, errors, or copied states appear.
- Use Monaco-friendly layouts with `min-height: 0` and contained overflow.
- Let the design feel like a calm engineering console.

# Don't

- Do not create marketing-page sections.
- Do not use decorative gradients, oversized hero typography, or floating promo cards.
- Do not introduce unrelated color palettes per tool.
- Do not nest cards inside cards.
- Do not let long labels overflow buttons or nav rows.
- Do not add shadows as the main depth mechanism.
- Do not make lavender a large background fill.
