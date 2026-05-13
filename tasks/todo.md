# Dataviz UI fix plan

## Review

- Added a shared dataviz shell with per-module framing so markdown, charts, and widgets no longer stack edge-to-edge.
- Tuned ECharts sizing to be more content-aware, reduced extra padding, and kept chart redraws synced with editor zoom.
- Reworked iframe widget sizing to re-measure on tab changes, expose a host resize hook, preserve scrollbar fallback, and forward Cmd/Ctrl zoom shortcuts back to the host.
- Removed iframe-side default scrollbars again, expanded overflow containers back to natural height, and added host-level spacing between stacked module blocks inside tab panels.

- Fixed zoom hotkeys so Cmd/Ctrl +/-/0 still work when focus stays inside AI chat inputs or iframe widgets; the AI workspace scale now updates in those focus states too.
