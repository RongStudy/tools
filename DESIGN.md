---
version: beta
name: Developer Tools Workbench
description: "A dense, keyboard-friendly workspace for everyday developer utilities, with coordinated dark and light themes. Prioritizes readable editors, stable panels, fast scanning, and low-distraction controls over marketing polish."
colors:
  bg: "#010102"
  surface: "#0f1011"
  surface-muted: "#141516"
  surface-raised: "#18191a"
  surface-deep: "#191a1b"
  text: "#f7f8f8"
  muted: "#8a8f98"
  subtle: "#737880"
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
  success-soft: "rgba(39, 166, 68, 0.12)"
  info: "#7a7fad"
  info-hover: "#8e94c4"
  focus: "rgba(94, 105, 209, 0.5)"
light-colors:
  bg: "#f6f7f9"
  surface: "#ffffff"
  surface-muted: "#f1f3f6"
  surface-raised: "#e9edf2"
  surface-deep: "#eef1f5"
  text: "#20232b"
  muted: "#5d6572"
  subtle: "#767f8d"
  border: "#e1e5eb"
  border-strong: "#cbd2dc"
  border-tertiary: "#b9c1cc"
  primary: "#4f5bc3"
  primary-hover: "#3f4cae"
  primary-soft: "rgba(79, 91, 195, 0.1)"
  primary-border: "rgba(79, 91, 195, 0.34)"
  primary-muted: "#3f4a91"
  danger: "#c83b4b"
  danger-hover: "#a82c3b"
  danger-soft: "rgba(200, 59, 75, 0.1)"
  success: "#218642"
  success-hover: "#196b34"
  success-soft: "rgba(33, 134, 66, 0.1)"
  info: "#5d65a4"
  info-hover: "#4b528c"
  focus: "rgba(79, 91, 195, 0.38)"
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
  panel-title:
    fontSize: "14px to 16px"
    fontWeight: 600
    lineHeight: 1.35
  body:
    fontSize: "14px to 16px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontSize: "13px to 14px"
    fontWeight: 500
    lineHeight: 1.35
  caption:
    fontSize: "12px to 13px"
    fontWeight: 400
    lineHeight: 1.4
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

# Design Intent & Principles

This project is a high-precision developer utility workbench, not a marketing website. Every UI decision must optimize for repeated utility usage, visual stability, and legibility.

1. **Tool First**: The active editor, input, output, or preview area is always the primary visual focus.
2. **Zero Layout Shift**: Buttons, tabs, panels, status bars, and split views must maintain exact dimensions when content, loading states, or validation errors change.
3. **Dense & Breathable**: Use compact controls and concise localized labels while preserving clear scan paths and touch targets.
4. **Low Chroma Discipline**: Lavender (`--color-primary`) is the sole brand/focus accent. Semantic colors (`danger`, `success`, `info`) are strictly reserved for functional states.
5. **Reuse Before Creating**: Always assemble new pages using existing shell, panel, button, and CSS token primitives.

# Color & Theme Tokens

All tokens defined in the YAML frontmatter map directly to CSS custom properties (`--color-*`). Light mode uses a cool neutral gray canvas (`#f6f7f9`) with crisp white working surfaces (`#ffffff`).

## Semantic Usage Mapping
- `--color-bg`: App canvas, sidebar Dock, fullscreen background.
- `--color-surface`: Editor bodies, panels, inputs, secondary buttons.
- `--color-surface-muted`: Panel headers, active nav rows, subtle fills, status bars.
- `--color-surface-raised`: Hovered controls, `<kbd>` badges, lifted interactive elements.
- `--color-surface-deep`: Rare nested wells (avoid deep nesting).
- `--color-text` / `--color-muted` / `--color-subtle`: Primary content / descriptions & secondary labels / tertiary hints (use `opacity: 0.5` on top of muted/subtle for `disabled` states).
- `--color-border` / `--color-border-strong` / `--color-border-tertiary`: Default dividers / hover borders / nested or fullscreen separators.

## Scrollbars & Theme Behavior
- **Appearance**: Offer System, Dark, and Light in Settings. New users default to System, which follows the browser’s reported color preference in real time. Keep existing manual preferences when upgrading.
- **Custom Scrollbars**: Style WebKit and standard scrollbars to match the active theme (`transparent` track, `--color-border-strong` thumb, `--color-border-tertiary` on hover, `6px` width/height). Never leave default white OS scrollbars visible in dark mode.
- **Instant Sync**: Switching themes in the Settings dialog must immediately update the shell, panels, scrollbars, Monaco (`vs-dark` vs `vs`), Mermaid diagrams, and Markdown syntax highlighting without remounting editors or losing draft state.
- **Exports**: Standalone Markdown/HTML exports must use a self-contained light document style.

# Typography & Copy Rules

- **Font Stacks**: `--font-display` for headings, `--font-text` for UI, `--font-mono` for code, JSON, regex, hashes, and timestamps.
- **Spacing**: Never apply negative `letter-spacing` to text smaller than `16px`.
- **Bilingual UI Copy**: Default to English; offer persistent English / 中文 switching in Settings. Keep labels concise, direct, and idiomatic in both languages (e.g., `"复制"`, `"格式化"`, `"压缩"`, `"清空"`, `"交换"`, `"全屏"`, `"填入示例"`). Avoid conversational filler or marketing slogans.

# App Shell & Navigation

The shell consists of a persistent left icon Dock and a `100vh` contained workspace.

## Left Dock (Desktop `> 900px`)
- **Fixed Width**: `84px`. Hovering never expands the rail or shifts the workspace.
- **Slots**: Start with Home, followed by the scrollable tool list. Keep Search (`Cmd/Ctrl+K`) and Settings pinned at the bottom with an `8px` gap. Reserve symmetrical scrollbar space so icons stay vertically aligned.
- **Magnification**: Each tool link sits in a fixed `64px × 76px` slot with a `40px` icon surface. Fine-pointer movement magnifies nearby icon surfaces up to `1.45×` (max `6px` vertical displacement) with spring physics. Disable magnification on touch devices or when `prefers-reduced-motion: reduce` is active.
- **Tooltips**: Render tool-name tooltips outside the scrolling rail. Offset tooltips horizontally past the maximum `1.45×` magnified icon boundary so they never overlap hovered icons.
- **Active State**: Lavender icon surface + distinct side indicator pill in both themes. Ensure SVG/image tool icons adapt cleanly to light surfaces.

Tool icons support drag-to-reorder and Alt + arrow keys. Settings offers named up/down controls and a reset action. Persist tool paths locally; keep Home first and Search/Settings pinned. New tools append to saved orders; removed tools are ignored.

## Mobile/Tablet Launcher (`<= 900px`)
- Collapse the vertical Dock into a horizontally scrolling top launcher bar displaying icons with short visible text labels. Keep Search and Settings visible to the right of the scrollable list.

## Main Workspace
- **Padding**: Desktop uses `10px` above and below the workspace and `12px` on each side. Tablet uses `8px` above and below and `10px` on each side. Mobile (`<= 560px`) uses `8px` on all sides.
- **Overflow**: Contain overflow at the shell level (`100vh`); panels and editors scroll internally. Only allow document-level page scrolling if a tool explicitly requires a long-form document flow.

# Layout & Component Specifications

## Home Page
- Render a scannable, compact grid of clickable tool cards immediately (1 column on mobile).
- Subtle, motion-safe canvas background animation is permitted; hero banners, pricing, testimonials, and promotional CTAs are strictly forbidden.

## Tool Pages (`ToolLayout`)
- **Header**: Single page title and a compact group of primary actions or mode controls, with `8px` between the header and the content. Keep frequent actions such as Clear, Copy, file writeback and language status visible beside their content. Only advanced or low-frequency settings belong in a named options popover. Avoid a wall of equivalent buttons.
- **Progressive disclosure**: Use the shared ToolOptions component for advanced configuration, grouped file selection and export variants. Do not hide frequently used actions or create a menu that only contains status text. Show an enabled-settings count where hidden options affect results. Popovers size to their content (200–300px), use 32px flat menu rows with 4px gaps and 6px outer padding, and omit repeated headings and close buttons. Keep form labels and selects aligned; use 44px targets on coarse pointers. Popovers must escape panel clipping, close on Escape/outside click, and restore keyboard focus.
- **Workflow selection**: Choose one task family first (e.g. URL / Base64 / Unicode / Digest), then show only that family's actions. Keep mode selection separate from document tabs.
- **Context**: Put copy, file save, export and preview controls beside their corresponding content. Never repeat every action in the page header. Keep core inputs, Run/Format/Render, result copy, and fullscreen discoverable without opening menus.
- **Density**: Use one compact toolbar row per scope, consistent 8px control gaps, and 40px page / 32px panel actions. Wrap deliberate groups on tablet; do not shrink text or create horizontal toolbar scrolling.
- **Body**: Place primary input/output workspaces above secondary configuration options. Use side-by-side split views on desktop, collapsing to stacked panels on mobile/tablet.

## Editor Panels (`.editor-panel`)
- **Structure**: `1px solid var(--color-border)`, `16px` radius, `--color-surface` background. In dark mode, apply a subtle `1px` inset top highlight (`rgba(255,255,255,0.04)`) for crisp separation.
- **Header (`.panel-header`)**: Minimum `56px` height, `--color-surface-muted` background. Content title on the left; `.panel-actions` on the right (wrapping cleanly without overflow).
- **Body**: Must use `min-height: 0` and flex/grid growth to fill remaining space cleanly.
- **Drag-and-Drop State**: For tools supporting file drops (text, JSON, images, etc.), highlight the target panel with `border-color: var(--color-primary)` and a `var(--color-primary-soft)` overlay during `dragover`.
- **Fullscreen Mode**: Removes border-radius, locks to `100vw × 100vh` (`z-index` above shell), and exits via button or `Esc`.

## Controls & Keyboard Hints
- **Buttons**:
  - `.btn-primary`: Lavender fill (`--color-primary`), `#ffffff` text.
  - `.btn-secondary`: `--color-surface` fill, `1px solid var(--color-border)`, `--color-text`.
  - `.btn-danger`: `--color-danger-soft` fill, `--color-danger` text.
  - `.btn-fullscreen`: `--color-primary-soft` fill, `--color-primary-hover` (dark) / `--color-primary` (light) text.
  - **Sizing**: Standard buttons `min-height: 40px`, `8px` radius. Toolbar buttons (`.btn-small`) `min-height: 32px`, `6px` radius.
- **Inputs & Selects**: `--color-surface`, `1px solid var(--color-border)`, `8px` radius, `min-height: 38px` (`44px` on touch viewports). Focus ring: `2px solid var(--color-focus)` with `1px` offset.
- **Segmented Controls**: Use for mutually exclusive modes. Active segment must show clear contrast via surface step + border/weight, not color alone. Keep option labels single-line.
- **Keyboard Shortcuts (`<kbd>`)**: Style inline shortcut hints with `--font-mono`, `11px–12px`, `padding: 2px 6px`, `4px` radius, `--color-surface-raised` background, and `1px solid var(--color-border-strong)`.

# Feedback, Validation & Empty States

- **Non-Shifting Validation & Errors**: Never inject error banners above or below editors if doing so changes editor height. Either:
  1. Reserve a fixed-height (`28px`–`32px`) bottom panel status bar that displays metadata (line count, byte size, status) by default and swaps in-place to `--color-danger` text + recovery hint on error, **or**
  2. Render a dismissible/auto-updating overlay pill anchored inside the bottom edge of the editor viewport.
- **Toasts (`Toast`)**: Fixed position, zero layout shift, short action-confirmed copy (`"已复制"`, `"格式化成功"`, `"解析失败"`).
- **Empty States**: Use `--color-muted` text explaining what input is expected, paired with a `.btn-secondary.btn-small` action (e.g., `"填入示例"` or `"粘贴剪贴板"`) when helpful.

# Accessibility

- Every interactive control must have a visible `:focus-visible` outline and an accessible name (visible text, `aria-label`, or `title`).
- Never communicate state (valid/invalid/active) through color alone; pair with icons, borders, or text.
- Respect `@media (prefers-reduced-motion: reduce)` across all transitions, Dock magnification, and canvas animations.

# Implementation Checklist & Guardrails

## Required Architecture
Reuse these existing primitives before writing custom CSS:
`AppShell`, `ToolLayout`, `Toast`, `.editor-panel`, `.panel-header`, `.panel-actions`, `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-small`, `.btn-fullscreen`.

When adding a new tool:
1. Register metadata and icon in `src/tools/registry.tsx`.
2. Wrap the page in `ToolLayout`.
3. Build primary workflows with `.editor-panel` or flat `--color-surface` form panels (`12px`–`16px` radius).
4. Ensure flex/grid children hosting Monaco or scrollable code blocks set `min-height: 0` and `min-width: 0`.
5. Verify both Dark and Light themes, plus desktop (`1280px`) and mobile (`375px`) viewports.

## Strict Prohibitions (Don't)
- **DO NOT** nest cards/panels inside other bordered cards.
- **DO NOT** use heavy drop shadows as the primary depth mechanism; rely on surface steps and `1px` borders.
- **DO NOT** use large lavender background fills, decorative gradients, or custom per-tool color palettes.
- **DO NOT** allow validation errors, loading spinners, or toast messages to cause layout reflow/shift.
- **DO NOT** add marketing components (hero banners, feature grids, testimonials, pricing).
