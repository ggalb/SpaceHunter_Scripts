# Space Hunter Scripts for PixInsight

A collection of PixInsight scripts for automated linear image processing of OSC camera images.
Copyright © 2026 Georg G Albrecht. MIT License.

---

## Prerequisites

- Windows operating system (Windows 11 recommended)
- PixInsight 1.9.3 or higher
- PixInsight's MARS databases installed
- ASTAP installed with D50 star maps
- BlurXTerminator, StarXTerminator, NoiseXTerminator (optional but recommended)
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
Continues from Part 1 — BlurXTerminator (correct only), Background finder with Exclusion Zones, SPCC with auto-detected ROI, AutoColor (alternative to Background Neutralization + SPCC), BlurXTerminator full with adjustable parameters, Adaptive Auto STF, StarXTerminator or StarNet2, NoiseXTerminator. New Instance support.

### Bonus Scripts

**SH KillPreviews** — Deletes all previews of the active image in one click.

**SH NamePreviews** — Renames drawn previews to Exclude1, Exclude2, etc. for use as FindDarkestBackground exclusion zones.

**SH +Previews** — Creates 1–6 independent full-size previews of the active image. Useful for adding Background Model previews for MGC or GC, or simply creating full-size previews. Also supports custom-named previews.

---

## Documentation

A detailed workflow guide is included: **SH_Workflow_Guide.pdf**

After installation, the PDF can be opened directly from within the Lazy Workflow scripts using the PDF button in the script toolbar. The PDF is interactive with linked titles to description and left/right borders returning user to front of paragraph or previous paragraph.

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
