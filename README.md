# Space Hunter Scripts for PixInsight

A collection of PixInsight scripts for automated linear image processing of OSC camera images.
Copyright © 2026 Georg G Albrecht. MIT License.

---

## Versions

This repository provides two versions of the Space Hunter scripts:

- **v2.1 (V8)** — For PixInsight 1.9.4 (Lockhart) and later. Ported to the V8 JavaScript engine with ES6 class inheritance, updated API calls, and significant performance improvements (AutoColor sky-background computation is up to 4x faster). Note: ImageSolver auto-include is temporarily disabled as ImageSolver.js is not yet V8-compatible — plate-solve manually via Script > Image Analysis > ImageSolver before running Part 1.
- **v1.4 (Legacy)** — For PixInsight 1.8.0 through 1.9.3. Uses the original SpiderMonkey JavaScript engine.

The update repository automatically delivers the correct version for your PixInsight installation.

**ImageSolver workaround for 1.9.4 users:** PixInsight 1.9.4 still supports legacy SpiderMonkey scripts alongside V8. Until ImageSolver.js is updated for V8, a legacy Part 1 v1.4 is included in the V8 package and appears in the menu as **SH Lazy Workflow Part 1 (Legacy+ImageSolver)**. It includes ImageSolver and works fully on 1.9.4.

---

## Prerequisites

- Windows operating system (Windows 11 recommended)
- PixInsight 1.9.4 or higher (for V8 v2.1) or PixInsight 1.8.0–1.9.3 (for legacy v1.4)
- PixInsight's MARS databases installed
- ASTAP installed with D50 star maps
- BlurXTerminator, StarXTerminator, NoiseXTerminator v1.1.2.2 or later (optional but recommended)
- StarNet2 (optional, alternative to StarXTerminator)
- AutoColor (optional, alternative to SPCC)

---

## Installation via PixInsight Update Repository

1. In PixInsight, go to **Resources → Manage Repositories**
2. Click **Add** and enter the following URL exactly as shown, including the trailing `/`:
   ```
   https://raw.githubusercontent.com/ggalb/SpaceHunter_Scripts/main/
   ```
3. Click **OK**
4. Go to **Resources → Updates → Check for Updates**
5. Follow the prompts to download and install
6. Restart PixInsight when asked

The scripts will appear under **Script → Space_Hunter** in the menu.

---

## What the Scripts Do

The Lazy Workflow scripts are designed so you don't have to manually call and select several tools on the way to processing an OSC image — whether UV/IR filter images, Light Pollution filter images, or single Dual-Narrowband (DNB) filter images — from a pre-cropped image, first to the background extraction (which shouldn't be left to a tool's predetermination without examination), and from there to a stretch-ready image.

> **Note:** If you are using two DNB filters collecting Ha/Oiii and Sii/Oiii(Hb) to be split into greyscale images for combining into Hubble palette images, this may not be the right script for you.

### SH Lazy Workflow Part 1
Automated linear processing — smart plate solving (ASTAP, only runs if needed), ImageSolver, SpectroPhotometricFluxCalibration (SPFC), variable previews (1–4), MultiscaleGradientCorrection with per-preview gradient scale selection, optional GradientCorrection and DynamicBackgroundExtraction (cDBE). New Instance support.

### SH Lazy Workflow Part 2
Continues from Part 1 — BlurXTerminator (correct only), Background finder with Exclusion Zones, SPCC with auto-detected ROI, AutoColor (alternative to Background Neutralization + SPCC), BlurXTerminator full with adjustable parameters, Adaptive Auto STF, StarXTerminator or StarNet2, NoiseXTerminator. Supports RC-Astro v1.1.2.2 ML Version selection and Tile Overlap controls for BXT and SXT. Per-step timing in console output. New Instance support.

### Bonus Scripts

**SH KillPreviews** — Deletes all previews of the active image in one click.

**SH NamePreviews** — Renames drawn previews to Exclude1, Exclude2, etc. for use as FindDarkestBackground exclusion zones.

**SH +Previews** — Creates 1–6 independent full-size previews of the active image. Useful for adding Background Model previews for MGC or GC, or simply creating full-size previews. Also supports custom-named previews.

---

## Documentation

A detailed workflow guide is included: **SH_Workflow_Guide.pdf**

After installation, the PDF can be opened directly from within the Lazy Workflow scripts using the PDF button in the script toolbar. The PDF is interactive with linked titles to description and left/right borders returning user to front of paragraph or previous paragraph.

---

## Changelog

### v2.1 (V8) / v1.4 (Legacy) — July 2026

**Part 2 (V8 only):**

- RC-Astro v1.1.2.2 support: ML Version selection and Tile Overlap controls added to BlurXTerminator (Correct Only and Full) and StarXTerminator dialogs. Both BXT sections share settings with bidirectional sync.
- NoiseXTerminator simplified — UI controls removed; the script now opens the NXT tool directly for manual configuration.
- Section title tooltips added to BXT Correct Only, BXT Full, and SXT sections, reminding users to configure Download ML Models, Compute Device, and Find Fastest in the original tools first.
- Per-step elapsed time added to console output for Background Finder (Step 3) and Adaptive Auto STF (Step 5).
- UI alignment improvements for AutoPSF, SXT checkboxes, and StarNet2 checkboxes.

**Part 1 (V8 and Legacy):**

- Per-step elapsed time added to console output for SPFC (Step 1), Create Previews (Step 2), MGC (Step 3), and GC (Step 4).
- Section title tooltip on GradientCorrection: "Runs 2 pre-set gradient extraction values on Preview GC and Preview GC1."
- Section title tooltip on DynamicBackgroundExtraction: "Opens DynamicBackgroundExtraction with pre-set values."

### v2.0 (V8) / v1.3 (Legacy) — June 2026

- Initial V8 engine port for PixInsight 1.9.4 (Lockhart).
- ES6 class inheritance, updated API calls, performance improvements.
- AutoColor sky-background computation up to 4x faster (V8).
- New Instance support for saving and restoring workflow parameters.

---

## License

All scripts are released under the MIT License. Copyright © 2026 Georg G Albrecht. You are free to use, modify, and redistribute these scripts **with the exception of AutoColor.js by Hartmut V. Bornemann**, which requires separate written permission from the author for any reuse.

See the full [LICENSE](https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE) file for complete details.

---

## Acknowledgments

- [PixInsight](https://pixinsight.com/) by Pleiades Astrophoto S.L.
- ASTAP by Han Kleijn — [hnsky.org](https://www.hnsky.org/astap.htm) (Mozilla Public License 2.0)
- AutoColor.js by Hartmut V. Bornemann — used with written permission
- BlurXTerminator, StarXTerminator, NoiseXTerminator by Russell Croman — [rc-astro.com](https://www.rc-astro.com/)
- StarNet2 by Nikita Misiura — [starnetastro.com](https://www.starnetastro.com/)
- Developed with assistance from Claude AI (Anthropic)
