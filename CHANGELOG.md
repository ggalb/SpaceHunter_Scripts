# Changelog — Space Hunter Scripts for PixInsight

Newest release first. Each script's source file also has a detailed change log in its header.

---

## 18 November 2026 (V8, PixInsight 1.9.6, code-signed)

**Part 1 (v2.7.32):**

- Applying a background model or GC result no longer writes FITS HISTORY lines. Which model was applied is recorded in the image property SpaceHunter:GradientModel, replaced on every Apply. On old stacks with long FITS headers, writing the keywords took minutes (136 s with 1100 HISTORY lines), and the lines piled up after History Explorer resets. SH: lines from older versions stay in the image.

**Part 2 (v2.4.27):**

- MAS preview no longer copies the image's FITS keywords to its window (same slowdown on long headers).

**New: SH Lazy Workflow Master (v1.0.0):**

- Runs Part 1 and Part 2 as one workflow: both dialogs at the start, Part 2 continues by itself after Apply in Part 1's model / GC panel.
- Start dialog with what is already done to the image (re-run marks, History Explorer) and the choice Part 1 + Part 2 / Part 1 only / Part 2 only.
- Stops before Part 2 when ImageSolver needs you, when DBE is opened, or when the panel is closed without Apply; the next run continues where it stopped. The console says how the run ended (finished, stopped, cancelled) and how to go on.
- Contains Part 1 and Part 2 unchanged; own manual (documentation button) and menu icon. No external programs.

**General:**

- LICENSE: MARS file locations described as in the code (MGC preferences, PixInsight's library and settings folders, a folder you pick); Master section added.

---

## 11 November 2026 (V8, PixInsight 1.9.6, code-signed)

**General:**

- Compliance with the Certified PixInsight Developer Program (CPDP) Rules, version 1.0.2.
- All scripts are code-signed by a Certified PixInsight Developer (GeorgAlbrecht-SpaceHunter).
- This package is for PixInsight 1.9.6. Part 1's signature depends on PixInsight's ImageSolver, so each new PixInsight version gets its own package.
- Windows, macOS and Linux: no fixed Windows paths. SPCC's filter and white reference files come from PixInsight's library folder; if one is missing, the script asks for it once and remembers it.
- Filter lists: the library filter file wins, as in SPCC; your own filter file only adds filters the library lacks.
- Re-run check: steps are no longer wrongly skipped or repeated after History Explorer jumps, after going back to <Initial State>, or in reopened files.
- Risky questions ("already applied", "replace profile?") default to No; closing the box with X counts as No.
- LICENSE: ASTAP text replaced (no external programs); AutoColor permission history added.
- Manuals updated: filter warnings, corrected-image view, the SpaceHunter:SPFCMode property and the session marks.

**Part 1 (v2.7.31):**

- Warning on OK when SPFC and MGC filters don't match (narrowband vs. broadband). If you run anyway, MGC uses scale factor 1.0 instead of automatic factors.
- Note on OK for a dual-band SPFC set with narrowband MGC (it runs, but results differ from narrowband filter mode).
- Dual-band sets are found by their red curve (15 nm or less); tri-/quad-band and UHC-S sets count as broadband.
- Automatic MGC scale factors rejected by MGC no longer stop MGC: Both mode skips only that preview, Auto mode uses 1.0. A preview run with 1.0 loses its _autoSF suffix.
- Model panel: "Show corrected image" shows the image corrected with the selected model, with one stretch for all models.
- MARS files: from MGC's preferences, the folder you picked and PixInsight's library and settings folders.
- SPFC stores its filter mode on the image (SpaceHunter:SPFCMode) so Part 2 can check SPCC against it.
- Blind solve stays on (greyed out) while SPFC is on.
- The plate-solve check reads the same metadata as ImageSolver (also PIXSIZE and XISF properties).
- GC result panel shows the model GC actually made for each preview.
- SH: HISTORY lines of an undone gradient correction are replaced, not stacked.
- Help texts name both Gaia index files (g17 and g19).

**Part 2 (v2.4.26):**

- Warning when SPCC's filter mode doesn't match the one SPFC used in Part 1 (narrowband, dual-band or broadband; narrowband wavelengths are compared too).
- AutoColor: Hartmut V. Bornemann's original header and comments restored; progress shown for each channel.
- Filter sets named " Red/Green/Blue" are listed as "X (Red/Green/Blue)", as in Part 1; saved selections are found again.
- Background finder is no longer repeated on images without history.

**+Previews (v2.2.7), NamePreviews (v2.1.1), KillPreviews (v2.0.2):** unchanged, now code-signed.

---

## 3 November 2026, second update (V8, PixInsight 1.9.6+)

**Part 1 (v2.7.11):** GC model windows: the display stretch is now called Auto Display Stretch (PixInsight's ScreenTransferFunction with the AutoSTF method).

**Part 2 (v2.4.13):**

- Step 5 renamed Auto Display Stretch (linked/unlinked). Dialog, console and manual say that it sets PixInsight's ScreenTransferFunction with the AutoSTF method by Juan Conejero; the script adds the automatic linked/unlinked choice and the sky statistics from the Background preview.
- Dust map: the downloaded file's header and every map value are checked before use; a damaged map is not used.

---

## 3 November 2026 (V8, PixInsight 1.9.6+)

**General:**

- Requires PixInsight 1.9.6. The packages for PixInsight 1.9.5 and earlier are withdrawn.
- No external programs: plate solving runs entirely in PixInsight (ImageSolver with its blind solver).
- Steps already applied to the image are skipped on a second run, following History Explorer; a warning appears only when every selected step is already applied.
- One step numbering in dialogs, console and manuals.
- Space Hunter banner (bold, double strokes, orange to pale blue) in the console at the start of Part 1, Part 2 and +Previews.
- Manuals: new screenshots for PixInsight 1.9.6; ImageSolver's online catalogue documented.
- Manuals: "Files, Programs and Internet Access" lists the re-run marks, the FITS HISTORY lines, deleted previews, ImageSolver's own settings and star lists, and the third-party tools.
- Process icons no longer store folder or file paths from your computer.
- Damaged or out-of-range saved settings (for example in an edited process icon) fall back to their defaults.

**Part 1 (v2.7.10):**

- Images without coordinates are solved by ImageSolver's blind solver (needs the Gaia astrometric index file).
- MGC scale factors: Standard, Automatic or Both (paired previews per scale).
- Background model chooser: stronger shared model stretch (display only); GC result chooser can show the gradient models.
- The MARS folder you pick is remembered; Reset Settings forgets it.
- Reset Defaults no longer changes the gradient scales (Reset Settings does).
- Reset Settings keeps the workflow steps and the profile folder, also when you click Cancel afterwards.
- Save profile asks before replacing an existing profile file.

**Part 2 (v2.4.12):**

- New optional MAS stretch preview: a MultiscaleAdaptiveStretch copy after BXT full, with the background measured in the Background preview.
- StarNet2 section for the current StarNet2: stride Large / Standard / Small and all six options.
- MLDenoise now runs before NoiseXTerminator; StarXTerminator and NoiseXTerminator are off by default.
- Dust-map check retries once after a connection failure (not when the service answers with an error such as HTTP 504); Abort stops it. Its temporary files are removed in every case.
- Re-run check: MLDenoise, NoiseXTerminator and the MAS preview count as new work, so ticking one of them after the earlier steps are applied skips those steps instead of warning. MLDenoise / NoiseXTerminator count as applied while they are in the image's active history.
- The star image renamed to `stars` is always the one SXT or StarNet2 just created (an older one left open was renamed before).
- Reset Settings keeps the MLDenoise model path.
- Filter list also groups `_R/_G/_B` and `Red/Green/Blue` names (e.g. SvBony DNB).
- In narrowband mode the console shows the wavelengths instead of the unused filter.

**+Previews (v2.2.7):** Space Hunter banner and title frame in the console.

**NamePreviews (v2.1.1), KillPreviews (v2.0.2):** unchanged.

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
