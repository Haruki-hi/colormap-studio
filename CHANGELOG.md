# Changelog

All notable changes to Colormap Studio are documented here.

## v1.0 — 2026-09-13

Initial public release.

### Features
- Interactive colormap generator with 16-slot color strip, editable in CIE L\*a\*b\* / RGB
- Simulated annealing optimizer that automatically fills in unspecified slots while keeping manually chosen colors close to their original position
- Color Vision Deficiency (CVD) simulation and optimization for Protan (P), Deutan (D), and Tritan (T) types
- Preset colormaps (Viridis, Plasma, Turbo, Jet, RdYlGn, Spectral, RdGn, Leaf_NASA) plus a Custom mode
- Test page with a gallery of procedural patterns, sample datasets, and real images to preview a colormap under normal and CVD-simulated vision
- Bilingual (Japanese / English) in-app tutorial covering colormap theory, CVD, the optimization objective, and a step-by-step usage guide
- Export to JSON, CSV, and PNG

### Fixes and refinements folded into this release
- Fixed the Test tab gallery being empty due to a circular module dependency
- Fixed the optimizer stalling from a parameter name mismatch
- Converted all-caps UI labels to sentence case; renamed "Control Points" to "Candidates of specified colors"
- Renamed the Q score term from "Quality" to "CVD contrast" to match what it actually measures
- Replaced the plain-text objective function with a typeset formula (E = w_u U + w_q Q + w_s S)
- Custom preset now resets to just the two endpoint colors (red/blue) instead of leaving stale colors behind
- Removed the Lenna test image (copyright) and added public-domain sample images instead
- Removed the unsupported claim that NASA/Nature/Science discourage the Jet colormap
- Removed Analytic Mode from both the Test page and the tutorial
- Fixed the color picker panel not closing after clicking "Apply"
- Rewrote the tutorial's "How to Use" guide in plainer language, explaining what actually happens at each step
- Raised the minimum font size app-wide for readability
- Fixed a canvas sizing bug that made the colormap preview bar a different height from the CVD simulation preview bars
- Fixed misaligned title/badge/image edges in the tutorial's Jet vs Viridis comparison
