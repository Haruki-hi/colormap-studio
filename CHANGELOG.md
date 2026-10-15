# Changelog

All notable changes to Colormap Studio are documented here.

## v1.3.1 — 2026-10-15

### Fixed
- Consistency: before anything is edited or generated, the score now shows the **original colormap's own** values (the "existing colormap" value of the research evaluator), so F̂ is exactly 0 and the heading reads "E · Consistency (original colormap)". Previously it scored the 15-color reconstruction of the original, which differs from the original (F̂ ≈ 1 for seis / ds9_a, ≈ 4 for Earth) — not a quantization effect. After a color is edited or a colormap is generated, the colormap being scored is the 15-color one, as before

## v1.3 — 2026-10-15

### Added
- **Consistency method.** A "Method" toggle at the top of the Generator selects between *Uniformity* (the existing method, which equalizes neighboring color differences) and *Consistency*, which keeps an existing colormap's own pattern of color differences (for example a deliberately larger step between sea and land) while making it hold up for CVD. The two measure different things, so both are available. Ported from the research code (`test_weight_consist.c`):
  - objective E = w_F·F + w_Q·Q + w_S·S, with F built from how consistently each CVD type sees the neighboring color differences, plus the drift from the original colormap's differences; initial weights 0.1 / 0.8
  - the 15 representative colors are taken at equal steps of color difference along the original 256-color colormap (so they are not evenly spaced) and the colormap is rebuilt from their positions — in the preview, the export and the Test page
  - it starts from an existing colormap, so there is no Custom in this method; at least one CVD type must be selected
  - the generated colormap is evaluated on the 256 colors at every 8th point plus the last (as for Uniformity), with F compared against the original colormap's color differences at the same points; shown as F′ = 100·F, FP′/FD′/FT′ = 100·σ, Q′, S′ and the mean ΔE shift F̂
- Reference colormaps for Consistency: ds9_a, ds9_b, Earth, Drywet, World and Seis (research maps) in addition to the standard presets; an uploaded colormap works in both methods
- The Tutorial (Japanese and English) has a new section comparing the two methods and explaining F, and the usage guide mentions the method choice
- The active method is shown by the toggle, a colored top edge on the control panel, the score heading and the Optimize button label; each method remembers its own weights

## v1.2 — 2026-10-02

### Added
- Upload an existing colormap and improve it: choose "Upload colormap (image / CSV)…" in the preset list and load a horizontal colormap image (PNG, JPEG, BMP, …), a PPM, or a CSV of RGB (0–255 or 0–1) or L\*a\*b\* values. 15 colors are extracted from it with the same strict extraction as the presets and placed in the strip, ready for Optimize
- CSV column headers (R,G,B or L\*,a\*,b\*) are honored; without a header, negative values mean L\*a\*b\* and everything else is read as RGB

### Changed
- The score breakdown is shown as U′ = 100·U and Q′, S′ = 1000·Q, 1000·S with one decimal place, so the values are easier to read and compare. The total E is unchanged

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
