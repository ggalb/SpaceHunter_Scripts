# Space Hunter Scripts for PixInsight

A collection of PixInsight scripts for automated linear image processing of OSC camera images.
Copyright © 2026 Georg G Albrecht. MIT License.

---

## Versions

| PixInsight | Scripts |
|---|---|
| 1.9.6 and later | Part 1 v2.7.7, Part 2 v2.4.8, +Previews v2.2.3, NamePreviews v2.1.1, KillPreviews v2.0.2 |

Older packages (for PixInsight 1.9.5 and earlier) have been withdrawn. Script file names carry
no version number (e.g. `SH_LazyWorkflow_Part1_V8.js`); the version is shown in each script's
dialog. Saved settings are kept when you update.

What changed in each release: see [CHANGELOG.md](CHANGELOG.md).

---

## Prerequisites

- Windows operating system (Windows 11 recommended)
- PixInsight 1.9.6 or later
- PixInsight's MARS databases installed
- For images without coordinates or image scale in their FITS keywords: the Gaia astrometric
  index file (`gdr3-idx-1.0.0-g17.xpsd`), set in **Process → Astrometry → Gaia** preferences.
  ImageSolver's blind solver needs it.
- Recommended: the local Gaia DR3 star catalogue (XPSD files). Without it, PixInsight's
  ImageSolver downloads the stars it needs from an online catalogue.
- BlurXTerminator, StarXTerminator, NoiseXTerminator v1.1.2.2 or later (optional but recommended)
- StarNet2 (optional, alternative to StarXTerminator)
- MLDenoise (optional, alternative to NoiseXTerminator; for licensed PixInsight users)
- Internet connection (optional): for the dust-map check in Part 2, and for ImageSolver's online
  catalogue when the local Gaia catalogue isn't installed

The scripts start no external programs.

---

## Installation via PixInsight Update Repository

1. In PixInsight, go to **Resources → Updates → Manage Repositories**
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

The Lazy Workflow scripts are designed so you don't have to manually call and select several tools on the way to processing an OSC image — whether UV/IR filter images, Light Pollution filter images, or Dual-Narrowband (DNB) filter images — from a pre-cropped image, first to the background extraction (which shouldn't be left to a tool's predetermination without examination), and from there to a stretch-ready image.

> **Note:** If you are using two DNB filters collecting Ha/Oiii and Sii/Oiii(Hb) to be split into greyscale images for combining into Hubble palette images, this may not be the right script for you.

### SH Lazy Workflow Part 1
Plate solving with PixInsight's ImageSolver (blind solve when the image has no coordinates), optional Ha/OIII separation for dual-band OSC images, SpectrophotometricFluxCalibration (SPFC), variable previews (1–4), MultiscaleGradientCorrection with per-preview gradient scale selection, optional automatic scale factors and an instant background-model chooser, optional GradientCorrection with result chooser, and DynamicBackgroundExtraction (cDBE). Steps already applied to the image are skipped on a second run. New Instance support.

### SH Lazy Workflow Part 2
Continues from Part 1: BlurXTerminator (correct only), tiled background finder with a pre-check and optional dust map, SPCC with auto-detected ROI or AutoColor, Adaptive Auto STF (linked/unlinked chosen automatically), BlurXTerminator full with adjustable parameters, optional MultiscaleAdaptiveStretch preview copy, StarXTerminator or StarNet2, MLDenoise or NoiseXTerminator. Steps already applied to the image are skipped on a second run. New Instance support.

### Bonus Scripts

**SH KillPreviews** — Deletes all previews of the active image in one click.

**SH NamePreviews** — Renames drawn previews to Exclude1, Exclude2, etc., for use as (optional) background-finder exclusion zones.

**SH +Previews** — Creates 1–6 independent full-size previews of the active image. Useful for adding Background Model previews for MGC or GC, or simply creating full-size previews. Also supports custom-named previews. New Instance support.

---

## Documentation

Each Lazy Workflow script and +Previews has a manual in PixInsight's documentation format. It is installed with the scripts and opens from the documentation button in the script dialog. The manuals list every file the scripts write, every network connection they make, and every setting they store (section "Files, Programs and Internet Access").

---

## License

All scripts are released under the MIT License. Copyright © 2026 Georg G Albrecht. You are free to use, modify, and redistribute these scripts **with the exception of AutoColor.js by Hartmut V. Bornemann**, which requires separate written permission from the author for any reuse.

See the full [LICENSE](https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE) file for complete details.

---

## Acknowledgments

- [PixInsight](https://pixinsight.com/) by Pleiades Astrophoto S.L.
- ImageSolver by Andrés del Pozo and Juan Conejero (PTeam)
- Adaptive Auto STF based on PixInsight's AutoSTF method by Juan Conejero (Pleiades Astrophoto)
- Ha/OIII separation method from the PixInsight video "MultiscaleGradientCorrection — Dual-Band OSC Images (II)" — [youtube.com/watch?v=ZYP7niz2hKU](https://www.youtube.com/watch?v=ZYP7niz2hKU)
- Background finder concept inspired by FindBackground by Gerrit Erdt and Franklin Marek (SetiAstro)
- Dust map: [IRSA Galactic Dust Reddening and Extinction](https://irsa.ipac.caltech.edu/applications/DUST/) (NASA/IPAC), SFD map by Schlegel, Finkbeiner & Davis (1998)
- AutoColor.js by Hartmut V. Bornemann — used with written permission
- BlurXTerminator, StarXTerminator, NoiseXTerminator by Russell Croman — [rc-astro.com](https://www.rc-astro.com/)
- StarNet2 by Nikita Misiura — [starnetastro.com](https://www.starnetastro.com/)
- MLDenoise by Juan Conejero and Roberto Sartori (Pleiades Astrophoto)
- Developed with assistance from Claude AI (Anthropic)
