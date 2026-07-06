# Daily AI Insight Engine — Design System
> intelligence terminal for yesterday's AI signal

**Theme:** dark-first, system-aware

Daily AI Insight Engine is designed as an intelligence terminal rather than a marketing site. The interface should feel like a compact operations desk for reading yesterday's AI market signal: quiet, precise, dense, and inspectable. The visual language borrows from macOS terminal windows, observatory dashboards, and financial news terminals, but keeps a softer consumer-grade finish so the product remains readable during a live interview demo.

The signature style is a **glass terminal ledger**: thin borders, small traffic-light dots, tabular numbers, compact charts, and scrollable evidence feeds. The product should never look like a generic AI landing page. It should look like a working daily briefing system that has already collected, scored, and assembled the report.

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Deep Console | `#0b0b0d` | `--page-bg` | Main dark canvas, the outer working environment |
| Console Black | `#050506` | `--page-bg-deep` | Deepest edge and background depth |
| Terminal Panel | `#1b1b1f` | `--terminal-panel` | Primary card surface |
| Terminal Ink | `#f5f5f7` | `--terminal-text` | Primary text and key numbers |
| Muted Graphite | `#9b9ba1` | `--terminal-muted` | Body text, secondary labels |
| Dim Steel | `#62626a` | `--terminal-dim` | Footer, timestamps, tertiary metadata |
| Signal Blue | `#64d2ff` | `--terminal-blue` | Primary action, links, active control state |
| System Green | `#30d158` | `--terminal-green` | Valid state and completed pipeline signal |
| Alert Red | `#ff453a` | `--terminal-red` | Errors and destructive state |
| Amber Pulse | `#ff9f0a` | `--terminal-orange` | Warning, pending, or market-volatility accent |
| Violet Trace | `#bf5af2` | `--terminal-purple` | Secondary chart/accent trace |

## Tokens — Typography

### System Sans + System Mono

The project uses native system fonts to match the product metaphor: this is a live intelligence tool, not a decorative editorial page. Typography must be compact, stable, and resistant to overflow. Numbers use tabular metrics everywhere so timestamps, scores, and counts do not shift.

- **Sans:** `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Helvetica Neue`, `Arial`, `sans-serif`
- **Mono:** `SFMono-Regular`, `ui-monospace`, `Menlo`, `Monaco`, `Consolas`, `Liberation Mono`, `Courier New`
- **Number behavior:** tabular numbers
- **Letter spacing:** `0` for body text; small uppercase labels may use `0.08em-0.12em`

### Type Scale

| Role | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| Micro label | 9-10px | 750-900 | 1.2 | terminal labels, tags, metadata |
| Body compact | 11.5-13px | 500-680 | 1.35-1.55 | feed summaries and panel body text |
| Card title | 15-18px | 760-900 | 1.1-1.35 | feed item titles and metric values |
| Hero title | 23-33px | 760 | 0.98 | top command title only |

## Tokens — Spacing & Shapes

**Base unit:** 4px

**Density:** compact but not cramped. The product is an analyst workspace; it should reveal many signals without looking messy.

| Name | Value | Token |
|------|-------|-------|
| 4 | 4px | micro alignment |
| 8 | 8px | core gap and radius |
| 10 | 10px | shell padding |
| 14 | 14px | card body compact padding |
| 18 | 18px | metric/feed padding |
| 24 | 24px | large internal rhythm |

### Radius

All visible UI uses a consistent **8px radius** unless the element is a semantic pill. Cards, charts, feed rows, and terminal panels must not drift into mixed radius values.

| Element | Value |
|---------|-------|
| Cards | 8px |
| Chart frames | 8px |
| Buttons | 8px |
| Status pills | 999px |
| Terminal dots | 999px |

## Components

### Terminal Card
**Role:** Main structural container.

Terminal cards use a thin border, subtle titlebar, and three traffic-light dots. A card should feel like a working terminal window, not a marketing card. The titlebar must remain compact; all content overflow should be handled inside the body, never by letting text escape the card.

### Command Card
**Role:** First-screen control surface.

Contains the product name, current controls, local clock, theme/language toggles, and report actions. Copy must describe the product outcome, not implementation details. Avoid mentioning framework names in the visible product pitch.

### Run State Metrics
**Role:** Operational readiness summary.

Each metric tile has a left-aligned label and value, plus a right-aligned status pill. The pill must have real right padding and must never be clipped by the card edge. Labels are concise:

- Updated / 更新
- Sources / 来源
- Items / 条目

### AI Feed
**Role:** Evidence stream.

The feed is the main right-side reading surface. It must be ordered by publication time descending. Scores should vary and should not visually imply fake certainty. Feed cards may scroll inside the panel; the page itself should remain one-screen on desktop.

### Theme Control
**Role:** System, dark, light selection.

Theme is a single-choice segmented control. The default mode is **System**. Only the selected mode icon may be active; the resolved visual theme must not cause a second icon to appear selected.

### Pipeline Strip
**Role:** System architecture signal.

Pipeline should show the actual process at a glance:

Raw News -> LLM Extraction -> Schema Validation -> Trend Aggregation -> Report -> PDF

It should be visible but not dominate the screen. The purpose is to demonstrate system thinking without turning the product into a documentation page.

## Do's and Don'ts

### Do

- Keep the whole desktop experience one-screen with internal scrolling regions.
- Use compact terminal typography and tabular numbers.
- Preserve the traffic-light terminal motif consistently.
- Make status text fit inside its own pill with explicit padding.
- Keep theme controls mutually exclusive.
- Sort information feeds by publish time, newest first.
- Use score variation; avoid everything looking like 100/100.
- Keep visible product copy outcome-focused.

### Don't

- Do not expose implementation details such as framework names in the hero copy.
- Do not let text clip against card edges.
- Do not use oversized marketing hero sections.
- Do not mix rounded-card radii across the dashboard.
- Do not let resolved system theme visually select both System and Dark/Light.
- Do not let chart or feed content resize the overall page.
- Do not use decorative blobs, stock illustrations, or ornamental gradients.

## Surfaces

| Level | Name | Purpose |
|-------|------|---------|
| 0 | Page Shell | Full viewport working surface |
| 1 | Terminal Card | Main bounded analysis panels |
| 2 | Feed/Metric Tile | Repeated evidence and status rows |
| 3 | Status Pill | Compact semantic state text |
| 4 | Action Button | Explicit report/download/source commands |

## Motion

Motion should be quiet and functional:

- Use short opacity/translate transitions for panel entrance.
- Use hover transitions on buttons and feed rows.
- Avoid large page transitions that make the dashboard feel like a landing page.
- Keep chart motion subtle enough that labels remain readable.

## Layout

Desktop layout is a two-column terminal workspace:

- Left: pipeline and visual analysis.
- Right: run state and AI feed.
- Header: command card with controls and report actions.
- Footer: copyright and contact.

Mobile layout stacks panels vertically and allows page scrolling. Desktop should remain a complete single-screen dashboard with internal feed scrolling.

## Accessibility

- Controls use real buttons and `aria-pressed` for selected state.
- Theme control behaves like a single-choice group.
- Text must not rely on color alone for state.
- Every external source opens with a visible text label and icon.
- PDF/report actions must surface backend error details instead of generic failure text.

## Agent Prompt Guide

When modifying the UI, preserve the **glass terminal ledger** identity:

1. Use a dark-first terminal card system with 8px radius.
2. Keep copy short and outcome-focused.
3. Prefer stable dimensions over content-driven resizing.
4. Treat the AI Feed as the evidence stream and Run State as the operating status.
5. Fix overflow by designing real containers, not by hiding important text.
