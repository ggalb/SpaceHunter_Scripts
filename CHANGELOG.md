# Changelog — Space Hunter Scripts for PixInsight

Newest release first. Each script's source file also has a detailed change log in its header.

---

## Next release (in preparation) — PixInsight 1.9.6+

**General:**

- Requires PixInsight 1.9.6. The packages for PixInsight 1.9.5 and earlier are withdrawn.
- No external programs: plate solving runs entirely in PixInsight (ImageSolver with its blind solver).
- Steps already applied to the image are skipped on a second run, following History Explorer; a warning appears only when every selected step is already applied.
- One step numbering in dialogs, console and manuals.
- Manuals: new screenshots for PixInsight 1.9.6; ImageSolver's online catalogue documented.

**Part 1 (v2.7.6):**

- Images without coordinates are solved by ImageSolver's blind solver (needs the Gaia astrometric index file).
- MGC scale factors: Standard, Automatic or Both (paired previews per scale).
- Background model chooser: stronger shared model stretch (display only); GC result chooser can show the gradient models.
- The MARS folder you pick is remembered; Reset Settings forgets it.
- Reset Defaults no longer changes the gradient scales (Reset Settings does).

**Part 2 (v2.4.7):**

- New optional MAS stretch preview: a MultiscaleAdaptiveStretch copy after BXT full, with the background measured in the Background preview.
- StarNet2 section for the current StarNet2: stride Large / Standard / Small and all six options.
- MLDenoise now runs before NoiseXTerminator; StarXTerminator and NoiseXTerminator are off by default.
- Dust-map check retries once; Abort stops it.
- Filter list also groups `_R/_G/_B` and `Red/Green/Blue` names (e.g. SvBony DNB).
- In narrowband mode the console shows the wavelengths instead of the unused filter.

**+Previews (v2.2.3), NamePreviews (v2.1.1), KillPreviews (v2.0.2):** unchanged.

---

## 25 October 2026 (V8, PixInsight 1.9.5+) — withdrawn

**General:**

- Menu icons moved to PixInsight's standard icon folder (`rsc/icons/script/`). The old icon files are removed by the update.
- Abort works for the whole run. A tool stopped with Abort counts as cancel (no more "ERROR: undefined").
- Settings are saved once, when you click OK.
- File dialogs no longer print a "deprecated" warning in the console.
- Manuals: new section "Files, Programs and Internet Access".

**Part 1 (v2.5.14):**

- RA/Dec header values read by keyword (OBJCTRA = hours, RA = degrees); the sign of decimal Dec is kept.
- Fixes to the external plate-solve helper of that time (removed in the next release).
- An aborted SPFC or MGC no longer falls back to GradientCorrection.
- Narrowband "Wavelength (nm)" header no longer cut off at high display scaling.

**Part 2 (v2.3.12):**

- Dust map download: https only, IRSA host only, no temp files left after a failed download.
- BXT, SXT and StarNet2 steps are marked done only when they actually ran.
- AutoColor leaves the image unchanged when a channel has no usable background or signal.
- Warning icons use PixInsight's own icon.
- Narrowband "Wavelength (nm)" header no longer cut off at high display scaling.

**+Previews (v2.2.3):** the space check ignores disabled fields; the console shows the name PixInsight actually gave.

**KillPreviews (v2.0.2):** reports previews that could not be deleted instead of looping.

**NamePreviews (v2.1.1):** script-id added (needed for code signing); no functional change.

---

## 13 October 2026 (V8, PixInsight 1.9.5+)

**General:**

- Requires PixInsight 1.9.5. Users on 1.9.4 kept the July 2026 package.
- Fixed script file names without version numbers. Old versioned files are removed by the update.
- Documentation buttons open the installed PixInsight manuals instead of the PDF.
- Legacy Part 1 (Legacy+ImageSolver), the PDF guide and the old toolbar icons are no longer included.
- Re-run protection: Part 1 and Part 2 warn when a step was already applied.

**Part 1 (v2.5.2):**

- Plate solving uses PixInsight's current ImageSolver engine automatically.
- Optional Ha/OIII separation for dual-band OSC images (narrowband mode), run before SPFC. Factors per camera/filter, stored in profile files. "PixelMath & exit" helps find the factors. Runs once per image.
- SPFC: gray filter and RGB filter set chosen in separate dropdowns.
- MGC: "Choose background model" window applies any preview's model instantly. Repeated scales are named `BM_1024`, `BM_1024_1`, `BM_1024_2`.
- GradientCorrection: runs on its own two previews, with a result chooser.

**Part 2 (v2.3.2):**

- New background finder: deterministic tiles, robust statistics and a target sky level instead of "darkest". It no longer lands in dark nebulae or on frame edges; Exclude previews are optional.
- Pre-check before processing: lists previews (warns about leftovers) and offers an optional IRSA dust-map check to steer the background away from IFN. The check gives up after 30 s if the service does not answer.
- **Fix:** SPCC now uses the Background preview for background neutralization. Earlier versions passed it under a wrong parameter name, so SPCC used the whole image.
- Adaptive Auto STF: linked after SPCC, unlinked otherwise; statistics from the Background preview.
- New: MLDenoise as an alternative to NoiseXTerminator. Opens MLDenoise with your model file (path stored in your own preferences).
- BXT Correct Only and BXT Full have their own ML Version and Tile Overlap.
- Ticking NXT or MLDenoise no longer expands its section.

**+Previews (v2.2.1):** New Instance support. Repeated names get `_1`, `_2`, … (was `_2`, `_3`, …).

**NamePreviews (v2.1):** re-running no longer produces names like `Exclude11`.

**KillPreviews (v2.0):** unchanged.

---

## v2.1 (V8) / v1.4 (Legacy) — July 2026

**Part 2 (V8 only):**

- RC-Astro v1.1.2.2 support: ML Version selection and Tile Overlap controls added to BlurXTerminator (Correct Only and Full) and StarXTerminator dialogs.
- NoiseXTerminator simplified — the script opens the NXT tool directly for manual configuration.
- Section title tooltips on BXT Correct Only, BXT Full and SXT.
- Per-step elapsed time in the console for Background Finder and Adaptive Auto STF.

**Part 1 (V8 and Legacy):**

- Per-step elapsed time in the console for SPFC, Create Previews, MGC and GC.
- Section title tooltips on GradientCorrection and DynamicBackgroundExtraction.

## v2.0 (V8) / v1.3 (Legacy) — June 2026

- Initial V8 engine port for PixInsight 1.9.4 (Lockhart).
- ES6 class inheritance, updated API calls, performance improvements.
- AutoColor sky-background computation up to 4x faster (V8).
- New Instance support for saving and restoring workflow parameters.
