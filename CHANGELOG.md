# Changelog

All notable changes to Colormap Studio are documented here.

## v1.2 — 2026-10-02

### Added
- Upload an existing colormap and improve it: choose "Upload colormap (image / CSV)…" in the preset list and load a horizontal colormap image (PNG, JPEG, BMP, …), a PPM, or a CSV of RGB (0–255 or 0–1) or L\*a\*b\* values. 15 colors are extracted from it with the same strict extraction as the presets and placed in the strip, ready for Optimize
- CSV column headers (R,G,B or L\*,a\*,b\*) are honored; without a header, negative values mean L\*a\*b\* and everything else is read as RGB

## v1.1 — 2026-10-02

### Changed
- The color strip now has 15 slots instead of 16. An odd count puts slot 7 exactly at the center color of a diverging colormap. The two required endpoints are now slots 0 and 14, and the strip fills the full width like the preview bar below it
- Presets are re-extracted from the reference 256-color maps with strict extraction (positions i·(w−1)/(n−1), linear interpolation), the same as the research code
- The score shown for the generated colormap, before and after generation, is now evaluated on the 256-color colormap sub-sampled at indices 0, 8, …, 248 plus the last point 255 (33 points) instead of on the representative colors. The formula, CVD types and weights are unchanged; the optimization objective itself is unchanged

### Removed
- The Leaf_NASA preset

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
