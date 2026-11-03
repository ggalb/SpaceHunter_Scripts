#engine v8

#feature-id SHLazyWorkflowPart1 : Space_Hunter > SH Lazy Workflow Part 1
#feature-icon  @script_icons_dir/SH_WorkFlow1.svg
#feature-info Space Hunter Lazy Workflow Part 1 v2.7.11<br/>\
   <br/>\
   Automated Linear Image Processing workflow for OSC camera images.<br/>\
   <br/>\
   Includes: Equipment selection with collapsible sections,<br/>\
   ImageSolver with blind solve, optional Ha/OIII separation for dual-band images, SPFC,<br/>\
   variable previews (1-4), MultiscaleGradientCorrection with<br/>\
   per-preview gradient scale selection, optional automatic scale factors<br/>\
   and instant background model apply.<br/>\
   Optional GC and cDBE, New Instance support.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   See LICENSE file for details: https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE.

// ============================================================
// Space Hunter Lazy Workflow Part 1 v2.7.11
//
// Copyright (c) 2026 Georg G Albrecht. MIT License.
// See LICENSE file for details.
//
// Acknowledgments:
// - PixInsight platform by Pleiades Astrophoto (https://pixinsight.com/)
// - ImageSolver (incl. its blind solver) by (C) 2013-2026 Andrés del Pozo / (C) 2019-2026 Juan Conejero (PTeam)
// - Standard PixInsight processes called: SPFC, MultiscaleGradientCorrection, GradientCorrection, DynamicBackgroundExtraction,
//   PixelMath, ScreenTransferFunction
// - Ha/OIII separation method from PixInsight's "MGC - Dual-Band OSC Images (II)" video tutorial
// - Developed with assistance from Claude AI (Anthropic)
//
// Steps (same numbers in the dialog, the console and the manual; a letter
// marks a sub-step of the same tool: a = before it, b = after it):
// Step 0: Process & Equipment selection dialog (SectionBar UI)
// Step 1: Smart Plate Solve - ImageSolver (blind solve only if needed)
// Step 2a: Ha/OIII separation (optional, dual-band OSC, narrowband mode only)
// Step 2b: SPFC
// Step 3: Creates 1-4 Previews in full size (user selectable)
// Step 4: MGC with per-preview gradient scale selection
// Step 4b: Choose background model - apply any preview's MGC model instantly
// Step 5: GradientCorrection (MGC fallback or manual, previews GC_ / GC_1)
// Step 5b: Choose GC result - apply GC_ or GC_1, or open GC with its settings
// Step 6: cDBE - DynamicBackgroundExtraction
//
// v2.4: SPFC gray filter and RGB filter set chosen in separate dropdowns
//       (PAN/L entries no longer mixed into the RGB list; filters saved by
//       name). GC fallback always runs on its own 2 previews, model windows
//       follow GC's own model numbering (GC_ <-> GC_gradient_model,
//       GC_1 <-> GC_gradient_model1, ...), and a chooser panel like MGC's.
// v2.5: Optional Ha/OIII separation for dual-band OSC images (narrowband
//       mode only), run before SPFC: G and B minus k * (R - med(R)) with
//       user factors per camera/filter. Marked SpaceHunter:SeparationDone
//       so a re-run never subtracts twice. Button opens PixelMath preset
//       with the same expressions for finding the factors on a preview.
// v2.5.1: Documentation button opens the PixInsight manual
//       (Dialog.browseScriptDocumentation, ID-form #feature-id "SHLazyWorkflowPart1")
//       instead of SH_Workflow_Guide.pdf.
// v2.5.2: Documentation button passes the menu name "SH Lazy Workflow Part 1"
//       (PI looks up doc/scripts/SH Lazy Workflow Part 1/SH Lazy Workflow Part 1.html).
// v2.5.3 - v2.5.13: Fixes to the external plate-solve helper of that time
//       (removed in v2.6.0), RA/Dec keyword parsing (OBJCTRA = hours, RA =
//       degrees, sign of Dec kept), Abort handling for the whole run (an
//       aborted PI process counts as cancel), settings saved once on OK,
//       white reference saved by name, narrowband header width, menu icon
//       from the standard icon folder, .filePath in file dialogs.
// v2.5.14: Header text only: Part 7 (cDBE) moved back into the Part list,
//       Ha/OIII separation listed as a step, PixelMath/STF credited,
//       requirement PixInsight 1.9.5 (matches ensureMinimumVersion).
// v2.6.0: ASTAP removed (CPD rule 5.8: no external programs). Images without
//       RA/Dec or image scale are solved by ImageSolver's own blind solver
//       (ImageSolver 6.6.0, PixInsight 1.9.6), which needs the astrometric
//       index file set in the Gaia process preferences. The ImageSolve
//       section shows whether an index is set; 'Blind solve (if needed)'
//       replaces the ASTAP checkbox. Requires PixInsight 1.9.6.
// v2.6.1: GC and DBE sections start collapsed again (the start-up toggle
//       could expand them instead). Opening or closing one is remembered
//       for the next run; Reset Defaults collapses both.
// v2.6.2: MARS files are listed once in the console (C:/Astro and C:/ASTRO
//       are the same folder on Windows; the file list itself was already
//       de-duplicated). Test: arrow cursor on the model / GC result panels.
// v2.6.3: Panel cursor test removed again - PixInsight shows its busy
//       cursor while any script runs, a panel cannot override it.
// v2.7.0: MGC scale factors Standard (1.0) / Automatic / Both (MGC
//       1.9.6 autoScaleFactors). Both = paired previews BM_<scale> and
//       BM_<scale>_autoSF, auto run first per scale (MARS work is cached
//       across scales, test 2026-11-01). Factors + correlation shown in the
//       console, the model panel (low correlation flagged) and HISTORY.
//       The factors don't depend on the gradient scale (MGC derives them at
//       its own 256/1024 analysis scales), so the panel shows them once in
//       its header when all automatic models agree.
// v2.7.1: Model panel checkbox "Stronger model stretch (same for all
//       models)": one shared AutoSTF-style stretch over all models, set on
//       every preview (display only); off restores the image's STF.
// v2.7.2: Re-run checks survive History Explorer jumps: solution from the
//       window (not its properties), SPFC from its position in the active
//       history, marks store their history position. MGC failure shows the
//       real error instead of "likely no MARS reference data".
// v2.7.3: Add scale lists and tabs the new models in the main run's order
//       (1.0, then _autoSF); the automatic one still runs first.
// v2.7.4: GC result panel: "Show gradient models (same stretch for all)" -
//       clicking a result shows its GC_gradient_model window, all models
//       with one shared stretch (display only, Apply unchanged).
// v2.7.5: One step numbering in the header, console and manual (Step 1
//       solve, 2a Ha/OIII separation, 2b SPFC, 3 Previews, 4 MGC, 4b model
//       chooser, 5 GC, 5b GC chooser, 6 DBE). Text only.
// v2.7.6: Review fixes. The MARS folder picked by the user is remembered
//       and scanned first (it was asked again on every run); Reset Settings
//       forgets it. Reset Defaults no longer resets the gradient scales
//       (Reset Settings does, as tooltip and manual say). Abort in the
//       model/GC panels restores the normal display stretch. GC previews
//       are logged as step 5. Unused leftovers removed (SCRIPT_DIR,
//       STAR_CSV_FILE, DATE-OBS/EQUINOX reading); the old plate-solve
//       helper's path setting is removed from PI's settings.
// v2.7.7: Security review fixes. The separation-profile folder is no
//       longer stored in process icons (a path on this computer). Values
//       from saved settings or an icon are checked: wrong type or outside
//       the dialog's range -> default (e.g. 0 MGC previews). Save profile
//       asks before replacing a file when .txt was added to the name.
//       Reset Settings saves the dialog's state at once, so workflow steps
//       and profile folder are kept even after Cancel.
// v2.7.8: Space Hunter banner (orange to pale blue) in the console.
// v2.7.9: Banner bold, darker orange.
// v2.7.10: Banner strokes as double lines.
// v2.7.11: GC model windows: "Auto Display Stretch" (PixInsight STF with the
//       AutoSTF method) instead of "Auto Display Stretch".
// ============================================================
//
// THIS SCRIPT IS FOR OSC CAMERA IMAGES ONLY
//
// Requirements:
// - Windows machine
// - PixInsight 1.9.6 or later
// - MARS database installed
// - Gaia DR3 database; for images without RA/Dec or image scale also the
//   astrometric index file (gdr3-idx), set in the Gaia process preferences
// - OSC Camera Image
// - Image pre-cropped

// The auto-solve path drives PixInsight's modern ImageSolver engine, which
// writes the standard "AstrometricSolution:*" property namespace (1.9.5+);
// its blind solver (BlindSolverMode) arrived with ImageSolver 6.6.0 in
// PixInsight 1.9.6. Require 1.9.6.
CoreApplication.ensureMinimumVersion( 1, 9, 6 );

// ============================================================
// ImageSolver engine (V8-native, portable) for auto plate-solve
// ------------------------------------------------------------
// We drive PixInsight's CURRENT ImageSolver engine (v6.6.0) as a library,
// using the SAME method the official WeightedBatchPreprocessing (WBPP) /
// FastBatchPreprocessing scripts use in BatchPreprocessing/BPP-Solver.js.
//
// We do NOT use the old AdP/ImageSolver.js: it is deprecated ("DO NOT USE IN
// NEWLY PRODUCED CODE"), has no #engine directive (so it only parses under
// the legacy engine), and #include'ing it into this #engine v8 script fails
// at parse time (duplicate `let toolTip` in ImageSolverDialog, which V8
// rejects but the legacy engine tolerated).
//
// The modern launcher src/scripts/ImageSolver/ImageSolver.js has a
// USE_SOLVER_LIBRARY guard: defining it suppresses the launcher's own main()
// and dialog, and the launcher then pulls in all its dependencies itself
// (the <pjsr/astrometry/*> library via the portable include path, plus its
// engine/dialog). So this single relative include is all that is needed, it
// carries no hardcoded C:/Program Files path, and PixInsight maintains the
// dependency list. "../ImageSolver/" resolves relative to this script's
// folder -> <PixInsight>/src/scripts/ImageSolver/, exactly as BPP-Solver.js
// (in the sibling BatchPreprocessing/ folder) references it.
/* beautify ignore:start */
#define USE_SOLVER_LIBRARY true
#define SETTINGS_MODULE     "SOLVER"
#include "../ImageSolver/ImageSolver.js"
/* beautify ignore:end */

// ============================================================
// ASTROMETRIC INDEX - needed by ImageSolver's blind solver
// ============================================================

// Path of the astrometric index file set in the Gaia process preferences,
// or "" if none is set or the file is missing (same lookup as ImageSolver's
// own astrometricIndexFilePath()).
function shAstrometricIndexPath()
{
   try {
      let G = new Gaia;
      G.command = "get-info";
      G.dataRelease = Gaia.DataRelease_BestAvailable;
      G.verbosity = 0;
      G.executeGlobal();
      let path = G.astrometricIndexFilePath.trim();
      if (path.length > 0 && File.exists(path))
         return path;
   } catch (e) {}
   return "";
}

function shPrintIndexHelp()
{
   console.writeln("  Blind solving needs an astrometric index file:");
   console.writeln("    1. Download the Gaia astrometric index (gdr3-idx-1.0.0-g17.xpsd, about 1.8 GB)");
   console.writeln("       from the PixInsight Software Distribution.");
   console.writeln("    2. Process > Astrometry > Gaia, Preferences (wrench icon): 'Astrometric Index File'.");
   console.writeln("  Or add RA/Dec (OBJCTRA/OBJCTDEC) and image scale (XPIXSZ + FOCALLEN) to the image.");
}

// ============================================================
// MARS DATABASE - Auto-detect .xmars files
// ============================================================

var SETTINGS_KEY_MARS = "SpaceHunter/MARSFiles";      // old file list, no longer used
var SETTINGS_KEY_MARS_DIR = "SpaceHunter/MARSFolder"; // folder the user picked
var SETTINGS_KEY_USERPREFS = "SpaceHunter/UserPrefs";

// Scan result for this run, so the folders are searched once, not once per preview.
var MARS_FILES_CACHE;

function resolveMARSFiles()
{
   if (MARS_FILES_CACHE !== undefined)
      return MARS_FILES_CACHE;
   MARS_FILES_CACHE = resolveMARSFilesScan();
   return MARS_FILES_CACHE;
}

function resolveMARSFilesScan()
{
   // Always re-scan for .xmars files instead of trusting cached paths.
   // MARS database files may change between PI updates (e.g. DR1 → DR2),
   // so we scan every time to pick up new releases automatically.
   // Only the folder the user picked is remembered; it is scanned first.
   try { Settings.remove(SETTINGS_KEY_MARS); } catch (e) {}   // old file list
   try { Settings.remove("SpaceHunter/ASTAPPath"); } catch (e) {}   // pre-v2.6.0 setting
   let userDir = null;
   try {
      let saved = Settings.read(SETTINGS_KEY_MARS_DIR, DataType.String);
      if (Settings.lastReadOK && saved && File.directoryExists(saved))
         userDir = saved;
   } catch (e) {}

   // Search common locations for .xmars files
   let searchDirs = [
      "C:/Program Files/PixInsight/library",
      "C:/Program Files (x86)/PixInsight/library",
      "D:/Program Files/PixInsight/library",
      File.homeDirectory + "/AppData/Local/PixInsight",
      File.homeDirectory + "/AppData/Roaming/Pleiades"
   ];

   if (userDir)
      searchDirs.unshift(userDir);

   // Also check all drive letters under common ASTRO directories
   let drives = ["C:", "D:", "E:", "F:"];
   for (let d = 0; d < drives.length; d++) {
      searchDirs.push(drives[d] + "/Astro/PixInsight/MARS");
      searchDirs.push(drives[d] + "/ASTRO/PixInsight/MARS");
      searchDirs.push(drives[d] + "/PixInsight/MARS");
   }

   let foundFiles = [];

   for (let d = 0; d < searchDirs.length; d++) {
      if (!File.directoryExists(searchDirs[d])) continue;
      let search = new FileFind;
      if (search.begin(searchDirs[d] + "/*.xmars")) {
         do {
            if (!search.isDirectory) {
               let fullPath = searchDirs[d] + "/" + search.name;
               foundFiles.push(fullPath);
            }
         } while (search.next());
      }
   }

   // Deduplicate (case-insensitive, since Windows paths are case-insensitive)
   var seen = {};
   var uniqueFiles = [];
   for (var i = 0; i < foundFiles.length; i++) {
      var lowerPath = foundFiles[i].toLowerCase();
      if (!seen[lowerPath]) {
         seen[lowerPath] = true;
         uniqueFiles.push(foundFiles[i]);
      }
   }
   foundFiles = uniqueFiles;
   for (var i = 0; i < foundFiles.length; i++)
      console.writeln("  MARS file found: " + foundFiles[i]);

   if (foundFiles.length > 0) {
      let result = [];
      for (let i = 0; i < foundFiles.length; i++)
         result.push([true, foundFiles[i]]);
      console.writeln("MARS database: " + foundFiles.length + " file(s) auto-detected");
      return result;
   }

   // 3. Not found — ask user to locate directory
   console.warningln("MARS database files not found. Asking user...");

   let gdd = new GetDirectoryDialog;
   gdd.caption = "Locate MARS Database Folder (containing .xmars files)";

   if (gdd.execute()) {
      let marsDir = gdd.directory;
      let userFiles = [];
      let search = new FileFind;
      if (search.begin(marsDir + "/*.xmars")) {
         do {
            if (!search.isDirectory) {
               userFiles.push(marsDir + "/" + search.name);
            }
         } while (search.next());
      }

      if (userFiles.length > 0) {
         // Remember the folder (not the files), so new MARS releases in it
         // are found too. Reset Settings forgets it.
         Settings.write(SETTINGS_KEY_MARS_DIR, DataType.String, marsDir);
         let result = [];
         for (let i = 0; i < userFiles.length; i++)
            result.push([true, userFiles[i]]);
         console.writeln("MARS database: " + userFiles.length + " file(s) selected by user");
         return result;
      } else {
         console.warningln("No .xmars files found in selected directory.");
      }
   }

   return null;
}

// ============================================================
// SCRIPT IDENTITY
// ============================================================

#define SCRIPT_NAME    "Space Hunter Lazy Workflow Part 1"
#define SCRIPT_VERSION "v2.7.11"
// Dialog.browseScriptDocumentation() takes the MENU name (last part of the
// #feature-id menu path), not the ID, and opens doc/scripts/<name>/<name>.html.
// Tested in PI 2026-10-12. Keep in sync with #feature-id and the manual folder.
var DOC_NAME = "SH Lazy Workflow Part 1";
// ============================================================
// FILE PATHS - Auto-detect (user-independent)
// ============================================================

// Custom filter database (in user's AppData)
var customFilterPath = File.homeDirectory + "/AppData/Roaming/Pleiades/filters-001-pxi.xspd";

// Standard library locations (try common installation paths)
var libraryPaths = [
   "C:/Program Files/PixInsight/library/filters.xspd",
   "C:/Program Files (x86)/PixInsight/library/filters.xspd",
   "D:/Program Files/PixInsight/library/filters.xspd"
];

var whiteRefPaths = [
   "C:/Program Files/PixInsight/library/white-references.xspd",
   "C:/Program Files (x86)/PixInsight/library/white-references.xspd",
   "D:/Program Files/PixInsight/library/white-references.xspd"
];

// Determine filter database paths - both will be loaded and merged
var FILTERS_XSPD_PATH = null;
for (var i = 0; i < libraryPaths.length; i++) {
   if (File.exists(libraryPaths[i])) {
      FILTERS_XSPD_PATH = libraryPaths[i];
      break;
   }
}

var FILTERS_CUSTOM_PATH = File.exists(customFilterPath) ? customFilterPath : null;

// Determine white reference database location
var WHITEREF_XSPD_PATH = null;
for (var i = 0; i < whiteRefPaths.length; i++) {
   if (File.exists(whiteRefPaths[i])) {
      WHITEREF_XSPD_PATH = whiteRefPaths[i];
      break;
   }
}

// ============================================================
// DATABASE STORAGE
// ============================================================

// Raw parsed filter database: { "FilterName|channel": "wavelength,value,..." }
var filterDB = {};

// White reference database: { "RefName": "wavelength,value,..." }
var whiteRefDB = {};

// Organized lists for dropdowns
var whiteRefList = [];  // array of { label: "...", name: "..." }
var cameraList = [];    // array of { label: "...", xspdName: "..." }
var filterList = [];    // RGB sets only: { label: "...", type: "broadband"|"precombined", redName, greenName, blueName }
var grayFilterList = []; // PAN/L entries: { label: "...", name: "...", channel: "PAN"|"L" }

// Gray filter used when nothing has been chosen yet (the curve v2.3 and
// earlier always used).
var DEFAULT_GRAY_FILTER = "Astronomik UV-IR Block L-2";

// Index of the entry whose key field equals value, else -1.
function shIndexBy(list, field, value)
{
   for (var i = 0; i < list.length; i++)
      if (list[i][field] === value)
         return i;
   return -1;
}

// ============================================================
// GRADIENT SCALE OPTIONS (shared constant)
// ============================================================

var GRADIENT_SCALE_VALUES = [128, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096, 6144, 8192];

// Default gradient scales for each preview position
var DEFAULT_GRADIENT_SCALES = [768, 1024, 2048, 3072];

// MGC scale factor modes (dialog order) and the correlation below which an
// automatic factor is flagged in the console and the model panel.
// 0.75 from tests 2026-11-01: UVIR at 0.82-0.88 still gave the flatter
// background with auto; ALPT G/B at 0.63-0.67 stays flagged.
var MGC_SCALE_MODES = ["standard", "auto", "both"];
var MGC_SCALE_MODE_LABELS = ["Standard (1.0)", "Automatic", "Both (compare)"];
var MGC_LOW_CORRELATION = 0.75;
var MGC_AUTO_SUFFIX = "_autoSF";

// MARS filters offered for MGC (dialog order)
var MGC_FILTERS = ["L", "R", "G", "B", "Ha", "OIII", "SII", "IR"];

function mgcScaleModeIndex(mode)
{
   var idx = MGC_SCALE_MODES.indexOf(mode);
   return idx >= 0 ? idx : 0;
}

// ============================================================
// WORKFLOW PARAMETERS (save/load for New Instance)
// ============================================================

var WorkflowParameters = {
   // Section enable states
   enableImageSolve: true,
   enableSPFC:       true,
   enablePreviews:   true,
   enableMGC:        true,
   enableGC:         false,
   enableDBE:        false,

   // ImageSolve section
   enableBlindSolve: true,   // ImageSolver blind solver when RA/Dec or scale missing

   // SPFC section
   selectedWhiteRefIdx: 0,
   selectedCameraIdx:   -1, // set to Ideal QE curve at startup
   selectedFilterIdx:   0,  // index into filterList (RGB sets)
   selectedGrayIdx:     0,  // index into grayFilterList
   // Filters are saved by name: the lists are rebuilt from the XSPD files
   // each run, so a saved index could point to a different filter.
   selectedFilterLabel: "",
   selectedGrayName:    "",
   selectedCameraName:  "",
   selectedWhiteRefName: "",

   // SPFC Narrowband
   enableNarrowband:    false,
   nbRedWavelength:     656.30,
   nbRedBandwidth:      3.00,
   nbGreenWavelength:   500.70,
   nbGreenBandwidth:    3.00,
   nbBlueWavelength:    500.70,
   nbBlueBandwidth:     3.00,

   // Ha/OIII separation (dual-band, narrowband mode only)
   enableSeparation:    false,
   sepGreenFactor:      0.000,
   sepBlueFactor:       0.000,
   sepProfileFolder:    "",   // folder with camera/filter profile .txt files
   sepProfileName:      "",   // selected profile file name ("" = manual values)

   // SPFC graphs
   generateSPFCGraphs:  false,

   // Previews section
   numPreviews: 4,

   // MGC section - per-preview gradient scales
   gradientScale0: 768,
   gradientScale1: 1024,
   gradientScale2: 2048,
   gradientScale3: 3072,

   // MGC filter selection
   enableMGCFilters:  false,
   mgcGrayFilter:     "L",
   mgcRedFilter:      "Ha",
   mgcGreenFilter:    "OIII",
   mgcBlueFilter:     "OIII",

   // MGC scale factors: "standard" (1.0), "auto" (autoScaleFactors), "both"
   mgcScaleMode:      "standard",

   // Alternative workflows: sections collapsed unless the user opened them
   gcExpanded:        false,
   dbeExpanded:       false,

   // -----------------------------------------------------------
   // Save parameters to PixInsight Parameters store
   // -----------------------------------------------------------
   save: function()
   {
      Parameters.set("enableImageSolve", this.enableImageSolve);
      Parameters.set("enableSPFC",       this.enableSPFC);
      Parameters.set("enablePreviews",   this.enablePreviews);
      Parameters.set("enableMGC",        this.enableMGC);
      Parameters.set("enableGC",         this.enableGC);
      Parameters.set("enableDBE",        this.enableDBE);

      Parameters.set("enableBlindSolve", this.enableBlindSolve);

      Parameters.set("selectedWhiteRefIdx", this.selectedWhiteRefIdx);
      Parameters.set("selectedCameraIdx",   this.selectedCameraIdx);
      this.syncFilterNames();
      Parameters.set("selectedFilterLabel", this.selectedFilterLabel);
      Parameters.set("selectedGrayName",    this.selectedGrayName);
      Parameters.set("selectedCameraName",  this.selectedCameraName);
      Parameters.set("selectedWhiteRefName", this.selectedWhiteRefName);

      Parameters.set("enableNarrowband",  this.enableNarrowband);
      Parameters.set("nbRedWavelength",   this.nbRedWavelength);
      Parameters.set("nbRedBandwidth",    this.nbRedBandwidth);
      Parameters.set("nbGreenWavelength", this.nbGreenWavelength);
      Parameters.set("nbGreenBandwidth",  this.nbGreenBandwidth);
      Parameters.set("nbBlueWavelength",  this.nbBlueWavelength);
      Parameters.set("nbBlueBandwidth",   this.nbBlueBandwidth);

      Parameters.set("enableSeparation", this.enableSeparation);
      Parameters.set("sepGreenFactor",   this.sepGreenFactor);
      Parameters.set("sepBlueFactor",    this.sepBlueFactor);
      // The profile folder is a path on this computer: it stays in the
      // user's own settings and is not put into process icons.
      Parameters.set("sepProfileName",   this.sepProfileName);

      Parameters.set("generateSPFCGraphs", this.generateSPFCGraphs);

      Parameters.set("numPreviews", this.numPreviews);

      Parameters.set("gradientScale0", this.gradientScale0);
      Parameters.set("gradientScale1", this.gradientScale1);
      Parameters.set("gradientScale2", this.gradientScale2);
      Parameters.set("gradientScale3", this.gradientScale3);

      Parameters.set("enableMGCFilters", this.enableMGCFilters);
      Parameters.set("mgcGrayFilter",    this.mgcGrayFilter);
      Parameters.set("mgcRedFilter",     this.mgcRedFilter);
      Parameters.set("mgcGreenFilter",   this.mgcGreenFilter);
      Parameters.set("mgcBlueFilter",    this.mgcBlueFilter);
      Parameters.set("mgcScaleMode",     this.mgcScaleMode);
   },
   // -----------------------------------------------------------
   // Save user preferences to persistent Settings store
   // -----------------------------------------------------------
   saveUserPrefs: function()
   {
      this.syncFilterNames();
      var prefs = {
         enableImageSolve:    this.enableImageSolve,
         enableBlindSolve:    this.enableBlindSolve,
         enableSPFC:          this.enableSPFC,
         enablePreviews:      this.enablePreviews,
         enableMGC:           this.enableMGC,
         enableGC:            this.enableGC,
         enableDBE:           this.enableDBE,
         selectedWhiteRefIdx: this.selectedWhiteRefIdx,
         selectedCameraIdx:   this.selectedCameraIdx,
         selectedFilterLabel: this.selectedFilterLabel,
         selectedGrayName:    this.selectedGrayName,
         selectedCameraName:  this.selectedCameraName,
         selectedWhiteRefName: this.selectedWhiteRefName,
         enableNarrowband:    this.enableNarrowband,
         nbRedWavelength:     this.nbRedWavelength,
         nbRedBandwidth:      this.nbRedBandwidth,
         nbGreenWavelength:   this.nbGreenWavelength,
         nbGreenBandwidth:    this.nbGreenBandwidth,
         nbBlueWavelength:    this.nbBlueWavelength,
         nbBlueBandwidth:     this.nbBlueBandwidth,
         enableSeparation:    this.enableSeparation,
         sepGreenFactor:      this.sepGreenFactor,
         sepBlueFactor:       this.sepBlueFactor,
         sepProfileFolder:    this.sepProfileFolder,
         sepProfileName:      this.sepProfileName,
         generateSPFCGraphs:  this.generateSPFCGraphs,
         numPreviews:         this.numPreviews,
         gradientScale0:      this.gradientScale0,
         gradientScale1:      this.gradientScale1,
         gradientScale2:      this.gradientScale2,
         gradientScale3:      this.gradientScale3,
         enableMGCFilters:    this.enableMGCFilters,
         mgcGrayFilter:       this.mgcGrayFilter,
         mgcRedFilter:        this.mgcRedFilter,
         mgcGreenFilter:      this.mgcGreenFilter,
         mgcBlueFilter:       this.mgcBlueFilter,
         mgcScaleMode:        this.mgcScaleMode,
         gcExpanded:          this.gcExpanded,
         dbeExpanded:         this.dbeExpanded
      };
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType.String, JSON.stringify(prefs));
      } catch (e) {}
   },

   // -----------------------------------------------------------
   // Load user preferences from persistent Settings store
   // -----------------------------------------------------------
   loadUserPrefs: function()
   {
      try {
         var saved = Settings.read(SETTINGS_KEY_USERPREFS, DataType.String);
         if (saved) {
            var prefs = JSON.parse(saved);
            if (prefs.enableImageSolve    !== undefined) this.enableImageSolve    = prefs.enableImageSolve;
            if (prefs.enableBlindSolve    !== undefined) this.enableBlindSolve    = prefs.enableBlindSolve;
            if (prefs.enableSPFC          !== undefined) this.enableSPFC          = prefs.enableSPFC;
            if (prefs.enablePreviews      !== undefined) this.enablePreviews      = prefs.enablePreviews;
            if (prefs.enableMGC           !== undefined) this.enableMGC           = prefs.enableMGC;
            if (prefs.enableGC            !== undefined) this.enableGC            = prefs.enableGC;
            if (prefs.enableDBE           !== undefined) this.enableDBE           = prefs.enableDBE;
            if (prefs.selectedWhiteRefIdx !== undefined) this.selectedWhiteRefIdx = prefs.selectedWhiteRefIdx;
            if (prefs.selectedCameraIdx   !== undefined) this.selectedCameraIdx   = prefs.selectedCameraIdx;
            // v2.3 and earlier saved selectedFilterIdx into the combined
            // RGB+PAN+L list; that index no longer means anything and is ignored.
            if (prefs.selectedFilterLabel !== undefined) this.selectedFilterLabel = prefs.selectedFilterLabel;
            if (prefs.selectedGrayName    !== undefined) this.selectedGrayName    = prefs.selectedGrayName;
            if (prefs.selectedCameraName  !== undefined) this.selectedCameraName  = prefs.selectedCameraName;
            if (prefs.selectedWhiteRefName !== undefined) this.selectedWhiteRefName = prefs.selectedWhiteRefName;
            if (prefs.enableNarrowband    !== undefined) this.enableNarrowband    = prefs.enableNarrowband;
            if (prefs.nbRedWavelength     !== undefined) this.nbRedWavelength     = prefs.nbRedWavelength;
            if (prefs.nbRedBandwidth      !== undefined) this.nbRedBandwidth      = prefs.nbRedBandwidth;
            if (prefs.nbGreenWavelength   !== undefined) this.nbGreenWavelength   = prefs.nbGreenWavelength;
            if (prefs.nbGreenBandwidth    !== undefined) this.nbGreenBandwidth    = prefs.nbGreenBandwidth;
            if (prefs.nbBlueWavelength    !== undefined) this.nbBlueWavelength    = prefs.nbBlueWavelength;
            if (prefs.nbBlueBandwidth     !== undefined) this.nbBlueBandwidth     = prefs.nbBlueBandwidth;
            if (prefs.enableSeparation    !== undefined) this.enableSeparation    = prefs.enableSeparation;
            if (prefs.sepGreenFactor      !== undefined) this.sepGreenFactor      = prefs.sepGreenFactor;
            if (prefs.sepBlueFactor       !== undefined) this.sepBlueFactor       = prefs.sepBlueFactor;
            if (prefs.sepProfileFolder    !== undefined) this.sepProfileFolder    = prefs.sepProfileFolder;
            if (prefs.sepProfileName      !== undefined) this.sepProfileName      = prefs.sepProfileName;
            if (prefs.generateSPFCGraphs  !== undefined) this.generateSPFCGraphs  = prefs.generateSPFCGraphs;
            if (prefs.numPreviews         !== undefined) this.numPreviews         = prefs.numPreviews;
            if (prefs.gradientScale0      !== undefined) this.gradientScale0      = prefs.gradientScale0;
            if (prefs.gradientScale1      !== undefined) this.gradientScale1      = prefs.gradientScale1;
            if (prefs.gradientScale2      !== undefined) this.gradientScale2      = prefs.gradientScale2;
            if (prefs.gradientScale3      !== undefined) this.gradientScale3      = prefs.gradientScale3;
            if (prefs.enableMGCFilters    !== undefined) this.enableMGCFilters    = prefs.enableMGCFilters;
            if (prefs.mgcGrayFilter       !== undefined) this.mgcGrayFilter       = prefs.mgcGrayFilter;
            if (prefs.mgcRedFilter        !== undefined) this.mgcRedFilter        = prefs.mgcRedFilter;
            if (prefs.mgcGreenFilter      !== undefined) this.mgcGreenFilter      = prefs.mgcGreenFilter;
            if (prefs.mgcBlueFilter       !== undefined) this.mgcBlueFilter       = prefs.mgcBlueFilter;
            if (prefs.mgcScaleMode        !== undefined) this.mgcScaleMode        = prefs.mgcScaleMode;
            if (prefs.gcExpanded          !== undefined) this.gcExpanded          = prefs.gcExpanded;
            if (prefs.dbeExpanded         !== undefined) this.dbeExpanded         = prefs.dbeExpanded;
         }
      } catch (e) {}
   },

   // -----------------------------------------------------------
   // Reset user preferences to factory defaults
   // -----------------------------------------------------------
   resetUserPrefs: function()
   {
      var spiralIdx = 0;
      for (var i = 0; i < whiteRefList.length; i++) {
         if (whiteRefList[i].name === "Average Spiral Galaxy") { spiralIdx = i; break; }
      }
      this.selectedWhiteRefIdx = spiralIdx;
      this.selectedCameraIdx   = -1;
      this.selectedCameraName  = "";
      this.selectedWhiteRefName = "";
      this.selectedFilterLabel = "";
      this.selectedGrayName    = "";
      this.resolveFilterSelection();
      this.enableNarrowband    = false;
      this.nbRedWavelength     = 656.30;
      this.nbRedBandwidth      = 3.00;
      this.nbGreenWavelength   = 500.70;
      this.nbGreenBandwidth    = 3.00;
      this.nbBlueWavelength    = 500.70;
      this.nbBlueBandwidth     = 3.00;
      this.enableSeparation    = false;
      this.sepGreenFactor      = 0.000;
      this.sepBlueFactor       = 0.000;
      this.sepProfileName      = "";   // the folder is kept: it holds the user's files
      this.generateSPFCGraphs  = false;
      this.numPreviews         = 4;
      this.gradientScale0      = 768;
      this.gradientScale1      = 1024;
      this.gradientScale2      = 2048;
      this.gradientScale3      = 3072;
      this.enableMGCFilters    = false;
      this.mgcGrayFilter       = "L";
      this.mgcRedFilter        = "Ha";
      this.mgcGreenFilter      = "OIII";
      this.mgcBlueFilter       = "OIII";
      this.mgcScaleMode        = "standard";
      try {
         Settings.remove(SETTINGS_KEY_USERPREFS);
      } catch (e) {}
      try { Settings.remove(SETTINGS_KEY_MARS_DIR); } catch (e) {}
   },
   // -----------------------------------------------------------
   // Load parameters from PixInsight Parameters store
   // -----------------------------------------------------------
   load: function()
   {
      if (Parameters.has("enableImageSolve"))
         this.enableImageSolve = Parameters.getBoolean("enableImageSolve");
      if (Parameters.has("enableSPFC"))
         this.enableSPFC = Parameters.getBoolean("enableSPFC");
      if (Parameters.has("enablePreviews"))
         this.enablePreviews = Parameters.getBoolean("enablePreviews");
      if (Parameters.has("enableMGC"))
         this.enableMGC = Parameters.getBoolean("enableMGC");
      if (Parameters.has("enableGC"))
         this.enableGC = Parameters.getBoolean("enableGC");
      if (Parameters.has("enableDBE"))
         this.enableDBE = Parameters.getBoolean("enableDBE");

      if (Parameters.has("enableBlindSolve"))
         this.enableBlindSolve = Parameters.getBoolean("enableBlindSolve");

      if (Parameters.has("selectedWhiteRefIdx"))
         this.selectedWhiteRefIdx = Parameters.getInteger("selectedWhiteRefIdx");
      if (Parameters.has("selectedCameraIdx"))
         this.selectedCameraIdx = Parameters.getInteger("selectedCameraIdx");
      if (Parameters.has("selectedFilterLabel"))
         this.selectedFilterLabel = Parameters.getString("selectedFilterLabel");
      if (Parameters.has("selectedGrayName"))
         this.selectedGrayName = Parameters.getString("selectedGrayName");
      if (Parameters.has("selectedCameraName"))
         this.selectedCameraName = Parameters.getString("selectedCameraName");
      if (Parameters.has("selectedWhiteRefName"))
         this.selectedWhiteRefName = Parameters.getString("selectedWhiteRefName");

      if (Parameters.has("enableNarrowband"))
         this.enableNarrowband = Parameters.getBoolean("enableNarrowband");
      if (Parameters.has("nbRedWavelength"))
         this.nbRedWavelength = Parameters.getReal("nbRedWavelength");
      if (Parameters.has("nbRedBandwidth"))
         this.nbRedBandwidth = Parameters.getReal("nbRedBandwidth");
      if (Parameters.has("nbGreenWavelength"))
         this.nbGreenWavelength = Parameters.getReal("nbGreenWavelength");
      if (Parameters.has("nbGreenBandwidth"))
         this.nbGreenBandwidth = Parameters.getReal("nbGreenBandwidth");
      if (Parameters.has("nbBlueWavelength"))
         this.nbBlueWavelength = Parameters.getReal("nbBlueWavelength");
      if (Parameters.has("nbBlueBandwidth"))
         this.nbBlueBandwidth = Parameters.getReal("nbBlueBandwidth");

      if (Parameters.has("enableSeparation"))
         this.enableSeparation = Parameters.getBoolean("enableSeparation");
      if (Parameters.has("sepGreenFactor"))
         this.sepGreenFactor = Parameters.getReal("sepGreenFactor");
      if (Parameters.has("sepBlueFactor"))
         this.sepBlueFactor = Parameters.getReal("sepBlueFactor");
      // sepProfileFolder: icons from v2.7.6 and older may hold it; the
      // folder saved on this computer is used instead.
      if (Parameters.has("sepProfileName"))
         this.sepProfileName = Parameters.getString("sepProfileName");

      if (Parameters.has("generateSPFCGraphs"))
         this.generateSPFCGraphs = Parameters.getBoolean("generateSPFCGraphs");

      if (Parameters.has("numPreviews"))
         this.numPreviews = Parameters.getInteger("numPreviews");

      if (Parameters.has("gradientScale0"))
         this.gradientScale0 = Parameters.getInteger("gradientScale0");
      if (Parameters.has("gradientScale1"))
         this.gradientScale1 = Parameters.getInteger("gradientScale1");
      if (Parameters.has("gradientScale2"))
         this.gradientScale2 = Parameters.getInteger("gradientScale2");
      if (Parameters.has("gradientScale3"))
         this.gradientScale3 = Parameters.getInteger("gradientScale3");

      if (Parameters.has("enableMGCFilters"))
         this.enableMGCFilters = Parameters.getBoolean("enableMGCFilters");
      if (Parameters.has("mgcGrayFilter"))
         this.mgcGrayFilter = Parameters.getString("mgcGrayFilter");
      if (Parameters.has("mgcRedFilter"))
         this.mgcRedFilter = Parameters.getString("mgcRedFilter");
      if (Parameters.has("mgcGreenFilter"))
         this.mgcGreenFilter = Parameters.getString("mgcGreenFilter");
      if (Parameters.has("mgcBlueFilter"))
         this.mgcBlueFilter = Parameters.getString("mgcBlueFilter");
      if (Parameters.has("mgcScaleMode"))
         this.mgcScaleMode = Parameters.getString("mgcScaleMode");
   },

   // -----------------------------------------------------------
   // Check values from saved settings or a process icon: a value of the
   // wrong type or outside the dialog's range gets its default.
   // -----------------------------------------------------------
   validate: function()
   {
      for (var k in WP_DEFAULTS)
         if (typeof this[k] !== typeof WP_DEFAULTS[k] ||
             (typeof this[k] === "number" && !isFinite(this[k])))
            this[k] = WP_DEFAULTS[k];

      var positive = ["nbRedWavelength", "nbRedBandwidth", "nbGreenWavelength",
                      "nbGreenBandwidth", "nbBlueWavelength", "nbBlueBandwidth"];
      for (var i = 0; i < positive.length; i++)
         if (!(this[positive[i]] > 0))
            this[positive[i]] = WP_DEFAULTS[positive[i]];
      if (!(this.sepGreenFactor >= 0 && this.sepGreenFactor <= 1))
         this.sepGreenFactor = WP_DEFAULTS.sepGreenFactor;
      if (!(this.sepBlueFactor >= 0 && this.sepBlueFactor <= 1))
         this.sepBlueFactor = WP_DEFAULTS.sepBlueFactor;
      if ([1, 2, 3, 4].indexOf(this.numPreviews) < 0)
         this.numPreviews = WP_DEFAULTS.numPreviews;
      for (var i = 0; i < 4; i++)
         if (GRADIENT_SCALE_VALUES.indexOf(this.getGradientScale(i)) < 0)
            this.setGradientScale(i, DEFAULT_GRADIENT_SCALES[i]);
      var mgcFilters = ["mgcGrayFilter", "mgcRedFilter", "mgcGreenFilter", "mgcBlueFilter"];
      for (var i = 0; i < mgcFilters.length; i++)
         if (MGC_FILTERS.indexOf(this[mgcFilters[i]]) < 0)
            this[mgcFilters[i]] = WP_DEFAULTS[mgcFilters[i]];
      if (MGC_SCALE_MODES.indexOf(this.mgcScaleMode) < 0)
         this.mgcScaleMode = WP_DEFAULTS.mgcScaleMode;
   },

   // -----------------------------------------------------------
   // Helpers: filter selection is saved by name, used by index
   // -----------------------------------------------------------
   syncFilterNames: function()
   {
      if (filterList[this.selectedFilterIdx])
         this.selectedFilterLabel = filterList[this.selectedFilterIdx].label;
      if (grayFilterList[this.selectedGrayIdx])
         this.selectedGrayName = grayFilterList[this.selectedGrayIdx].name;
      if (cameraList[this.selectedCameraIdx])
         this.selectedCameraName = cameraList[this.selectedCameraIdx].xspdName;
      if (whiteRefList[this.selectedWhiteRefIdx])
         this.selectedWhiteRefName = whiteRefList[this.selectedWhiteRefIdx].name;
   },

   // Call after the lists are built and the saved names are loaded.
   resolveFilterSelection: function()
   {
      // White reference: by name like Part 2; an old saved index is kept only
      // if still valid, otherwise Average Spiral Galaxy.
      var idx = shIndexBy(whiteRefList, "name", this.selectedWhiteRefName);
      if (idx >= 0)
         this.selectedWhiteRefIdx = idx;
      else if (!(this.selectedWhiteRefIdx >= 0 && this.selectedWhiteRefIdx < whiteRefList.length)) {
         idx = shIndexBy(whiteRefList, "name", "Average Spiral Galaxy");
         this.selectedWhiteRefIdx = idx >= 0 ? idx : 0;
      }

      idx = shIndexBy(filterList, "label", this.selectedFilterLabel);
      this.selectedFilterIdx = (idx >= 0) ? idx : 0;

      idx = shIndexBy(grayFilterList, "name", this.selectedGrayName);
      if (idx < 0)
         idx = shIndexBy(grayFilterList, "name", DEFAULT_GRAY_FILTER);
      this.selectedGrayIdx = (idx >= 0) ? idx : 0;

      // Camera: by name; older prefs only have the index, kept if still valid;
      // otherwise Ideal QE curve.
      idx = shIndexBy(cameraList, "xspdName", this.selectedCameraName);
      if (idx >= 0)
         this.selectedCameraIdx = idx;
      else if (!(this.selectedCameraIdx >= 0 && this.selectedCameraIdx < cameraList.length)) {
         this.selectedCameraIdx = 0;
         for (var i = 0; i < cameraList.length; i++)
            if (cameraList[i].label.indexOf("Ideal") >= 0) { this.selectedCameraIdx = i; break; }
      }
   },

   // -----------------------------------------------------------
   // Helper: get gradient scale for preview index (0-3)
   // -----------------------------------------------------------
   getGradientScale: function(index)
   {
      switch (index)
      {
      case 0: return this.gradientScale0;
      case 1: return this.gradientScale1;
      case 2: return this.gradientScale2;
      case 3: return this.gradientScale3;
      default: return DEFAULT_GRADIENT_SCALES[0];
      }
   },

   // -----------------------------------------------------------
   // Helper: set gradient scale for preview index (0-3)
   // -----------------------------------------------------------
   setGradientScale: function(index, value)
   {
      switch (index)
      {
      case 0: this.gradientScale0 = value; break;
      case 1: this.gradientScale1 = value; break;
      case 2: this.gradientScale2 = value; break;
      case 3: this.gradientScale3 = value; break;
      }
   },

   // -----------------------------------------------------------
   // Helper: find combo box index for a gradient scale value
   // -----------------------------------------------------------
   gradientScaleToComboIndex: function(value)
   {
      for (var i = 0; i < GRADIENT_SCALE_VALUES.length; i++)
         if (GRADIENT_SCALE_VALUES[i] === value)
            return i;
      return 4; // default to 768
   }
};

// The defaults above, before saved settings or an icon change them
// (used by validate()).
var WP_DEFAULTS = (function()
{
   var d = {};
   for (var k in WorkflowParameters)
      if (typeof WorkflowParameters[k] !== "function")
         d[k] = WorkflowParameters[k];
   return d;
})();

// ============================================================
// XSPD PARSERS
// ============================================================

function parseXSPDIntoFilterDB(filePath)
{
   var xml = File.readTextFile(filePath);
   console.writeln("  File size: " + xml.length + " bytes");

   var re = /<Filter\s+name="([^"]*)"\s+channel="([^"]*)"\s+(?:default="[^"]*"\s+)?(?:reference="[^"]*"\s+)?data="([^"]*)"\s*\/>/g;
   var match;
   var count = 0;

   while ((match = re.exec(xml)) !== null) {
      var name = match[1];
      var channel = match[2];
      var data = match[3].replace(/\r?\n/g, '');
      filterDB[name + "|" + channel] = data;
      count++;
   }
   return count;
}

function parseFiltersXSPD()
{
   if (FILTERS_XSPD_PATH === null) {
      throw new Error("No filter database found! Checked all library locations.");
   }

   var totalCount = 0;

   // Load standard library filters first
   console.writeln("Reading standard filter database: " + FILTERS_XSPD_PATH);
   var count = parseXSPDIntoFilterDB(FILTERS_XSPD_PATH);
   console.writeln("  Parsed " + count + " standard filter entries");
   totalCount += count;

   // Load custom filters second — duplicates overwrite standard entries
   if (FILTERS_CUSTOM_PATH !== null) {
      console.writeln("Reading custom filter database: " + FILTERS_CUSTOM_PATH);
      count = parseXSPDIntoFilterDB(FILTERS_CUSTOM_PATH);
      console.writeln("  Parsed " + count + " custom filter entries (merged, duplicates overwritten)");
      totalCount += count;
   } else {
      console.writeln("  No custom filter database found — using standard library only.");
   }

   console.writeln("  Total unique filter entries in database: " + Object.keys(filterDB).length);

   if (totalCount === 0)
      throw new Error("No filter entries found in any XSPD file.");
}

function parseWhiteRefXSPD()
{
   console.writeln("Reading white reference database: " + WHITEREF_XSPD_PATH);

   if (!File.exists(WHITEREF_XSPD_PATH))
      throw new Error("White reference database not found: " + WHITEREF_XSPD_PATH);

   var xml = File.readTextFile(WHITEREF_XSPD_PATH);
   console.writeln("  File size: " + xml.length + " bytes");

   var re = /<WhiteRef\s+name="([^"]*)"\s+(?:default="[^"]*"\s+)?data="([^"]*)"\s*\/>/g;
   var match;
   var count = 0;
   var defaultIdx = -1;

   while ((match = re.exec(xml)) !== null) {
      var name = match[1];
      var data = match[2].replace(/\r?\n/g, '');
      whiteRefDB[name] = data;

      whiteRefList.push({ label: name, name: name });

      if (match[0].indexOf('default=') >= 0)
         defaultIdx = count;

      count++;
   }

   console.writeln("  Parsed " + count + " white reference entries");

   if (count === 0)
      throw new Error("No white reference entries found.");

   if (defaultIdx >= 0) {
      WorkflowParameters.selectedWhiteRefIdx = defaultIdx;
   } else {
      for (var i = 0; i < whiteRefList.length; i++) {
         if (whiteRefList[i].name === "Average Spiral Galaxy") {
            WorkflowParameters.selectedWhiteRefIdx = i;
            break;
         }
      }
   }
}

function getFilterData(name, channel)
{
   var key = name + "|" + channel;
   if (filterDB[key] !== undefined)
      return filterDB[key];
   return null;
}

// ============================================================
// AUTO-GROUPING: Build Camera and Filter Lists
// ============================================================

function buildDropdownLists()
{
   // --- CAMERAS: all channel="Q" entries ---
   cameraList = [];
   for (var key in filterDB) {
      if (!filterDB.hasOwnProperty(key)) continue;
      var parts = key.split("|");
      if (parts[1] === "Q") {
         cameraList.push({ label: parts[0], xspdName: parts[0] });
      }
   }
   cameraList.sort(function(a, b) {
      if (a.label.indexOf("Ideal") >= 0) return 1;
      if (b.label.indexOf("Ideal") >= 0) return -1;
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   console.writeln("  Cameras found: " + cameraList.length);

   // --- FILTERS: collect R-channel entries, find matching G and B ---
   filterList = [];

   var rEntries = [];
   var gEntries = {};
   var bEntries = {};
   var panEntries = [];
   var lumEntries = [];

   for (var key in filterDB) {
      if (!filterDB.hasOwnProperty(key)) continue;
      var parts = key.split("|");
      var name = parts[0];
      var channel = parts[1];

      if (channel === "Q") continue;
      if (channel === "R") rEntries.push(name);
      if (channel === "G") gEntries[name] = true;
      if (channel === "B") bEntries[name] = true;
      if (channel === "PAN") panEntries.push(name);
      if (channel === "L") lumEntries.push(name);
   }

   // Sort R entries alphabetically before grouping
   rEntries.sort(function(a, b) {
      return a < b ? -1 : (a > b ? 1 : 0);
   });

   // For each R entry, derive expected G and B names
   for (var i = 0; i < rEntries.length; i++) {
      var rName = rEntries[i];
      var gName = null;
      var bName = null;
      var groupLabel = null;

      // Pattern 1: Sony CMOS pre-combined
      if (rName.indexOf("Sony CMOS R-UVIRcut") === 0) {
         gName = rName.replace("Sony CMOS R-UVIRcut", "Sony CMOS G-UVIRcut");
         bName = rName.replace("Sony CMOS R-UVIRcut", "Sony CMOS B-UVIRcut");
         var slashIdx = rName.indexOf(" / ");
         groupLabel = slashIdx >= 0
            ? "Sony CMOS / " + rName.substring(slashIdx + 3)
            : rName;
      }
      // Pattern 2: Canon Full Spectrum
      else if (rName.indexOf("Canon Full Spectrum R") === 0) {
         gName = rName.replace("Canon Full Spectrum R", "Canon Full Spectrum G");
         bName = rName.replace("Canon Full Spectrum R", "Canon Full Spectrum B");
         var slashIdx = rName.indexOf(" / ");
         groupLabel = slashIdx >= 0
            ? "Canon FS / " + rName.substring(slashIdx + 3)
            : "Canon Full Spectrum";
      }
      // Pattern 3: Sony Color Sensor variants
      else if (rName.indexOf("Sony Color Sensor R") === 0) {
         gName = rName.replace("Sony Color Sensor R", "Sony Color Sensor G");
         bName = rName.replace("Sony Color Sensor R", "Sony Color Sensor B");
         var suffix = rName.substring("Sony Color Sensor R".length);
         groupLabel = "Sony Color Sensor" + (suffix ? " " + suffix.replace(/^-/, "") : "");
      }
      // Pattern 4: Seestar "-R" suffix
      else if (rName.match(/-R$/)) {
         gName = rName.replace(/-R$/, "-G");
         bName = rName.replace(/-R$/, "-B");
         groupLabel = rName.replace(/-R$/, "");
      }
      // Pattern 5: Standard " R" suffix
      else if (rName.match(/ R$/)) {
         gName = rName.replace(/ R$/, " G");
         bName = rName.replace(/ R$/, " B");
         groupLabel = rName.replace(/ R$/, "");
         // Johnson edge case: "V" instead of "G"
         if (!gEntries[gName] && gEntries[rName.replace(/ R$/, " V")])
            gName = rName.replace(/ R$/, " V");
      }
      else {
         console.writeln("  WARNING: Cannot group R entry: " + rName);
         continue;
      }

      // Verify G and B exist
      if (!gEntries[gName]) {
         console.writeln("  WARNING: Missing G for: " + rName + " (expected: " + gName + ")");
         continue;
      }
      if (!bEntries[bName]) {
         console.writeln("  WARNING: Missing B for: " + rName + " (expected: " + bName + ")");
         continue;
      }

      var type = (rName.indexOf(" / ") >= 0) ? "precombined" : "broadband";

      filterList.push({
         label: groupLabel,
         type: type,
         redName: rName,
         greenName: gName,
         blueName: bName
      });
   }

   // Sort: broadband first, then precombined
   filterList.sort(function(a, b) {
      var typeOrder = { broadband: 0, precombined: 1 };
      var ta = typeOrder[a.type];
      var tb = typeOrder[b.type];
      if (ta !== tb) return ta - tb;
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   // --- GRAY FILTERS: PAN and L entries, own dropdown ---
   grayFilterList = [];
   for (var i = 0; i < panEntries.length; i++)
      grayFilterList.push({ label: panEntries[i] + " (PAN)", name: panEntries[i], channel: "PAN" });
   for (var i = 0; i < lumEntries.length; i++)
      grayFilterList.push({ label: lumEntries[i] + " (L)", name: lumEntries[i], channel: "L" });
   grayFilterList.sort(function(a, b) {
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   console.writeln("  RGB filter sets found: " + filterList.length);
   console.writeln("    Broadband RGB: " + filterList.filter(function(f){return f.type==="broadband";}).length);
   console.writeln("    Pre-combined:  " + filterList.filter(function(f){return f.type==="precombined";}).length);
   console.writeln("  Gray filters found: " + grayFilterList.length);
   console.writeln("    PAN filters:   " + panEntries.length);
   console.writeln("    L filters:     " + lumEntries.length);
   console.writeln("");

   if (filterList.length === 0)
      throw new Error("No RGB filter sets found in the filter database.");
   if (grayFilterList.length === 0)
      throw new Error("No PAN/L (gray) filters found in the filter database.");
}

// ============================================================
// Collapsible SectionBar dialog with:
//   1. ImageSolve section (blind solve checkbox + index status inside)
//   2. SPFC section (White Ref, Camera, Filter dropdowns inside)
//   3. Previews section (number of previews dropdown inside)
//   4. MGC section (4 gradient scale dropdowns inside, greyed by count)
//   5. GradientCorrection section
//   6. DynamicBackgroundExtraction section
// Bottom bar: New Instance, User Guide, Deselect All, Reset Defaults,
// Reset Settings, OK, Cancel
// ============================================================

var SpaceHunterDialog = class extends Dialog {
constructor()
{
   super();

   var dlg = this;

   let labelWidth = this.font.width( "White Reference:" + "MM" );

   // -----------------------------------------------------------------
   // Title / Help Label
   // -----------------------------------------------------------------

   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle = FrameStyle.Box;
   this.helpLabel.minWidth = 45 * this.font.width( 'M' );
   this.helpLabel.margin = 6;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<p><b>" + SCRIPT_NAME + " " + SCRIPT_VERSION + "</b> &mdash; " +
      "Smart Image Solve, SPFC, Previews, MGC, GC &amp; cDBE workflow for OSC camera images.<br/>" +
      "Copyright &copy; 2026 Georg G Albrecht. MIT License.</p>"

   // -----------------------------------------------------------------
   // Toggle section handler (resizes dialog when collapsing/expanding)
   // -----------------------------------------------------------------

   function toggleSectionHandler( section, toggleBegin )
   {
      if ( !toggleBegin )
      {
         dlg.setVariableHeight();
         dlg.adjustToContents();
         dlg.setMinHeight();
      }
   }

   // -----------------------------------------------------------------
   // Helper: update enabled states based on dependencies
   // -----------------------------------------------------------------

   // MGC (with SPFC), GC and DBE are alternative workflows. Ticking one
   // unticks the others first, so the box just clicked always wins instead
   // of being overridden by updateDependencies().
   this.selectWorkflow = function( mode )
   {
      if ( mode !== "gc" && WorkflowParameters.enableGC )
      {
         WorkflowParameters.enableGC = false;
         dlg.gc_Section.checkBox.checked = false;
         dlg.gc_Control.enabled = false;
      }
      if ( mode !== "dbe" && WorkflowParameters.enableDBE )
      {
         WorkflowParameters.enableDBE = false;
         dlg.dbe_Section.checkBox.checked = false;
         dlg.dbe_Control.enabled = false;
      }
   };

   this.updateDependencies = function()
   {
      // MGC checked -> auto-enable SPFC + Previews
      if ( WorkflowParameters.enableMGC )
      {
         if ( !WorkflowParameters.enableSPFC )
         {
            WorkflowParameters.enableSPFC = true;
            dlg.spfc_Section.checkBox.checked = true;
            dlg.spfc_Control.enabled = true;
         }
         if ( !WorkflowParameters.enablePreviews )
         {
            WorkflowParameters.enablePreviews = true;
            dlg.previews_Section.checkBox.checked = true;
            dlg.previews_Control.enabled = true;
         }
      }

      // SPFC checked -> auto-enable ImageSolve
      if ( WorkflowParameters.enableSPFC )
      {
         if ( !WorkflowParameters.enableImageSolve )
         {
            WorkflowParameters.enableImageSolve = true;
            dlg.imageSolve_Section.checkBox.checked = true;
            dlg.imageSolve_Control.enabled = true;
         }
         WorkflowParameters.enableBlindSolve = true;
         dlg.blindSolve_CheckBox.checked = true;
         dlg.blindSolve_CheckBox.enabled = true;
      }

      // Blind solve requires ImageSolve
      dlg.blindSolve_CheckBox.enabled = WorkflowParameters.enableImageSolve;
      if ( !WorkflowParameters.enableImageSolve )
      {
         WorkflowParameters.enableBlindSolve = false;
         dlg.blindSolve_CheckBox.checked = false;
      }

      // GC manually enabled -> ImageSolve + blind solve on, SPFC off, MGC off,
      // Previews off. GC always makes its own 2 previews (GC_, GC_1); the
      // MGC preview count is left alone and comes back with MGC.
      if ( WorkflowParameters.enableGC )
      {
         if ( !WorkflowParameters.enableImageSolve )
         {
         WorkflowParameters.enableImageSolve = true;
         dlg.imageSolve_Section.checkBox.checked = true;
         dlg.imageSolve_Control.enabled = true;
         WorkflowParameters.enableBlindSolve = true;
         dlg.blindSolve_CheckBox.checked = true;
         dlg.blindSolve_CheckBox.enabled = true;
         }
         WorkflowParameters.enableSPFC = false;
         dlg.spfc_Section.checkBox.checked = false;
         dlg.spfc_Control.enabled = false;
         WorkflowParameters.enableMGC = false;
         dlg.mgc_Section.checkBox.checked = false;
         dlg.mgc_Control.enabled = false;
         WorkflowParameters.enablePreviews = false;
         dlg.previews_Section.checkBox.checked = false;
         dlg.previews_Control.enabled = false;
         // Disable DBE when GC is on
         WorkflowParameters.enableDBE = false;
         dlg.dbe_Section.checkBox.checked = false;
         dlg.dbe_Control.enabled = false;
      }

      // DBE manually enabled -> ImageSolve on, SPFC off, MGC off, GC off, Previews off
      if ( WorkflowParameters.enableDBE )
      {
         if ( !WorkflowParameters.enableImageSolve )
         {
         WorkflowParameters.enableImageSolve = true;
         dlg.imageSolve_Section.checkBox.checked = true;
         dlg.imageSolve_Control.enabled = true;
         WorkflowParameters.enableBlindSolve = true;
         dlg.blindSolve_CheckBox.checked = true;
         dlg.blindSolve_CheckBox.enabled = true;
         }
         WorkflowParameters.enableSPFC = false;
         dlg.spfc_Section.checkBox.checked = false;
         dlg.spfc_Control.enabled = false;
         WorkflowParameters.enableMGC = false;
         dlg.mgc_Section.checkBox.checked = false;
         dlg.mgc_Control.enabled = false;
         WorkflowParameters.enableGC = false;
         dlg.gc_Section.checkBox.checked = false;
         dlg.gc_Control.enabled = false;
         WorkflowParameters.enablePreviews = false;
         dlg.previews_Section.checkBox.checked = false;
         dlg.previews_Control.enabled = false;
      }
      // Blind solve requires ImageSolve
      dlg.blindSolve_CheckBox.enabled = WorkflowParameters.enableImageSolve;
      if ( !WorkflowParameters.enableImageSolve )
      {
         WorkflowParameters.enableBlindSolve = false;
         dlg.blindSolve_CheckBox.checked = false;
      }

      // Update MGC gradient scale dropdown enabled states
      dlg.updateGradientScaleStates();
   };

   // -----------------------------------------------------------------
   // Helper: update which gradient scale dropdowns are active
   // -----------------------------------------------------------------

   this.updateGradientScaleStates = function()
   {
      for ( var i = 0; i < 4; i++ )
      {
         var active = ( i < WorkflowParameters.numPreviews ) && WorkflowParameters.enableMGC;
         dlg.gradientScaleCombo[i].enabled = active;
         dlg.gradientScaleLabel[i].enabled = active;
      }
   };

   // =================================================================
   // SECTION 1: ImageSolve
   // =================================================================

   // Blind solve checkbox
   this.blindSolve_CheckBox = new CheckBox( this );
   this.blindSolve_CheckBox.text = "Blind solve (if needed)";
   this.blindSolve_CheckBox.checked = WorkflowParameters.enableBlindSolve;
   this.blindSolve_CheckBox.toolTip = "<p>Let ImageSolver find the position and scale from the stars alone " +
      "when the image has no RA/Dec or image scale, or when solving with them fails.<br/>" +
      "Needs the astrometric index file set in the Gaia process preferences.<br/>" +
      "Requires ImageSolver to be enabled.</p>";
   this.blindSolve_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableBlindSolve = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // ImageSolve section content control
   this.imageSolve_Control = new Control( this );
   this.imageSolve_Control.sizer = new VerticalSizer;
   this.imageSolve_Control.sizer.margin = 6;
   this.imageSolve_Control.sizer.spacing = 4;
   this.blindSolve_Sizer = new HorizontalSizer;
   this.blindSolve_Sizer.addSpacing( 44 );
   this.blindSolve_Sizer.add( this.blindSolve_CheckBox );
   this.blindSolve_Sizer.addStretch();
   this.imageSolve_Control.sizer.add( this.blindSolve_Sizer );

   // Astrometric index status (read once when the dialog opens)
   var indexPath = shAstrometricIndexPath();
   this.indexStatus_Label = new Label( this );
   this.indexStatus_Label.useRichText = true;
   this.indexStatus_Label.text = indexPath.length > 0 ?
      "Astrometric index: " + File.extractNameAndExtension( indexPath ) :
      "<b>No astrometric index set</b> - blind solve not available";
   this.indexStatus_Label.toolTip = "<p>Blind solving needs the Gaia astrometric index file " +
      "(gdr3-idx-1.0.0-g17.xpsd, from the PixInsight Software Distribution), " +
      "set as Astrometric Index File in Process &gt; Astrometry &gt; Gaia, Preferences (wrench icon).<br/>" +
      "Images with RA/Dec and image scale (XPIXSZ + FOCALLEN) solve without it.</p>";
   this.indexStatus_Sizer = new HorizontalSizer;
   this.indexStatus_Sizer.addSpacing( 64 );
   this.indexStatus_Sizer.add( this.indexStatus_Label );
   this.indexStatus_Sizer.addStretch();
   this.imageSolve_Control.sizer.add( this.indexStatus_Sizer );

   // ImageSolve SectionBar with enable checkbox
   this.imageSolve_Section = new SectionBar( this, "ImageSolve" );
   this.imageSolve_Section.setSection( this.imageSolve_Control );
   this.imageSolve_Section.enableCheckBox( true );
   this.imageSolve_Section.checkBox.checked = WorkflowParameters.enableImageSolve;
   this.imageSolve_Section.checkBox.toolTip = "<p>Enable/disable plate solving via ImageSolver.<br/>" +
      "Can run standalone or as prerequisite for SPFC.</p>";

   this.imageSolve_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableImageSolve = sectionbar.checkBox.checked;
      dlg.imageSolve_Control.enabled = WorkflowParameters.enableImageSolve;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.imageSolve_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 2: SPFC
   // =================================================================

   // White Reference dropdown
   this.whiteRef_Label = new Label( this );
   this.whiteRef_Label.text = "White Reference:";
   this.whiteRef_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.whiteRef_Label.setFixedWidth( labelWidth );

   this.whiteRef_ComboBox = new ComboBox( this );
   this.whiteRef_ComboBox.editEnabled = false;
   for ( var i = 0; i < whiteRefList.length; i++ )
      this.whiteRef_ComboBox.addItem( whiteRefList[i].label );
   this.whiteRef_ComboBox.currentItem = WorkflowParameters.selectedWhiteRefIdx;
   this.whiteRef_ComboBox.toolTip = "<p>Select white reference for spectrophotometric calibration.</p>";
   this.whiteRef_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedWhiteRefIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.whiteRef_Label.visible = false;
   this.whiteRef_ComboBox.visible = false;

   this.whiteRef_Sizer = new HorizontalSizer;
   this.whiteRef_Sizer.spacing = 6;
   this.whiteRef_Sizer.add( this.whiteRef_Label );
   this.whiteRef_Sizer.add( this.whiteRef_ComboBox, 100 );

   // Camera dropdown
   this.camera_Label = new Label( this );
   this.camera_Label.text = "Camera / Sensor:";
   this.camera_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.camera_Label.setFixedWidth( labelWidth );

   this.camera_ComboBox = new ComboBox( this );
   this.camera_ComboBox.editEnabled = false;
   for ( var i = 0; i < cameraList.length; i++ )
      this.camera_ComboBox.addItem( cameraList[i].label );
   this.camera_ComboBox.currentItem = WorkflowParameters.selectedCameraIdx;
   this.camera_ComboBox.toolTip = "<p>Select camera sensor for QE curve lookup.</p>";
   this.camera_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedCameraIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.camera_Sizer = new HorizontalSizer;
   this.camera_Sizer.spacing = 6;
   this.camera_Sizer.add( this.camera_Label );
   this.camera_Sizer.add( this.camera_ComboBox, 100 );

   // Gray filter dropdown (PAN / L curves)
   this.grayFilter_Label = new Label( this );
   this.grayFilter_Label.text = "Gray filter:";
   this.grayFilter_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.grayFilter_Label.setFixedWidth( labelWidth );

   this.grayFilter_ComboBox = new ComboBox( this );
   this.grayFilter_ComboBox.editEnabled = false;
   for ( var i = 0; i < grayFilterList.length; i++ )
      this.grayFilter_ComboBox.addItem( grayFilterList[i].label );
   this.grayFilter_ComboBox.currentItem = WorkflowParameters.selectedGrayIdx;
   this.grayFilter_ComboBox.toolTip = "<p>SPFC <b>Gray filter</b>: the single-curve (PAN or L) " +
      "filter in front of the camera, e.g. Optolong L-Quad Enhance. With no filter, or a plain " +
      "UV/IR cut, keep Astronomik UV-IR Block L-2.</p>";
   this.grayFilter_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedGrayIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.grayFilter_Sizer = new HorizontalSizer;
   this.grayFilter_Sizer.spacing = 6;
   this.grayFilter_Sizer.add( this.grayFilter_Label );
   this.grayFilter_Sizer.add( this.grayFilter_ComboBox, 100 );

   // RGB filter set dropdown
   this.filter_Label = new Label( this );
   this.filter_Label.text = "RGB filters:";
   this.filter_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.filter_Label.setFixedWidth( labelWidth );

   this.filter_ComboBox = new ComboBox( this );
   this.filter_ComboBox.editEnabled = false;
   for ( var i = 0; i < filterList.length; i++ )
      this.filter_ComboBox.addItem( filterList[i].label );
   this.filter_ComboBox.currentItem = WorkflowParameters.selectedFilterIdx;
   this.filter_ComboBox.toolTip = "<p>SPFC <b>Red/Green/Blue filters</b>: the set of three " +
      "channel curves, e.g. Optolong L-Quad (R/G/B) or Sony Color Sensor.</p>";
   this.filter_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedFilterIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.filter_Sizer = new HorizontalSizer;
   this.filter_Sizer.spacing = 6;
   this.filter_Sizer.add( this.filter_Label );
   this.filter_Sizer.add( this.filter_ComboBox, 100 );

   this.filter_Control = new Control( this );
   this.filter_Control.sizer = new VerticalSizer;
   this.filter_Control.sizer.spacing = 6;
   this.filter_Control.sizer.add( this.grayFilter_Sizer );
   this.filter_Control.sizer.add( this.filter_Sizer );
   this.filter_Control.visible = !WorkflowParameters.enableNarrowband;

   // SPFC section content control
   // Narrowband checkbox
   this.narrowband_CheckBox = new CheckBox( this );
   this.narrowband_CheckBox.text = "Narrowband filters mode";
   this.narrowband_CheckBox.checked = WorkflowParameters.enableNarrowband;
   this.narrowband_CheckBox.toolTip = "<p>Enable narrowband mode for SPFC. " +
      "Enter center wavelength and bandwidth for each channel.</p>";
   this.narrowband_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableNarrowband = checked;
      dlg.nbRows_Control.visible = checked;
      dlg.filter_Control.visible = !checked;
      dlg.adjustToContents();
      WorkflowParameters.saveUserPrefs();
   };

   this.narrowband_Sizer = new HorizontalSizer;
   this.narrowband_Sizer.spacing = 6;
   this.narrowband_Sizer.addUnscaledSpacing( labelWidth + 6 );
   this.narrowband_Sizer.add( this.narrowband_CheckBox );
   this.narrowband_Sizer.addStretch();

   // Generate graphs checkbox
   this.spfcGraphs_CheckBox = new CheckBox( this );
   this.spfcGraphs_CheckBox.text = "Generate graphs";
   this.spfcGraphs_CheckBox.checked = WorkflowParameters.generateSPFCGraphs;
   this.spfcGraphs_CheckBox.toolTip = "<p>Show SPFC's calibration graphs after it runs.</p>";
   this.spfcGraphs_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.generateSPFCGraphs = checked;
      WorkflowParameters.saveUserPrefs();
   };

   this.spfcGraphs_Sizer = new HorizontalSizer;
   this.spfcGraphs_Sizer.spacing = 6;
   this.spfcGraphs_Sizer.addUnscaledSpacing( labelWidth + 6 );
   this.spfcGraphs_Sizer.add( this.spfcGraphs_CheckBox );
   this.spfcGraphs_Sizer.addStretch();

   // Narrowband wavelength/bandwidth rows

   // Header row
   this.nbHeader_Sizer = new HorizontalSizer;
   this.nbHeader_Sizer.spacing = 6;
   this.nbHeader_Sizer.addUnscaledSpacing( labelWidth + 6 );
   var nbWaveLabel = new Label( this );
   nbWaveLabel.text = "Wavelength (nm)";
   // Column width from the font, so "Wavelength (nm)" fits at any display
   // scaling; the wavelength edits below use the same width to stay aligned.
   var nbColW = Math.max( 120, this.font.width( "Wavelength (nm)" ) + 12 );
   nbWaveLabel.setFixedWidth( nbColW );
   var nbBwLabel = new Label( this );
   nbBwLabel.text = "Bandwidth (nm)";
   this.nbHeader_Sizer.add( nbWaveLabel );
   this.nbHeader_Sizer.add( nbBwLabel );
   this.nbHeader_Sizer.addStretch();

   // Red row
   this.nbRedLabel = new Label( this );
   this.nbRedLabel.text = "Red filter:";
   this.nbRedLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.nbRedLabel.setFixedWidth( labelWidth );
   this.nbRedWave_Edit = new Edit( this );
   this.nbRedWave_Edit.text = WorkflowParameters.nbRedWavelength.toFixed(2);
   this.nbRedWave_Edit.setFixedWidth( nbColW );
   this.nbRedWave_Edit.toolTip = "<p>Common emission line wavelengths (nm):<br/>" +
      "H&alpha; &mdash; 656.3<br/>H&beta; &mdash; 486.1<br/>OIII &mdash; 500.7<br/>SII &mdash; 671.6</p>";
   this.nbRedWave_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbRedWavelength = v;
      else this.text = WorkflowParameters.nbRedWavelength.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbRedBw_Edit = new Edit( this );
   this.nbRedBw_Edit.text = WorkflowParameters.nbRedBandwidth.toFixed(2);
   this.nbRedBw_Edit.setFixedWidth( 80 );
   this.nbRedBw_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbRedBandwidth = v;
      else this.text = WorkflowParameters.nbRedBandwidth.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbRed_Sizer = new HorizontalSizer;
   this.nbRed_Sizer.spacing = 6;
   this.nbRed_Sizer.add( this.nbRedLabel );
   this.nbRed_Sizer.add( this.nbRedWave_Edit );
   this.nbRed_Sizer.add( this.nbRedBw_Edit );
   this.nbRed_Sizer.addStretch();

   // Green row
   this.nbGreenLabel = new Label( this );
   this.nbGreenLabel.text = "Green filter:";
   this.nbGreenLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.nbGreenLabel.setFixedWidth( labelWidth );
   this.nbGreenWave_Edit = new Edit( this );
   this.nbGreenWave_Edit.text = WorkflowParameters.nbGreenWavelength.toFixed(2);
   this.nbGreenWave_Edit.setFixedWidth( nbColW );
   this.nbGreenWave_Edit.toolTip = "<p>Common emission line wavelengths (nm):<br/>" +
      "H&alpha; &mdash; 656.3<br/>H&beta; &mdash; 486.1<br/>OIII &mdash; 500.7<br/>SII &mdash; 671.6</p>";
   this.nbGreenWave_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbGreenWavelength = v;
      else this.text = WorkflowParameters.nbGreenWavelength.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbGreenBw_Edit = new Edit( this );
   this.nbGreenBw_Edit.text = WorkflowParameters.nbGreenBandwidth.toFixed(2);
   this.nbGreenBw_Edit.setFixedWidth( 80 );
   this.nbGreenBw_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbGreenBandwidth = v;
      else this.text = WorkflowParameters.nbGreenBandwidth.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbGreen_Sizer = new HorizontalSizer;
   this.nbGreen_Sizer.spacing = 6;
   this.nbGreen_Sizer.add( this.nbGreenLabel );
   this.nbGreen_Sizer.add( this.nbGreenWave_Edit );
   this.nbGreen_Sizer.add( this.nbGreenBw_Edit );
   this.nbGreen_Sizer.addStretch();

   // Blue row
   this.nbBlueLabel = new Label( this );
   this.nbBlueLabel.text = "Blue filter:";
   this.nbBlueLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.nbBlueLabel.setFixedWidth( labelWidth );
   this.nbBlueWave_Edit = new Edit( this );
   this.nbBlueWave_Edit.text = WorkflowParameters.nbBlueWavelength.toFixed(2);
   this.nbBlueWave_Edit.setFixedWidth( nbColW );
   this.nbBlueWave_Edit.toolTip = "<p>Common emission line wavelengths (nm):<br/>" +
      "H&alpha; &mdash; 656.3<br/>H&beta; &mdash; 486.1<br/>OIII &mdash; 500.7<br/>SII &mdash; 671.6</p>";
   this.nbBlueWave_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbBlueWavelength = v;
      else this.text = WorkflowParameters.nbBlueWavelength.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbBlueBw_Edit = new Edit( this );
   this.nbBlueBw_Edit.text = WorkflowParameters.nbBlueBandwidth.toFixed(2);
   this.nbBlueBw_Edit.setFixedWidth( 80 );
   this.nbBlueBw_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v > 0 ) WorkflowParameters.nbBlueBandwidth = v;
      else this.text = WorkflowParameters.nbBlueBandwidth.toFixed(2);
      WorkflowParameters.saveUserPrefs();
   };
   this.nbBlue_Sizer = new HorizontalSizer;
   this.nbBlue_Sizer.spacing = 6;
   this.nbBlue_Sizer.add( this.nbBlueLabel );
   this.nbBlue_Sizer.add( this.nbBlueWave_Edit );
   this.nbBlue_Sizer.add( this.nbBlueBw_Edit );
   this.nbBlue_Sizer.addStretch();

   // Ha/OIII separation (dual-band OSC): removes the Ha that leaks into the
   // G and B pixels before SPFC measures them. Factors depend on the
   // camera/filter combination, so they are entered by the user.
   this.separation_CheckBox = new CheckBox( this );
   this.separation_CheckBox.text = "Ha/OIII separation before SPFC";
   this.separation_CheckBox.checked = WorkflowParameters.enableSeparation;
   this.separation_CheckBox.toolTip = "<p>For dual-band filters on OSC cameras: H&alpha; also reaches " +
      "the green and blue pixels. This step subtracts it before SPFC:</p>" +
      "<p>G = G &minus; k<sub>G</sub> &times; (R &minus; med(R))<br/>" +
      "B = B &minus; k<sub>B</sub> &times; (R &minus; med(R))</p>" +
      "<p>The factors are fixed for one camera + filter combination. " +
      "Runs once per image (skipped on a re-run).</p>";
   this.separation_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableSeparation = checked;
      dlg.sepRows_Control.enabled = checked;
      WorkflowParameters.saveUserPrefs();
   };

   this.separation_Sizer = new HorizontalSizer;
   this.separation_Sizer.spacing = 6;
   this.separation_Sizer.addUnscaledSpacing( labelWidth + 6 );
   this.separation_Sizer.add( this.separation_CheckBox );
   this.separation_Sizer.addStretch();

   // --- Profiles: one .txt file per camera/filter in a user folder ---
   // A saved profile is reloaded from its file at every start, so the file
   // is the reference; the kG/kB boxes show what will be applied.
   if ( WorkflowParameters.sepProfileName !== "" )
   {
      try {
         var prof = readSeparationProfile( WorkflowParameters.sepProfileFolder + "/" +
                                           WorkflowParameters.sepProfileName );
         WorkflowParameters.sepGreenFactor = prof.kG;
         WorkflowParameters.sepBlueFactor  = prof.kB;
      } catch ( e ) {
         console.warningln( "⚠  Separation profile '" + WorkflowParameters.sepProfileName +
                            "' not loaded: " + e.message + " - using the last factors." );
         WorkflowParameters.sepProfileName = "";
      }
   }

   this.sepFolder_Label = new Label( this );
   this.sepFolder_Label.text = "Profile folder:";
   this.sepFolder_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sepFolder_Label.setFixedWidth( labelWidth );
   this.sepFolder_Edit = new Edit( this );
   this.sepFolder_Edit.readOnly = true;
   this.sepFolder_Edit.text = WorkflowParameters.sepProfileFolder;
   this.sepFolder_Edit.toolTip = "<p>Folder with your camera/filter separation profiles (.txt).</p>";
   this.sepFolder_Button = new ToolButton( this );
   this.sepFolder_Button.icon = this.scaledResource( ":/icons/select-file.png" );
   this.sepFolder_Button.setScaledFixedSize( 24, 24 );
   this.sepFolder_Button.toolTip = "<p>Choose the profile folder.</p>";
   this.sepFolder_Button.onClick = function()
   {
      var d = new GetDirectoryDialog;
      d.caption = "Separation profile folder";
      if ( WorkflowParameters.sepProfileFolder !== "" )
         d.initialPath = WorkflowParameters.sepProfileFolder;
      if ( d.execute() )
      {
         WorkflowParameters.sepProfileFolder = d.directory;
         WorkflowParameters.sepProfileName = "";
         dlg.sepFolder_Edit.text = d.directory;
         dlg.fillProfileList();
         WorkflowParameters.saveUserPrefs();
      }
   };
   this.sepFolder_Sizer = new HorizontalSizer;
   this.sepFolder_Sizer.spacing = 6;
   this.sepFolder_Sizer.add( this.sepFolder_Label );
   this.sepFolder_Sizer.add( this.sepFolder_Edit, 100 );
   this.sepFolder_Sizer.add( this.sepFolder_Button );

   this.sepProfile_Label = new Label( this );
   this.sepProfile_Label.text = "Profile:";
   this.sepProfile_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sepProfile_Label.setFixedWidth( labelWidth );
   this.sepProfile_ComboBox = new ComboBox( this );
   this.sepProfile_ComboBox.editEnabled = false;
   this.sepProfile_ComboBox.toolTip = "<p>Camera/filter profile. Choosing one fills in its factors.<br/>" +
      "Accepted files: saved by this script (kG = ... / kB = ...), or PixelMath's " +
      "<i>Edit Instance Source Code</i> pasted into a .txt file.<br/>" +
      "Profile files are only read, never executed.</p>";
   this.sepProfile_ComboBox.onItemSelected = function( index )
   {
      if ( index === 0 )
      {
         WorkflowParameters.sepProfileName = "";
         WorkflowParameters.saveUserPrefs();
         return;
      }
      var name = dlg.sepProfileNames[index - 1];
      try {
         var prof = readSeparationProfile( WorkflowParameters.sepProfileFolder + "/" + name );
         WorkflowParameters.sepProfileName = name;
         WorkflowParameters.sepGreenFactor = prof.kG;
         WorkflowParameters.sepBlueFactor  = prof.kB;
         dlg.sepGreen_Edit.text = prof.kG.toFixed(3);
         dlg.sepBlue_Edit.text  = prof.kB.toFixed(3);
      } catch ( e ) {
         (new MessageBox( "<p><b>" + name + "</b></p><p>" + e.message + "</p>",
            "Profile not loaded", StdIcon.Warning, StdButton.Ok )).execute();
         WorkflowParameters.sepProfileName = "";
         dlg.sepProfile_ComboBox.currentItem = 0;
      }
      WorkflowParameters.saveUserPrefs();
   };

   this.sepSave_Button = new PushButton( this );
   this.sepSave_Button.text = "Save profile...";
   this.sepSave_Button.toolTip = "<p>Save the current kG / kB as a profile file " +
      "(name it after your camera and filter, e.g. IMX571_ALP-T).</p>";
   this.sepSave_Button.onClick = function()
   {
      var d = new SaveFileDialog;
      d.caption = "Save separation profile";
      var base = ( WorkflowParameters.sepProfileName !== "" ) ? WorkflowParameters.sepProfileName
                                                              : "Camera_Filter.txt";
      d.initialPath = ( WorkflowParameters.sepProfileFolder !== "" )
                      ? WorkflowParameters.sepProfileFolder + "/" + base : base;
      d.filters = [ [ "Text files", "*.txt" ] ];
      d.overwritePrompt = true;
      if ( !d.execute() )
         return;
      var path = d.filePath;
      if ( File.extractExtension( path ).toLowerCase() !== ".txt" )
      {
         // The dialog asked about the name as typed, not with .txt added.
         path += ".txt";
         if ( File.exists( path ) &&
              (new MessageBox( "<p>" + File.extractName( path ) + ".txt already exists.</p>" +
                               "<p>Replace it?</p>",
                               "Save separation profile", StdIcon.Warning,
                               StdButton.Yes, StdButton.No )).execute() !== StdButton.Yes )
            return;
      }
      try {
         writeSeparationProfile( path, WorkflowParameters.sepGreenFactor,
                                       WorkflowParameters.sepBlueFactor );
      } catch ( e ) {
         (new MessageBox( "<p>Could not save the profile:</p><p>" + e.message + "</p>",
            "Save failed", StdIcon.Error, StdButton.Ok )).execute();
         return;
      }
      WorkflowParameters.sepProfileFolder = File.extractDrive( path ) + File.extractDirectory( path );
      WorkflowParameters.sepProfileName = File.extractName( path ) + File.extractExtension( path );
      dlg.sepFolder_Edit.text = WorkflowParameters.sepProfileFolder;
      dlg.fillProfileList();
      WorkflowParameters.saveUserPrefs();
      console.writeln( "Separation profile saved: " + path );
   };

   this.sepProfile_Sizer = new HorizontalSizer;
   this.sepProfile_Sizer.spacing = 6;
   this.sepProfile_Sizer.add( this.sepProfile_Label );
   this.sepProfile_Sizer.add( this.sepProfile_ComboBox, 100 );
   this.sepProfile_Sizer.add( this.sepSave_Button );

   // Rebuild the profile list from the folder and select the saved profile.
   this.fillProfileList = function()
   {
      dlg.sepProfileNames = listSeparationProfiles( WorkflowParameters.sepProfileFolder );
      dlg.sepProfile_ComboBox.clear();
      dlg.sepProfile_ComboBox.addItem( dlg.sepProfileNames.length > 0 ? "(manual values)"
                                       : "(no profiles in folder - manual values)" );
      var sel = 0;
      for ( var i = 0; i < dlg.sepProfileNames.length; i++ )
      {
         dlg.sepProfile_ComboBox.addItem( File.extractName( dlg.sepProfileNames[i] ) );
         if ( dlg.sepProfileNames[i] === WorkflowParameters.sepProfileName )
            sel = i + 1;
      }
      if ( sel === 0 )
         WorkflowParameters.sepProfileName = "";
      dlg.sepProfile_ComboBox.currentItem = sel;
   };

   var sepFactorTip = "<p>Find it on a preview: start high (e.g. 0.5, the nebula turns " +
      "dark in this channel) and lower it until the H&alpha; structures just disappear.<br/>" +
      "0 = no correction for this channel. Typing a value switches to manual values; " +
      "use <i>Save profile</i> to keep it.</p>";

   // A typed factor no longer matches the profile file.
   var sepManualEdit = function()
   {
      if ( WorkflowParameters.sepProfileName !== "" )
      {
         WorkflowParameters.sepProfileName = "";
         dlg.sepProfile_ComboBox.currentItem = 0;
      }
   };

   this.sepGreen_Label = new Label( this );
   this.sepGreen_Label.text = "Green factor (kG):";
   this.sepGreen_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sepGreen_Label.setFixedWidth( labelWidth );
   this.sepGreen_Edit = new Edit( this );
   this.sepGreen_Edit.text = WorkflowParameters.sepGreenFactor.toFixed(3);
   this.sepGreen_Edit.setFixedWidth( 80 );
   this.sepGreen_Edit.toolTip = sepFactorTip;
   this.sepGreen_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v >= 0 && v <= 1 && v !== WorkflowParameters.sepGreenFactor )
      {
         WorkflowParameters.sepGreenFactor = v;
         sepManualEdit();
      }
      this.text = WorkflowParameters.sepGreenFactor.toFixed(3);
      WorkflowParameters.saveUserPrefs();
   };
   this.sepGreen_Sizer = new HorizontalSizer;
   this.sepGreen_Sizer.spacing = 6;
   this.sepGreen_Sizer.add( this.sepGreen_Label );
   this.sepGreen_Sizer.add( this.sepGreen_Edit );
   this.sepGreen_Sizer.addStretch();

   this.sepBlue_Label = new Label( this );
   this.sepBlue_Label.text = "Blue factor (kB):";
   this.sepBlue_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sepBlue_Label.setFixedWidth( labelWidth );
   this.sepBlue_Edit = new Edit( this );
   this.sepBlue_Edit.text = WorkflowParameters.sepBlueFactor.toFixed(3);
   this.sepBlue_Edit.setFixedWidth( 80 );
   this.sepBlue_Edit.toolTip = sepFactorTip;
   this.sepBlue_Edit.onEditCompleted = function()
   {
      var v = parseFloat( this.text );
      if ( !isNaN(v) && v >= 0 && v <= 1 && v !== WorkflowParameters.sepBlueFactor )
      {
         WorkflowParameters.sepBlueFactor = v;
         sepManualEdit();
      }
      this.text = WorkflowParameters.sepBlueFactor.toFixed(3);
      WorkflowParameters.saveUserPrefs();
   };

   // The dialog is modal: PixelMath can only be used after it closes. This
   // button ends the script and opens PixelMath (see selectEquipment()).
   this.launchPixelMathOnExit = false;
   this.sepPixelMath_Button = new PushButton( this );
   this.sepPixelMath_Button.text = "PixelMath && exit";
   this.sepPixelMath_Button.toolTip = "<p>Closes this dialog <b>without processing</b> and opens " +
      "PixelMath with the separation expressions (factors 0.5 if both are 0).</p>" +
      "<p>Test the factors on a preview, then run this script again, enter the final " +
      "values and click <i>Save profile</i>.</p>";
   this.sepPixelMath_Button.onClick = function()
   {
      WorkflowParameters.saveUserPrefs();
      dlg.launchPixelMathOnExit = true;
      dlg.cancel();
   };

   this.sepBlue_Sizer = new HorizontalSizer;
   this.sepBlue_Sizer.spacing = 6;
   this.sepBlue_Sizer.add( this.sepBlue_Label );
   this.sepBlue_Sizer.add( this.sepBlue_Edit );
   this.sepBlue_Sizer.addSpacing( 12 );
   this.sepBlue_Sizer.add( this.sepPixelMath_Button );
   this.sepBlue_Sizer.addStretch();

   this.sepRows_Control = new Control( this );
   this.sepRows_Control.sizer = new VerticalSizer;
   this.sepRows_Control.sizer.spacing = 4;
   this.sepRows_Control.sizer.add( this.sepFolder_Sizer );
   this.sepRows_Control.sizer.add( this.sepProfile_Sizer );
   this.sepRows_Control.sizer.add( this.sepGreen_Sizer );
   this.sepRows_Control.sizer.add( this.sepBlue_Sizer );
   this.sepRows_Control.enabled = WorkflowParameters.enableSeparation;
   this.fillProfileList();

   // Container for narrowband rows — hidden when narrowband unchecked
   this.nbRows_Control = new Control( this );
   this.nbRows_Control.sizer = new VerticalSizer;
   this.nbRows_Control.sizer.spacing = 4;
   this.nbRows_Control.sizer.add( this.nbHeader_Sizer );
   this.nbRows_Control.sizer.add( this.nbRed_Sizer );
   this.nbRows_Control.sizer.add( this.nbGreen_Sizer );
   this.nbRows_Control.sizer.add( this.nbBlue_Sizer );
   this.nbRows_Control.sizer.addSpacing( 4 );
   this.nbRows_Control.sizer.add( this.separation_Sizer );
   this.nbRows_Control.sizer.add( this.sepRows_Control );
   this.nbRows_Control.visible = WorkflowParameters.enableNarrowband;
   this.filter_Control.visible = !WorkflowParameters.enableNarrowband;

   this.spfc_Control = new Control( this );
   this.spfc_Control.sizer = new VerticalSizer;
   this.spfc_Control.sizer.margin = 6;
   this.spfc_Control.sizer.spacing = 6;
   this.spfc_Control.sizer.add( this.camera_Sizer );
   this.spfc_Control.sizer.add( this.filter_Control );
   this.spfc_Control.sizer.add( this.narrowband_Sizer );
   this.spfc_Control.sizer.add( this.spfcGraphs_Sizer );
   this.spfc_Control.sizer.add( this.nbRows_Control );

   // SPFC SectionBar with enable checkbox
   this.spfc_Section = new SectionBar( this, "SPFC (SpectroPhotometricFluxCalibration)" );
   this.spfc_Section.setSection( this.spfc_Control );
   this.spfc_Section.enableCheckBox( true );
   this.spfc_Section.checkBox.checked = WorkflowParameters.enableSPFC;
   this.spfc_Section.checkBox.toolTip = "<p>Enable/disable SpectroPhotometricFluxCalibration.<br/>" +
      "Requires a valid astrometric solution (ImageSolve).<br/>" +
      "ImageSolve will be skipped if astrometric solution already exists.</p>"

   this.spfc_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableSPFC = sectionbar.checkBox.checked;
      dlg.spfc_Control.enabled = WorkflowParameters.enableSPFC;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      if ( sectionbar.checkBox.checked )
         dlg.selectWorkflow( "mgc" );
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.spfc_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 3: Previews
   // =================================================================

   // Number of previews dropdown
   this.numPreviews_Label = new Label( this );
   this.numPreviews_Label.text = "MGC Previews:";
   this.numPreviews_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.numPreviews_Label.setFixedWidth( labelWidth );

   this.numPreviews_ComboBox = new ComboBox( this );
   this.numPreviews_ComboBox.editEnabled = false;
   this.numPreviews_ComboBox.addItem( "1" );
   this.numPreviews_ComboBox.addItem( "2" );
   this.numPreviews_ComboBox.addItem( "3" );
   this.numPreviews_ComboBox.addItem( "4" );
   this.numPreviews_ComboBox.currentItem = WorkflowParameters.numPreviews - 1;
   this.numPreviews_ComboBox.toolTip = "<p>Select how many full-size previews to create for MGC (1-4).<br/>" +
      "MGC will process each preview with its own gradient scale.<br/>" +
      "GC ignores this setting and always creates its own 2 previews (GC_, GC_1).</p>";
   this.numPreviews_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.numPreviews = index + 1;
      dlg.updateGradientScaleStates();
      WorkflowParameters.saveUserPrefs();
   };

   this.numPreviews_Sizer = new HorizontalSizer;
   this.numPreviews_Sizer.spacing = 6;
   this.numPreviews_Sizer.add( this.numPreviews_Label );
   this.numPreviews_Sizer.add( this.numPreviews_ComboBox );
   this.numPreviews_Sizer.addStretch();

   // Previews section content control
   this.previews_Control = new Control( this );
   this.previews_Control.sizer = new VerticalSizer;
   this.previews_Control.sizer.margin = 6;
   this.previews_Control.sizer.spacing = 4;
   this.previews_Control.sizer.add( this.numPreviews_Sizer );

   // Previews SectionBar with enable checkbox
   this.previews_Section = new SectionBar( this, "Previews (MGC only)" );
   this.previews_Section.setSection( this.previews_Control );
   this.previews_Section.enableCheckBox( true );
   this.previews_Section.checkBox.checked = WorkflowParameters.enablePreviews;
   this.previews_Section.checkBox.toolTip = "<p>Enable/disable creation of the full-size MGC previews " +
      "(one per gradient scale).<br/>GC always creates its own 2 previews.</p>";

   this.previews_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enablePreviews = sectionbar.checkBox.checked;
      dlg.previews_Control.enabled = WorkflowParameters.enablePreviews;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      if ( sectionbar.checkBox.checked )
         dlg.selectWorkflow( "mgc" );
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.previews_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 4: MGC (Multiscale Gradient Correction)
   // =================================================================

   // Create 4 gradient scale dropdowns (greyed out based on numPreviews)
   this.gradientScaleLabel = [];
   this.gradientScaleCombo = [];

   var mgcSizers = [];

   for ( var p = 0; p < 4; p++ )
   {
      var lbl = new Label( this );
      lbl.text = "Gradient Scale " + (p + 1) + ":";
      lbl.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      lbl.setFixedWidth( labelWidth );
      this.gradientScaleLabel.push( lbl );

      var combo = new ComboBox( this );
      combo.editEnabled = false;
      for ( var s = 0; s < GRADIENT_SCALE_VALUES.length; s++ )
         combo.addItem( GRADIENT_SCALE_VALUES[s].toString() );
      combo.currentItem = WorkflowParameters.gradientScaleToComboIndex(
         WorkflowParameters.getGradientScale( p ) );
      combo.toolTip = "<p>Select gradient scale for MGC preview " + (p + 1) + ".</p>";

      // Closure to capture preview index
      (function( previewIdx ) {
         combo.onItemSelected = function( comboIdx )
         {
            WorkflowParameters.setGradientScale( previewIdx, GRADIENT_SCALE_VALUES[comboIdx] );
            WorkflowParameters.saveUserPrefs();
         };
      })( p );

      this.gradientScaleCombo.push( combo );

      var sz = new HorizontalSizer;
      sz.spacing = 6;
      sz.add( lbl );
      sz.add( combo );
      sz.addStretch();
      mgcSizers.push( sz );
   }

   // MGC scale factors: Standard (1.0) / Automatic / Both
   this.mgcScaleMode_Label = new Label( this );
   this.mgcScaleMode_Label.text = "Scale factors:";
   this.mgcScaleMode_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mgcScaleMode_Label.setFixedWidth( labelWidth );

   this.mgcScaleMode_ComboBox = new ComboBox( this );
   this.mgcScaleMode_ComboBox.editEnabled = false;
   for ( var m = 0; m < MGC_SCALE_MODES.length; m++ )
      this.mgcScaleMode_ComboBox.addItem( MGC_SCALE_MODE_LABELS[m] );
   this.mgcScaleMode_ComboBox.currentItem = mgcScaleModeIndex( WorkflowParameters.mgcScaleMode );
   this.mgcScaleMode_ComboBox.toolTip = "<p><b>Standard (1.0):</b> MGC scale factors fixed at 1.0 " +
      "(previous behaviour).</p>" +
      "<p><b>Automatic:</b> MGC computes one factor per channel so that no image structure " +
      "survives in the model. Often removes less nebula signal; image-dependent, not always better. " +
      "About the same time as Standard.</p>" +
      "<p><b>Both:</b> two previews per scale (BM_&lt;scale&gt; and BM_&lt;scale&gt;_autoSF) " +
      "to compare in the model panel. MGC runs twice per scale.</p>" +
      "<p>The model panel shows the factors and their correlation; channels with " +
      "correlation below " + MGC_LOW_CORRELATION.toFixed(2) + " are flagged.</p>";

   this.mgcScaleMode_Warning = new ToolButton( this );
   this.mgcScaleMode_Warning.icon = this.scaledResource( ":/messages/warning.png" );
   this.mgcScaleMode_Warning.setScaledFixedSize( 20, 20 );
   this.mgcScaleMode_Warning.toolTip = "<p><b>Both doubles the MGC runs.</b> The MARS part is done " +
      "once, but every scale is modelled twice: about 60-70 % more MGC time than " +
      "Standard (measured with 4 scales).</p>";
   this.mgcScaleMode_Warning.visible = (WorkflowParameters.mgcScaleMode == "both");

   this.mgcScaleMode_ComboBox.onItemSelected = function( idx )
   {
      WorkflowParameters.mgcScaleMode = MGC_SCALE_MODES[idx];
      dlg.mgcScaleMode_Warning.visible = (WorkflowParameters.mgcScaleMode == "both");
      WorkflowParameters.saveUserPrefs();
   };

   this.mgcScaleMode_Sizer = new HorizontalSizer;
   this.mgcScaleMode_Sizer.spacing = 6;
   this.mgcScaleMode_Sizer.add( this.mgcScaleMode_Label );
   this.mgcScaleMode_Sizer.add( this.mgcScaleMode_ComboBox );
   this.mgcScaleMode_Sizer.add( this.mgcScaleMode_Warning );
   this.mgcScaleMode_Sizer.addStretch();

   // MGC Filter selection
   function mgcFilterIndex(val) {
      var idx = MGC_FILTERS.indexOf(val);
      return idx >= 0 ? idx : 0;
   }

   // Filter selection checkbox
   this.mgcFilters_CheckBox = new CheckBox( this );
   this.mgcFilters_CheckBox.text = "Filter selection  ( ! Unchecked > always L/R/G/B ! )";
   this.mgcFilters_CheckBox.checked = WorkflowParameters.enableMGCFilters;
   this.mgcFilters_CheckBox.toolTip = "<p>Override default MGC filter assignments (L/R/G/B).<br/>" +
      "Use for narrowband or custom filter combinations.</p>";
   this.mgcFilters_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableMGCFilters = checked;
      dlg.mgcFilterRows_Control.visible = checked;
      dlg.adjustToContents();
      WorkflowParameters.saveUserPrefs();
   };

   this.mgcFilters_CheckBox_Sizer = new HorizontalSizer;
   this.mgcFilters_CheckBox_Sizer.spacing = 6;
   this.mgcFilters_CheckBox_Sizer.addUnscaledSpacing( labelWidth + 6 );
   this.mgcFilters_CheckBox_Sizer.add( this.mgcFilters_CheckBox );
   this.mgcFilters_CheckBox_Sizer.addStretch();

   // Gray filter row
   this.mgcGrayLabel = new Label( this );
   this.mgcGrayLabel.text = "Gray filter:";
   this.mgcGrayLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mgcGrayLabel.setFixedWidth( labelWidth );
   this.mgcGray_ComboBox = new ComboBox( this );
   this.mgcGray_ComboBox.editEnabled = false;
   for ( var f = 0; f < MGC_FILTERS.length; f++ )
      this.mgcGray_ComboBox.addItem( MGC_FILTERS[f] );
   this.mgcGray_ComboBox.currentItem = mgcFilterIndex( WorkflowParameters.mgcGrayFilter );
   this.mgcGray_ComboBox.onItemSelected = function( idx )
   {
      WorkflowParameters.mgcGrayFilter = MGC_FILTERS[idx];
      WorkflowParameters.saveUserPrefs();
   };
   this.mgcGray_Sizer = new HorizontalSizer;
   this.mgcGray_Sizer.spacing = 6;
   this.mgcGray_Sizer.add( this.mgcGrayLabel );
   this.mgcGray_Sizer.add( this.mgcGray_ComboBox );
   this.mgcGray_Sizer.addStretch();

   // Red filter row
   this.mgcRedLabel = new Label( this );
   this.mgcRedLabel.text = "Red filter:";
   this.mgcRedLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mgcRedLabel.setFixedWidth( labelWidth );
   this.mgcRed_ComboBox = new ComboBox( this );
   this.mgcRed_ComboBox.editEnabled = false;
   for ( var f = 0; f < MGC_FILTERS.length; f++ )
      this.mgcRed_ComboBox.addItem( MGC_FILTERS[f] );
   this.mgcRed_ComboBox.currentItem = mgcFilterIndex( WorkflowParameters.mgcRedFilter );
   this.mgcRed_ComboBox.onItemSelected = function( idx )
   {
      WorkflowParameters.mgcRedFilter = MGC_FILTERS[idx];
      WorkflowParameters.saveUserPrefs();
   };
   this.mgcRed_Sizer = new HorizontalSizer;
   this.mgcRed_Sizer.spacing = 6;
   this.mgcRed_Sizer.add( this.mgcRedLabel );
   this.mgcRed_Sizer.add( this.mgcRed_ComboBox );
   this.mgcRed_Sizer.addStretch();

   // Green filter row
   this.mgcGreenLabel = new Label( this );
   this.mgcGreenLabel.text = "Green filter:";
   this.mgcGreenLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mgcGreenLabel.setFixedWidth( labelWidth );
   this.mgcGreen_ComboBox = new ComboBox( this );
   this.mgcGreen_ComboBox.editEnabled = false;
   for ( var f = 0; f < MGC_FILTERS.length; f++ )
      this.mgcGreen_ComboBox.addItem( MGC_FILTERS[f] );
   this.mgcGreen_ComboBox.currentItem = mgcFilterIndex( WorkflowParameters.mgcGreenFilter );
   this.mgcGreen_ComboBox.onItemSelected = function( idx )
   {
      WorkflowParameters.mgcGreenFilter = MGC_FILTERS[idx];
      WorkflowParameters.saveUserPrefs();
   };
   this.mgcGreen_Sizer = new HorizontalSizer;
   this.mgcGreen_Sizer.spacing = 6;
   this.mgcGreen_Sizer.add( this.mgcGreenLabel );
   this.mgcGreen_Sizer.add( this.mgcGreen_ComboBox );
   this.mgcGreen_Sizer.addStretch();

   // Blue filter row
   this.mgcBlueLabel = new Label( this );
   this.mgcBlueLabel.text = "Blue filter:";
   this.mgcBlueLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mgcBlueLabel.setFixedWidth( labelWidth );
   this.mgcBlue_ComboBox = new ComboBox( this );
   this.mgcBlue_ComboBox.editEnabled = false;
   for ( var f = 0; f < MGC_FILTERS.length; f++ )
      this.mgcBlue_ComboBox.addItem( MGC_FILTERS[f] );
   this.mgcBlue_ComboBox.currentItem = mgcFilterIndex( WorkflowParameters.mgcBlueFilter );
   this.mgcBlue_ComboBox.onItemSelected = function( idx )
   {
      WorkflowParameters.mgcBlueFilter = MGC_FILTERS[idx];
      WorkflowParameters.saveUserPrefs();
   };
   this.mgcBlue_Sizer = new HorizontalSizer;
   this.mgcBlue_Sizer.spacing = 6;
   this.mgcBlue_Sizer.add( this.mgcBlueLabel );
   this.mgcBlue_Sizer.add( this.mgcBlue_ComboBox );
   this.mgcBlue_Sizer.addStretch();

   // Container for filter rows — hidden when unchecked
   this.mgcFilterRows_Control = new Control( this );
   this.mgcFilterRows_Control.sizer = new VerticalSizer;
   this.mgcFilterRows_Control.sizer.spacing = 4;
   this.mgcFilterRows_Control.sizer.add( this.mgcGray_Sizer );
   this.mgcFilterRows_Control.sizer.add( this.mgcRed_Sizer );
   this.mgcFilterRows_Control.sizer.add( this.mgcGreen_Sizer );
   this.mgcFilterRows_Control.sizer.add( this.mgcBlue_Sizer );
   this.mgcFilterRows_Control.visible = WorkflowParameters.enableMGCFilters;

   // MGC section content control
   this.mgc_Control = new Control( this );
   this.mgc_Control.sizer = new VerticalSizer;
   this.mgc_Control.sizer.margin = 6;
   this.mgc_Control.sizer.spacing = 4;
   for ( var p = 0; p < 4; p++ )
      this.mgc_Control.sizer.add( mgcSizers[p] );
   this.mgc_Control.sizer.add( this.mgcScaleMode_Sizer );
   this.mgc_Control.sizer.add( this.mgcFilters_CheckBox_Sizer );
   this.mgc_Control.sizer.add( this.mgcFilterRows_Control );

   // MGC SectionBar with enable checkbox
   this.mgc_Section = new SectionBar( this, "MGC (Multiscale Gradient Correction)" );
   this.mgc_Section.setSection( this.mgc_Control );
   this.mgc_Section.enableCheckBox( true );
   this.mgc_Section.checkBox.checked = WorkflowParameters.enableMGC;
   this.mgc_Section.checkBox.toolTip = "<p>Enable/disable Multiscale Gradient Correction.<br/>" +
      "Requires SPFC and Previews. Enabling MGC will auto-enable both.</p>";

   this.mgc_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableMGC = sectionbar.checkBox.checked;
      dlg.mgc_Control.enabled = WorkflowParameters.enableMGC;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      if ( sectionbar.checkBox.checked )
         dlg.selectWorkflow( "mgc" );
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.mgc_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 5: GradientCorrection (collapsed unless left open, disabled by default)
   // =================================================================

   this.gc_Control = new Control( this );
   this.gc_Control.sizer = new VerticalSizer;
   this.gc_Control.sizer.margin = 6;
   // No user controls needed - GC uses the fixed GC_PRESETS on GC_ and GC_1
   this.gc_Info = new Label( this );
   this.gc_Info.wordWrapping = true;
   this.gc_Info.useRichText = true;
   this.gc_Info.text = "Runs 2 preset values on previews GC_ and GC_1 for you to choose from, " +
      "or continue manually with your own settings in the GC tool.";
   this.gc_Control.sizer.add( this.gc_Info );

   this.gc_Section = new SectionBar( this, "GradientCorrection" );
   this.gc_Section.toolTip = "<p>Runs 2 preset GradientCorrection settings on previews GC_ and GC_1, " +
      "then lets you pick one to apply.</p>";
   this.gc_Section.setSection( this.gc_Control );
   this.gc_Section.enableCheckBox( true );
   this.gc_Section.checkBox.checked = WorkflowParameters.enableGC;
   this.gc_Section.checkBox.toolTip =
      "<p>Run GradientCorrection on previews GC_ and GC_1 with two different settings, " +
      "then choose which result to apply (or open the GC tool with its settings).</p>" +
      "<p>This is an alternative to MGC for images where MARS reference data is not available.</p>" +
      "<p>When enabled: ImageSolve stays on, SPFC and MGC are disabled.</p>" +
      "<p>GC also activates automatically as a fallback if SPFC or MGC fails.</p>" +
      "<p>ImageSolve will be skipped if an astrometric solution already exists.</p>";

   this.gc_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableGC = sectionbar.checkBox.checked;
      dlg.gc_Control.enabled = WorkflowParameters.enableGC;
      if ( sectionbar.checkBox.checked )
         dlg.selectWorkflow( "gc" );
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.gc_Section.onToggleSection = function( section, toggleBegin )
   {
      toggleSectionHandler( section, toggleBegin );
      if ( !toggleBegin )
      {
         WorkflowParameters.gcExpanded = section.isExpanded();
         WorkflowParameters.saveUserPrefs();
      }
   };

   // Collapsed unless the user left it open last time. Hidden directly:
   // toggleSection() reads section.visible, which is not reliable before
   // the dialog is shown, and could expand it instead.
   if ( !WorkflowParameters.gcExpanded )
   {
      this.gc_Control.hide();
      this.gc_Section.updateIcon();
   }

   // =================================================================
   // SECTION 6: DynamicBackgroundExtraction (collapsed unless left open, disabled by default)
   // =================================================================

   this.dbe_Control = new Control( this );
   this.dbe_Control.sizer = new VerticalSizer;
   this.dbe_Control.sizer.margin = 6;
   // No user controls - DBE opens with basic settings for manual use
   this.dbe_Info = new Label( this );
   this.dbe_Info.wordWrapping = true;
   this.dbe_Info.useRichText = true;
   this.dbe_Info.text = "Opens the DBE tool with preset values for you to do a background " +
      "extraction. Choose your own values if preferred.";
   this.dbe_Control.sizer.add( this.dbe_Info );

   this.dbe_Section = new SectionBar( this, "DynamicBackgroundExtraction" );
   this.dbe_Section.toolTip = "<p>Opens DynamicBackgroundExtraction with pre-set values.</p>";
   this.dbe_Section.setSection( this.dbe_Control );
   this.dbe_Section.enableCheckBox( true );
   this.dbe_Section.checkBox.checked = WorkflowParameters.enableDBE;
   this.dbe_Section.checkBox.toolTip =
      "<p>Open DynamicBackgroundExtraction with basic settings for manual background modeling.</p>" +
      "<p>When enabled: ImageSolve stays on, all other steps are disabled.</p>" +
      "<p>After plate solving, DBE opens for manual sample placement and execution.</p>" +
      "<p>ImageSolve will be skipped if an astrometric solution already exists.</p>";

   this.dbe_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableDBE = sectionbar.checkBox.checked;
      dlg.dbe_Control.enabled = WorkflowParameters.enableDBE;
      if ( sectionbar.checkBox.checked )
         dlg.selectWorkflow( "dbe" );
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.dbe_Section.onToggleSection = function( section, toggleBegin )
   {
      toggleSectionHandler( section, toggleBegin );
      if ( !toggleBegin )
      {
         WorkflowParameters.dbeExpanded = section.isExpanded();
         WorkflowParameters.saveUserPrefs();
      }
   };

   // Collapsed unless the user left it open last time (see GC above)
   if ( !WorkflowParameters.dbeExpanded )
   {
      this.dbe_Control.hide();
      this.dbe_Section.updateIcon();
   }

   // =================================================================
   // Info Label
   // =================================================================

   this.info_Label = new Label( this );
   this.info_Label.text = "Loaded: " + whiteRefList.length + " white refs, " +
      cameraList.length + " cameras, " + filterList.length + " RGB filter sets, " +
      grayFilterList.length + " gray filters";
   this.info_Label.styleSheet = "font-style: italic; color: #888;";

   // =================================================================
   // Bottom Button Bar: New Instance + OK + Cancel
   // =================================================================

   // New Instance button (blue triangle)
   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip = "New Instance";
   this.newInstanceButton.onMousePress = function()
   {
      this.hasFocus = true;
      WorkflowParameters.save();
      this.pushed = false;
      dlg.newInstance();
   };

   // Documentation button: opens the PixInsight manual (doc/scripts/SHLazyWorkflowPart1)
   this.pdfButton = new ToolButton( this );
   this.pdfButton.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
   this.pdfButton.setScaledFixedSize( 24, 24 );
   this.pdfButton.toolTip = "<p>Open the Lazy Workflow Part 1 manual.</p>";
   this.pdfButton.onClick = function()
   {
      if ( !Dialog.browseScriptDocumentation( DOC_NAME ) )
         (new MessageBox(
            "<p>The Lazy Workflow Part 1 manual is not installed.</p>" +
            "<p>It comes with the Space Hunter update package (doc/scripts/" + DOC_NAME + ").</p>",
            SCRIPT_NAME, StdIcon.Information, StdButton.Ok
         )).execute();
   };

   // Disable All button
   this.disableAllButton = new ToolButton( this );
   this.disableAllButton.icon = this.scaledResource( ":/icons/clear.png" );
   this.disableAllButton.setScaledFixedSize( 24, 24 );
   this.disableAllButton.toolTip = "<p>Disable all workflow steps.</p>";
   this.disableAllButton.onClick = function()
   {
      WorkflowParameters.enableImageSolve = false;
      WorkflowParameters.enableBlindSolve = false;
      WorkflowParameters.enableSPFC = false;
      WorkflowParameters.enablePreviews = false;
      WorkflowParameters.enableMGC = false;

      dlg.imageSolve_Section.checkBox.checked = false;
      dlg.imageSolve_Control.enabled = false;
      dlg.blindSolve_CheckBox.checked = false;
      dlg.blindSolve_CheckBox.enabled = false;
      dlg.spfc_Section.checkBox.checked = false;
      dlg.spfc_Control.enabled = false;
      dlg.previews_Section.checkBox.checked = false;
      dlg.previews_Control.enabled = false;
      dlg.mgc_Section.checkBox.checked = false;
      dlg.mgc_Control.enabled = false;
      WorkflowParameters.enableGC = false;
      dlg.gc_Section.checkBox.checked = false;
      dlg.gc_Control.enabled = false;
      WorkflowParameters.enableDBE = false;
      dlg.dbe_Section.checkBox.checked = false;
      dlg.dbe_Control.enabled = false;
      dlg.updateGradientScaleStates();
   };

   // Reset Defaults button
   this.resetDefaultsButton = new ToolButton( this );
   this.resetDefaultsButton.icon = this.scaledResource( ":/icons/reload.png" );
   this.resetDefaultsButton.setScaledFixedSize( 24, 24 );
   this.resetDefaultsButton.toolTip = "<p>Reset all workflow steps to default values.<br/>" +
      "Default: ImageSolve (with blind solve), SPFC, Previews (4), MGC enabled. GC and DBE disabled and collapsed.<br/>" +
      "Equipment settings (camera, filter, white reference, gradient scales) are not changed.</p>";
   this.resetDefaultsButton.onClick = function()
   {
      WorkflowParameters.enableImageSolve = true;
      WorkflowParameters.enableBlindSolve = true;
      WorkflowParameters.enableSPFC = true;
      WorkflowParameters.enablePreviews = true;
      WorkflowParameters.enableMGC = true;
      WorkflowParameters.numPreviews = 4;
      // Gradient scales are equipment settings: Reset Settings (gear)
      // resets them, as the tooltip and the manual say.

      dlg.imageSolve_Section.checkBox.checked = true;
      dlg.imageSolve_Control.enabled = true;
      dlg.blindSolve_CheckBox.checked = true;
      dlg.blindSolve_CheckBox.enabled = true;
      dlg.spfc_Section.checkBox.checked = true;
      dlg.spfc_Control.enabled = true;
      dlg.previews_Section.checkBox.checked = true;
      dlg.previews_Control.enabled = true;
      dlg.mgc_Section.checkBox.checked = true;
      dlg.mgc_Control.enabled = true;
      WorkflowParameters.enableGC = false;
      dlg.gc_Section.checkBox.checked = false;
      dlg.gc_Control.enabled = false;
      WorkflowParameters.enableDBE = false;
      dlg.dbe_Section.checkBox.checked = false;
      dlg.dbe_Control.enabled = false;
      dlg.numPreviews_ComboBox.currentItem = 3;
      dlg.updateGradientScaleStates();
      // Alternative workflows back to collapsed (the toggle saves the state)
      if ( dlg.gc_Section.isExpanded() )
         dlg.gc_Section.toggleSection();
      if ( dlg.dbe_Section.isExpanded() )
         dlg.dbe_Section.toggleSection();
   }; 
   // Reset Settings button (red - clears persistent user preferences)
   this.resetSettingsButton = new ToolButton( this );
   this.resetSettingsButton.icon = this.scaledResource( ":/process/gear.png" );
   this.resetSettingsButton.setScaledFixedSize( 24, 24 );
   this.resetSettingsButton.toolTip = "<p>Reset equipment settings to script defaults.<br/>" +
      "Resets: White Reference, Camera and Filter to default,<br/>" +
      "MGC gradient scales to 768/1024/2048/3072.<br/>" +
      "Workflow steps are not changed.</p>";
   this.resetSettingsButton.onClick = function()
   {
      WorkflowParameters.resetUserPrefs();
      var spiralIdx = 0;
      for (var i = 0; i < whiteRefList.length; i++) {
         if (whiteRefList[i].name === "Average Spiral Galaxy") { spiralIdx = i; break; }
      }
      dlg.whiteRef_ComboBox.currentItem = spiralIdx;
      var idealIdx = 0;
      for (var i = 0; i < cameraList.length; i++) {
         if (cameraList[i].label.indexOf("Ideal") >= 0) { idealIdx = i; break; }
      }
      WorkflowParameters.selectedCameraIdx = idealIdx;
      dlg.camera_ComboBox.currentItem = idealIdx;
      dlg.filter_ComboBox.currentItem = WorkflowParameters.selectedFilterIdx;
      dlg.grayFilter_ComboBox.currentItem = WorkflowParameters.selectedGrayIdx;
      dlg.narrowband_CheckBox.checked = false;
      dlg.spfcGraphs_CheckBox.checked = false;
      dlg.nbRows_Control.visible = false;
      dlg.filter_Control.visible = true;
      dlg.nbRedWave_Edit.text = "656.30";
      dlg.nbRedBw_Edit.text = "3.00";
      dlg.nbGreenWave_Edit.text = "500.70";
      dlg.nbGreenBw_Edit.text = "3.00";
      dlg.nbBlueWave_Edit.text = "500.70";
      dlg.nbBlueBw_Edit.text = "3.00";
      dlg.separation_CheckBox.checked = false;
      dlg.sepRows_Control.enabled = false;
      dlg.sepGreen_Edit.text = "0.000";
      dlg.sepBlue_Edit.text = "0.000";
      dlg.fillProfileList();
      dlg.adjustToContents();
      dlg.numPreviews_ComboBox.currentItem = 3;
      for (var i = 0; i < 4; i++)
         dlg.gradientScaleCombo[i].currentItem = WorkflowParameters.gradientScaleToComboIndex(
            WorkflowParameters.getGradientScale(i));
      dlg.updateGradientScaleStates();
      dlg.mgcScaleMode_ComboBox.currentItem = mgcScaleModeIndex( "standard" );
      dlg.mgcScaleMode_Warning.visible = false;
      dlg.mgcFilters_CheckBox.checked = false;
      dlg.mgcFilterRows_Control.visible = false;
      dlg.mgcGray_ComboBox.currentItem = mgcFilterIndex( "L" );
      dlg.mgcRed_ComboBox.currentItem = mgcFilterIndex( "Ha" );
      dlg.mgcGreen_ComboBox.currentItem = mgcFilterIndex( "OIII" );
      dlg.mgcBlue_ComboBox.currentItem = mgcFilterIndex( "OIII" );
      dlg.adjustToContents();
      // Save the dialog's state at once, so the workflow steps and the
      // profile folder are kept even if the user then clicks Cancel.
      WorkflowParameters.saveUserPrefs();
   };
   // OK button
   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function()
   {
      dlg.ok();
   };

   // Cancel button
   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function()
   {
      dlg.cancel();
   };

   // Button bar layout
   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.add( this.newInstanceButton );
   this.buttons_Sizer.add( this.pdfButton );
   this.buttons_Sizer.add( this.disableAllButton );
   this.buttons_Sizer.add( this.resetDefaultsButton );
   this.buttons_Sizer.add( this.resetSettingsButton );
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );

   // =================================================================
   // Global Dialog Layout
   // =================================================================

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add( this.helpLabel );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.imageSolve_Section );
   this.sizer.add( this.imageSolve_Control );
   this.sizer.add( this.spfc_Section );
   this.sizer.add( this.spfc_Control );
   this.sizer.add( this.previews_Section );
   this.sizer.add( this.previews_Control );
   this.sizer.add( this.mgc_Section );
   this.sizer.add( this.mgc_Control );
   this.sizer.add( this.gc_Section );
   this.sizer.add( this.gc_Control );
   this.sizer.add( this.dbe_Section );
   this.sizer.add( this.dbe_Control );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.info_Label );
   this.sizer.addSpacing( 8 );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = "SPACE HUNTER - LAZY WORKFLOW PART 1";

   // Apply initial enabled states
   this.imageSolve_Control.enabled = WorkflowParameters.enableImageSolve;
   this.spfc_Control.enabled = WorkflowParameters.enableSPFC;
   this.previews_Control.enabled = WorkflowParameters.enablePreviews;
   this.mgc_Control.enabled = WorkflowParameters.enableMGC;
   this.gc_Control.enabled = WorkflowParameters.enableGC;
   this.dbe_Control.enabled = WorkflowParameters.enableDBE;
   this.updateGradientScaleStates();

   // Size the dialog
   this.ensureLayoutUpdated();
   this.adjustToContents();
   this.setMinWidth( 540 );
   this.setMinHeight();
}

}; // end class SpaceHunterDialog

// ============================================================
// ============================================================

// ============================================================
// ============================================================

// ============================================================
// STEP 0: Equipment Selection Dialog
// ============================================================

function selectEquipment()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("EQUIPMENT & WORKFLOW SELECTION");
   console.writeln("=".repeat(80) + "\n");

   let dialog = new SpaceHunterDialog();

   if ( !dialog.execute() )
   {
      // "PixelMath & exit": the dialog is closed now, so PixelMath is usable.
      if ( dialog.launchPixelMathOnExit )
      {
         var kG = WorkflowParameters.sepGreenFactor, kB = WorkflowParameters.sepBlueFactor;
         if ( kG <= 0 && kB <= 0 )
            kG = kB = 0.5;
         buildSeparationPixelMath( kG, kB ).launch();
         console.writeln("PixelMath opened with the Ha/OIII separation expressions.");
         console.writeln("  1. Create a preview over an area with H-alpha nebulosity.");
         console.writeln("  2. Apply PixelMath to the preview; look at G and B separately.");
         console.writeln("  3. Lower the factor (Undo between tries) until the H-alpha");
         console.writeln("     structures just disappear - not until they turn dark.");
         console.writeln("  4. Run this script again, enter kG / kB and click 'Save profile'.");
      }
      throw new Error("Script cancelled by user.");
   }

   // Save everything once on OK, so buttons like Deselect All and Reset
   // Defaults are kept too (the manual: settings are saved when you run).
   WorkflowParameters.saveUserPrefs();

   // Log selections
   var wr = whiteRefList[WorkflowParameters.selectedWhiteRefIdx];
   var cam = cameraList[WorkflowParameters.selectedCameraIdx];
   var flt = filterList[WorkflowParameters.selectedFilterIdx];
   var gray = grayFilterList[WorkflowParameters.selectedGrayIdx];

   console.writeln("\nSelected white reference: " + wr.label);
   console.writeln("Selected camera: " + cam.label);
   console.writeln("Selected gray filter: " + gray.label);
   console.writeln("Selected RGB filters: " + flt.label + " [" + flt.type + "]");
   console.writeln("  R: " + flt.redName);
   console.writeln("  G: " + flt.greenName);
   console.writeln("  B: " + flt.blueName);

   console.writeln("\nWorkflow sections enabled:");
   console.writeln("  ImageSolve: " + (WorkflowParameters.enableImageSolve ? "Yes" : "No"));
   console.writeln("    Blind:    " + (WorkflowParameters.enableBlindSolve ? "Yes" : "No"));
   console.writeln("  SPFC:       " + (WorkflowParameters.enableSPFC ? "Yes" : "No"));
   console.writeln("  Previews:   " + (WorkflowParameters.enablePreviews ? "Yes" : "No") +
      " (" + WorkflowParameters.numPreviews + " preview(s))");
   console.writeln("  MGC:        " + (WorkflowParameters.enableMGC ? "Yes" : "No"));
   console.writeln("  GC:         " + (WorkflowParameters.enableGC ? "Yes" : "No"));
   console.writeln("  DBE:        " + (WorkflowParameters.enableDBE ? "Yes" : "No"));

   if (WorkflowParameters.enableMGC) {
      console.writeln("  Gradient scales:");
      for (var i = 0; i < WorkflowParameters.numPreviews; i++)
         console.writeln("    Preview" + i + ": " + WorkflowParameters.getGradientScale(i));
      console.writeln("  Scale factors: " +
         MGC_SCALE_MODE_LABELS[mgcScaleModeIndex(WorkflowParameters.mgcScaleMode)]);
   }

   console.writeln("=".repeat(80) + "\n");
}

// ============================================================
// STEP 1: PLATE SOLVING FUNCTIONS
// ============================================================

function checkRequiredKeywords() {
    if (ImageWindow.activeWindow.isNull) {
        console.criticalln("ERROR: No active image window.");
        return null;
    }

    let win = ImageWindow.activeWindow;
    let keywords = win.keywords;

    let found = {
        objctra: { exists: false, value: "" },
        objctdec: { exists: false, value: "" },
        ra: { exists: false, value: "" },
        dec: { exists: false, value: "" },
        xpixsz: { exists: false, value: "" },
        focallen: { exists: false, value: "" }
    };

    for (let i = 0; i < keywords.length; i++) {
        let name = keywords[i].name;
        let value = keywords[i].value.trim();

        if (value == "" || value == "''") continue;

        if (name == "OBJCTRA") {
            found.objctra.exists = true;
            found.objctra.value = value;
        }
        if (name == "OBJCTDEC") {
            found.objctdec.exists = true;
            found.objctdec.value = value;
        }
        if (name == "RA") {
            found.ra.exists = true;
            found.ra.value = value;
        }
        if (name == "DEC") {
            found.dec.exists = true;
            found.dec.value = value;
        }
        if (name == "XPIXSZ") {
            found.xpixsz.exists = true;
            found.xpixsz.value = value;
        }
        if (name == "FOCALLEN") {
            found.focallen.exists = true;
            found.focallen.value = value;
        }
    }

    return found;
}

// Returns an astrometric-solution property (e.g. "CreatorModule", "Catalog")
// for a view, or null. The modern ImageSolver engine writes the STANDARD
// "AstrometricSolution:*" property namespace; older/legacy solutions used
// "PCL:AstrometricSolution:*". Check the new namespace first, then fall back
// to legacy (mirrors PixInsight's own AstrometricMetadata precedence).
function shSolutionProperty(view, id) {
    try {
        if (view.hasProperty("AstrometricSolution:" + id))
            return view.propertyValue("AstrometricSolution:" + id);
        if (view.hasProperty("PCL:AstrometricSolution:" + id))
            return view.propertyValue("PCL:AstrometricSolution:" + id);
    } catch (e) {}
    return null;
}

// True if the image window has a valid astrometric solution. Asks the window,
// not the AstrometricSolution:* properties: those stay on the view when the
// solve is undone in History Explorer (Georg's test 2026-11-01), while the
// window's solution - the one MGC and SPFC use - is gone.
function shHasSolution(view) {
    try { return view.window.hasAstrometricSolution; } catch (e) {}
    return shSolutionProperty(view, "CreatorModule") != null;
}

// Re-run marks, written right after a step runs. The value is the history
// position (view.historyIndex = number of active steps) right after that
// step. Properties are NOT reliably rolled back by History Explorer (an
// SPFC mark survived a jump back to before SPFC, 2026-11-01), so a mark only
// counts while its step is still active. view.processing still lists undone
// steps; a reopened file starts with an empty list (verified 2026-11-01),
// and then the stored mark is the only evidence. Storable: saved with the file.
function shMarkDone(view, id) {
    try { view.setPropertyValue(id, view.historyIndex, PropertyType.Int32,
                                PropertyAttribute.Storable | PropertyAttribute.Permanent); } catch (e) {}
}
function shHasProperty(view, id) {
    try { return view.hasProperty(id); } catch (e) { return false; }
}
function shHasMark(view, id) {
    if (!shHasProperty(view, id))
        return false;
    try {
        var pos = view.propertyValue(id);
        if (typeof pos != "number")
            return true;                    // boolean mark from v2.7.1 and older
        if (pos > view.processing.length)
            return true;                    // from an earlier session (reopened file)
        return pos <= view.historyIndex;    // false = its step was undone
    } catch (e) {}
    return true;
}

// "active": a process with this id is among the view's active history steps;
// "undone": only among steps undone in History Explorer; "none": not in this
// session's history at all (e.g. reopened file).
function shStepState(view, processId) {
    var state = "none";
    try {
        var pc = view.processing;
        var active = view.historyIndex;
        for (var i = 0; i < pc.length; i++)
            if (pc[i].processId() == processId) {
                if (i < active)
                    return "active";
                state = "undone";
            }
    } catch (e) {}
    return state;
}

// SPFC applied to the image's current state. In this session's history the
// step's position decides; without history (reopened file) our mark or
// SPFC's own properties do.
function shSpfcApplied(view) {
    var state = shStepState(view, "SpectrophotometricFluxCalibration");
    if (state != "none")
        return state == "active";
    return shHasMark(view, "SpaceHunter:SPFCDone") || shHasProperty(view, "PCL:SPFC:Version");
}

// Pin a known-good ImageSolver configuration for headless auto-solve, so the
// result does not depend on whatever state the user last left the standalone
// ImageSolver GUI in (initialize() loads those saved settings). This only
// touches solverCfg (HOW to solve) - never metadata (the image's RA/Dec/scale)
// - and is deliberately MINIMAL: it sets the behaviours the ImageSolver
// documentation calls the defaults/recommended, and forces OFF every optional
// diagnostic output ("diagnostic tools, not results") so an automated run never
// spawns extra image windows or writes stray files. Star-detection numerics are
// left at their defaults, which the docs say rarely need changing for correctly
// calibrated data. Must be called AFTER solver.initialize() so it overrides the
// loaded settings.
function configureSolverForAutoSolve(solver) {
    var cfg = solver.solverCfg;

    // Recommended default behaviours (per the ImageSolver documentation):
    cfg.catalogMode            = CatalogMode.Automatic; // best catalog auto (local Gaia XPSD if installed)
    cfg.autoMagnitude          = true;                  // adaptive limit magnitude
    cfg.distortionCorrection   = true;                  // surface-spline distortion model
    cfg.tryApparentCoordinates = true;                  // retry if metadata holds apparent coords
    cfg.autoPSF                = false;                 // "much slower, improvement marginal"

    // Blind solver (ImageSolver 6.6.0): Automatic = used when the image has no
    // usable RA/Dec or scale, or when the first alignment with them fails.
    // Needs the astrometric index set in the Gaia process preferences.
    cfg.blindSolver = WorkflowParameters.enableBlindSolve ? BlindSolverMode.Automatic
                                                          : BlindSolverMode.Disabled;

    // Suppress all optional diagnostic outputs (each would open a new window
    // or write a CSV during an automated run):
    cfg.showStars              = false;
    cfg.showStarMatches        = false;
    cfg.showDistortion         = false;
    cfg.showSimplifiedSurfaces = false;
    cfg.generateErrorImg       = false;
    cfg.generateDistortModel   = false;
}

function openImageSolver() {
    console.writeln("\n" + "-".repeat(80));
    console.writeln("Opening ImageSolver...");
    console.writeln("-".repeat(80));

    let win = ImageWindow.activeWindow;
    if (win.isNull) {
        console.criticalln("ERROR: No active image window for ImageSolver.");
        return false;
    }

    // Auto plate-solve by driving the modern ImageSolver engine directly
    // (included as a library at the top of this script). This is the same
    // call sequence the official WBPP/FBPP scripts use in BPP-Solver.js:
    // new ImageSolver() -> initialize(win,false) -> solveImage(win).
    // initialize() reads RA/Dec/scale and image geometry from the image
    // metadata (via ExtractMetadata); solveImage() writes the WCS keywords and
    // the AstrometricSolution:* properties straight to the window and
    // regenerates the astrometric solution, so no manual step is needed on
    // success. No dialog is shown.
    try {
        let solver = new ImageSolver();
        solver.initialize(win, false /*prioritizeSettings*/);

        // Observation time: initialize() reads it from the image; if the master
        // lacks DATE-OBS, try to recover it from the image's WCS keywords (same
        // approach as WBPP's BPP-Solver). Without one, ImageSolver 6.6.0 uses
        // J2000.0 star places and says so on the console.
        if (!solver.metadata.observationTime) {
            try {
                let wcs = new WCSKeywords();
                wcs.Read(win);
                if (wcs.observationTime)
                    solver.metadata.observationTime = wcs.observationTime;
            } catch (e) {}
        }

        // Pin a minimal, known-good solver configuration (overrides whatever the
        // user last saved in the standalone ImageSolver GUI).
        configureSolverForAutoSolve(solver);

        // IMPORTANT: the modern engine's solveImage() returns VOID and THROWS
        // on failure (per WBPP's BPP-Solver.js). So reaching the next line
        // without an exception means success - do NOT test its return value.
        solver.solveImage(win);

        // Confirm the astrometric solution the rest of the workflow relies on
        // was actually written. The modern engine writes the standard
        // "AstrometricSolution:*" namespace (not legacy "PCL:..."), so read via
        // the namespace-agnostic helper (matches smartPlateSolve/runSPFC).
        let creator = shSolutionProperty(win.mainView, "CreatorModule");
        if (creator != null) {
            let catalog = shSolutionProperty(win.mainView, "Catalog");
            console.noteln("\n✔ ImageSolver succeeded - solution written to image.");
            console.writeln("  Solver:  " + creator);
            if (catalog) console.writeln("  Catalog: " + catalog);
            return true;
        }

        console.warningln("\n⚠  ImageSolver completed but no astrometric solution property was found.");
    } catch (error) {
        if (shIsCancel(error))
            throw error;   // Abort means cancel, not "solve it by hand"
        console.criticalln("\n⚠  ImageSolver failed: " + shErrorText(error));
        if (WorkflowParameters.enableBlindSolve && shAstrometricIndexPath() == "")
            shPrintIndexHelp();
    }

    // Manual fallback (kept intact): let the user solve by hand and re-run.
    console.warningln("Please plate-solve manually, then run this script again:");
    console.warningln("  Script > Image Analysis > ImageSolver\n");
    return false;
}

function smartPlateSolve() {
    console.writeln("\n" + "=".repeat(80));
    console.writeln("STEP 1: Smart Plate Solve");
    console.writeln("=".repeat(80) + "\n");

    // Check if plate solving is completely disabled
    if (!WorkflowParameters.enableImageSolve) {
        console.writeln("ImageSolver is DISABLED - skipping plate solve step");
        console.writeln("=".repeat(80));
        return true;
    }

    if (ImageWindow.activeWindow.isNull) {
        console.criticalln("ERROR: No active image window.");
        return false;
    }

    let win = ImageWindow.activeWindow;
    let view = win.mainView;

    console.writeln("Checking for existing astrometric solution...");

    // Astrometric solution properties (new + legacy namespaces). ImageSolver is
    // a script, so it leaves no process in the view's history to look for.
    let hasSolution = shHasSolution(view);

    if (hasSolution) {
        let catalog = shSolutionProperty(view, "Catalog");
        let creator = shSolutionProperty(view, "CreatorModule");
        console.writeln("\n\u2714 Image already has astrometric solution");
        console.writeln("  Catalog: " + (catalog || "Unknown"));
        console.writeln("  Solver:  " + (creator || "Unknown"));
        console.writeln("\n\u2714 Ready for workflow!");
        console.writeln("=".repeat(80));
        return true;
    }

    console.writeln("  \u2718 No astrometric solution found\n");

    console.writeln("Checking FITS keywords...\n");

    let found = checkRequiredKeywords();
    if (!found) return false;

    console.writeln("FITS Keyword Status:");
    console.writeln("  OBJCTRA/RA:  " + ((found.objctra.exists || found.ra.exists) ? "✔" : "✘"));
    console.writeln("  OBJCTDEC/DEC: " + ((found.objctdec.exists || found.dec.exists) ? "✔" : "✘"));
    console.writeln("  XPIXSZ:      " + (found.xpixsz.exists ? "✔" : "✘"));
    console.writeln("  FOCALLEN:    " + (found.focallen.exists ? "✔" : "✘"));

    console.writeln("\n" + "-".repeat(80));

    let hasCoordinates = (found.objctra.exists && found.objctdec.exists) || (found.ra.exists && found.dec.exists);
    let hasImageScale = found.xpixsz.exists && found.focallen.exists;

    if (hasCoordinates && hasImageScale) {
        console.writeln("DECISION: ImageSolver can work directly");
        console.writeln("-".repeat(80));
        console.writeln("\n✔ Image has sufficient FITS data");

        let solveSuccess = openImageSolver();

        if (solveSuccess) {
            return true;
        } else {
            console.writeln("\n⚠  WORKFLOW PAUSED");
            console.writeln("After ImageSolver completes, run this script again.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
        }

    } else {
        console.writeln("DECISION: blind solve needed");
        console.writeln("-".repeat(80));
        console.writeln("\nMissing data:");
        if (!hasCoordinates) console.writeln("  ✘ RA/Dec coordinates");
        if (!hasImageScale) console.writeln("  ✘ Image scale");
        console.writeln();

        if (!WorkflowParameters.enableBlindSolve) {
            console.writeln("⚠  Blind solve is disabled. Cannot proceed with plate solving.");
            console.writeln("Either enable blind solve or add the missing FITS keywords.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
        }

        if (shAstrometricIndexPath() == "") {
            console.warningln("⚠  No astrometric index file is set - blind solve not available.");
            shPrintIndexHelp();
            console.writeln("\n" + "=".repeat(80) + "\n");
            return false;
        }

        let solveSuccess = openImageSolver();

        if (solveSuccess) {
            return true;
        } else {
            console.writeln("\n⚠  WORKFLOW PAUSED");
            console.writeln("After ImageSolver completes, run this script again.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
        }
    }
}

// ============================================================
// STEPS 2-6: WORKFLOW FUNCTIONS (SPFC + Previews + MGC/GC/DBE)
// ============================================================

// ============================================================
// STEP 2a: Ha/OIII separation (dual-band OSC, before SPFC)
// ------------------------------------------------------------
// With a dual-band filter the G and B pixels also see some H-alpha. Removing
// k * (R - med(R)) from G and B leaves them with OIII only, so SPFC and MGC
// (OIII reference) work on the right signal. Subtracting med(R) keeps the
// sky background level unchanged. Method: PixInsight's "MGC - Dual-Band OSC
// Images (II)" video tutorial.
// ============================================================
function buildSeparationPixelMath(kG, kB)
{
   var P = new PixelMath;
   P.useSingleExpression = false;
   P.expression  = "$T";
   P.expression1 = "$T - ( $T[0] - med( $T[0] ) ) * " + kG.toFixed(4);
   P.expression2 = "$T - ( $T[0] - med( $T[0] ) ) * " + kB.toFixed(4);
   P.createNewImage = false;
   P.rescale = false;
   P.truncate = true;
   P.truncateLower = 0;
   P.truncateUpper = 1;
   return P;
}

// ------------------------------------------------------------
// Separation profiles: one .txt file per camera/filter combination in a
// folder the user chooses. A profile file is only READ for its two numbers,
// never executed. Two formats are accepted:
//   1. written by this script:   kG = 0.115   /   kB = 0.050
//   2. PixelMath "Edit Instance Source Code" copied into a .txt file:
//      P.expression1 = "$T - ( $T[0] - med( $T[0] ) ) * 0.115"; (and expression2)
// ------------------------------------------------------------
function listSeparationProfiles(folder)
{
   var names = [];
   if (!folder || !File.directoryExists(folder))
      return names;
   var ff = new FileFind;
   if (ff.begin(folder + "/*.txt")) {
      do {
         if (!ff.isDirectory)
            names.push(ff.name);
      } while (ff.next());
   }
   ff.end();
   names.sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
   return names;
}

// Returns { kG, kB } or throws an Error saying what is wrong with the file.
function readSeparationProfile(path)
{
   if (!File.exists(path))
      throw new Error("File not found: " + path);
   var text = File.readTextFile(path);
   var num = "([0-9]*\\.?[0-9]+)";
   var kG = null, kB = null;

   var mG = new RegExp("^\\s*kG\\s*=\\s*" + num, "mi").exec(text);
   var mB = new RegExp("^\\s*kB\\s*=\\s*" + num, "mi").exec(text);
   if (mG && mB) {
      kG = parseFloat(mG[1]);
      kB = parseFloat(mB[1]);
   } else {
      // PixelMath source: R must be "$T", G/B must be the separation expression
      var sep = "\\$T\\s*-\\s*\\(\\s*\\$T\\[0\\]\\s*-\\s*med\\(\\s*\\$T\\[0\\]\\s*\\)\\s*\\)\\s*\\*\\s*" + num;
      var mR  = /P\.expression\s*=\s*"\s*\$T\s*"\s*;/.exec(text);
      var pG  = new RegExp("P\\.expression1\\s*=\\s*\"\\s*" + sep + "\\s*\"\\s*;").exec(text);
      var pB  = new RegExp("P\\.expression2\\s*=\\s*\"\\s*" + sep + "\\s*\"\\s*;").exec(text);
      if (!mR || !pG || !pB)
         throw new Error("Not a separation profile. Expected 'kG = ...' and 'kB = ...' lines, " +
                         "or PixelMath source with R = $T and G/B = $T - ( $T[0] - med( $T[0] ) ) * k.");
      kG = parseFloat(pG[1]);
      kB = parseFloat(pB[1]);
   }
   if (isNaN(kG) || isNaN(kB) || kG < 0 || kG > 1 || kB < 0 || kB > 1)
      throw new Error("Factors must be between 0 and 1 (found kG = " + kG + ", kB = " + kB + ").");
   return { kG: kG, kB: kB };
}

function writeSeparationProfile(path, kG, kB)
{
   var text =
      "# Space Hunter Lazy Workflow - Ha/OIII separation profile\n" +
      "# Camera/filter: " + File.extractName(path) + "\n" +
      "# Saved: " + (new Date()).toISOString().substring(0, 10) + "\n" +
      "# G = $T - ( $T[0] - med( $T[0] ) ) * kG\n" +
      "# B = $T - ( $T[0] - med( $T[0] ) ) * kB\n" +
      "kG = " + kG.toFixed(4) + "\n" +
      "kB = " + kB.toFixed(4) + "\n";
   File.writeTextFile(path, text);
}

function channelMedian(image, c)
{
   image.selectedChannel = c;
   var m = image.median();
   image.resetSelections();
   return m;
}

function runSeparation()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 2a: Ha/OIII separation (dual-band OSC)");
   console.writeln("=".repeat(80) + "\n");

   let win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");
   let view = win.mainView;

   var kG = WorkflowParameters.sepGreenFactor;
   var kB = WorkflowParameters.sepBlueFactor;

   if (!view.image.isColor) {
      console.warningln("⚠  Not a color image - separation skipped.\n");
      return;
   }
   if (kG <= 0 && kB <= 0) {
      console.warningln("⚠  Both factors are 0 - separation skipped.\n");
      return;
   }
   if (shHasMark(view, "SpaceHunter:SeparationDone")) {
      console.writeln("✔ Separation already applied to this image - skipped.\n");
      return;
   }
   // SPFC measured the image before separation: its calibration would not
   // match the separated channels. Same check runSPFC() uses.
   if (shSpfcApplied(view)) {
      console.warningln("⚠  SPFC is already applied to this image - separation skipped.");
      console.warningln("   To separate, undo SPFC in History Explorer and run again.\n");
      return;
   }

   var img = view.image;
   var g0 = channelMedian(img, 1), b0 = channelMedian(img, 2);

   console.writeln("Green factor kG: " + kG.toFixed(4));
   console.writeln("Blue factor  kB: " + kB.toFixed(4));

   var P = buildSeparationPixelMath(kG, kB);
   if (!P.executeOn(view))
      throw new Error("Ha/OIII separation (PixelMath) failed.");
   shMarkDone(view, "SpaceHunter:SeparationDone");

   img = view.image;
   console.writeln("Median G: " + g0.toExponential(4) + " -> " + channelMedian(img, 1).toExponential(4));
   console.writeln("Median B: " + b0.toExponential(4) + " -> " + channelMedian(img, 2).toExponential(4));
   console.writeln("✔ Separation applied.\n");
}

function runSPFC()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 2b: Running SPFC (Dynamic XSPD Version)");
   console.writeln("=".repeat(80) + "\n");

   var spfcStartTime = Date.now();

   let win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");
   let view = win.mainView;   // never a preview tab that happens to be selected
   if (view.isNull)
      return;

   // Pre-flight check: verify astrometric solution exists before attempting SPFC
   // (checks the modern "AstrometricSolution:*" namespace and legacy "PCL:...")
   if (!shHasSolution(view))
      throw new Error("No astrometric solution found - please run ImageSolver before running SPFC.");

   // Check if SPFC was already applied
   console.writeln("Checking processing history for SPFC...");

   var spfcAlreadyApplied = shSpfcApplied(view);

   if (spfcAlreadyApplied) {
      console.writeln("\u2714 SPFC already applied to this image");
      console.writeln("  Skipping SPFC step to avoid re-calibration");
      console.writeln("=".repeat(80) + "\n");
      return;
   }

   console.writeln("  No SPFC found in history - proceeding with calibration\n");

   var wr = whiteRefList[WorkflowParameters.selectedWhiteRefIdx];
   var cam = cameraList[WorkflowParameters.selectedCameraIdx];
   var flt = filterList[WorkflowParameters.selectedFilterIdx];

   // Camera QE — always needed
   var qeCurve = getFilterData(cam.xspdName, "Q");
   if (!qeCurve)
      throw new Error("Camera QE curve not found: " + cam.xspdName);

   var gray = grayFilterList[WorkflowParameters.selectedGrayIdx];
   var grayData = null, redData = null, greenData = null, blueData = null;

   if ( !WorkflowParameters.enableNarrowband ) {
      // Broadband mode — load gray + RGB filter curves
      grayData  = getFilterData(gray.name, gray.channel);
      redData   = getFilterData(flt.redName, "R");
      greenData = getFilterData(flt.greenName, "G");
      blueData  = getFilterData(flt.blueName, "B");
      if (!grayData)  throw new Error("Gray filter not found: " + gray.name);
      if (!redData)   throw new Error("Red filter not found: " + flt.redName);
      if (!greenData) throw new Error("Green filter not found: " + flt.greenName);
      if (!blueData)  throw new Error("Blue filter not found: " + flt.blueName);
      console.writeln("White ref:  " + wr.name);
      console.writeln("Camera QE:  " + cam.xspdName + " (" + qeCurve.length + " chars)");
      console.writeln("Gray:       " + gray.name + " (" + grayData.length + " chars)");
      console.writeln("Red filter: " + flt.redName + " (" + redData.length + " chars)");
      console.writeln("Green:      " + flt.greenName + " (" + greenData.length + " chars)");
      console.writeln("Blue:       " + flt.blueName + " (" + blueData.length + " chars)");
   } else {
      console.writeln("White ref:  " + wr.name);
      console.writeln("Camera QE:  " + cam.xspdName + " (" + qeCurve.length + " chars)");
      console.writeln("Filter curves: not used in narrowband mode");
   }
   console.writeln("\nRunning SPFC on view: " + view.id + "\n");

   var P = new SpectrophotometricFluxCalibration;
   P.narrowbandMode = WorkflowParameters.enableNarrowband;

   // Minimal flat transmission curve — required by SPFC even in narrowband mode
   var flatCurve = "300,0,350,0,400,1,500,1,600,1,700,1,750,0,800,0";

   if ( WorkflowParameters.enableNarrowband ) {
      // Narrowband mode — flat placeholder curves, wavelength/bandwidth drives calibration
      P.grayFilterTrCurve     = flatCurve;
      P.grayFilterName        = "Narrowband";
      P.grayFilterWavelength  = WorkflowParameters.nbRedWavelength;
      P.grayFilterBandwidth   = WorkflowParameters.nbRedBandwidth;
      P.redFilterTrCurve      = flatCurve;
      P.redFilterName         = "Narrowband";
      P.redFilterWavelength   = WorkflowParameters.nbRedWavelength;
      P.redFilterBandwidth    = WorkflowParameters.nbRedBandwidth;
      P.greenFilterTrCurve    = flatCurve;
      P.greenFilterName       = "Narrowband";
      P.greenFilterWavelength = WorkflowParameters.nbGreenWavelength;
      P.greenFilterBandwidth  = WorkflowParameters.nbGreenBandwidth;
      P.blueFilterTrCurve     = flatCurve;
      P.blueFilterName        = "Narrowband";
      P.blueFilterWavelength  = WorkflowParameters.nbBlueWavelength;
      P.blueFilterBandwidth   = WorkflowParameters.nbBlueBandwidth;
      console.writeln("Narrowband mode:");
      console.writeln("  Gray:  " + WorkflowParameters.nbRedWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbRedBandwidth.toFixed(2) + " nm BW (matches Red)");
      console.writeln("  Red:   " + WorkflowParameters.nbRedWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbRedBandwidth.toFixed(2) + " nm BW");
      console.writeln("  Green: " + WorkflowParameters.nbGreenWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbGreenBandwidth.toFixed(2) + " nm BW");
      console.writeln("  Blue:  " + WorkflowParameters.nbBlueWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbBlueBandwidth.toFixed(2) + " nm BW");
   } else {
      // Broadband mode — use filter curves from XSPD
      P.grayFilterTrCurve    = grayData;
      P.grayFilterName       = gray.name;
      P.redFilterTrCurve     = redData;
      P.redFilterName        = flt.redName;
      P.greenFilterTrCurve   = greenData;
      P.greenFilterName      = flt.greenName;
      P.blueFilterTrCurve    = blueData;
      P.blueFilterName       = flt.blueName;
   }

   // Camera QE from XSPD
   P.deviceQECurve = qeCurve;
   P.deviceQECurveName = cam.xspdName;

   // Standard SPFC parameters
   P.broadbandIntegrationStepSize = 0.50;
   P.narrowbandIntegrationSteps = 10;
   P.rejectionLimit = 0.30;
   P.catalogId = "GaiaDR3SP";
   P.minMagnitude = 0.00;
   P.limitMagnitude = 12.00;
   P.autoLimitMagnitude = true;
   P.psfStructureLayers = 5;
   P.saturationThreshold = 0.75;
   P.saturationRelative = true;
   P.saturationShrinkFactor = 0.10;
   P.psfNoiseLayers = 1;
   P.psfHotPixelFilterRadius = 1;
   P.psfNoiseReductionFilterRadius = 0;
   P.psfMinStructureSize = 0;
   P.psfMinSNR = 40.0;
   P.psfAllowClusteredSources = false;
   P.psfType = SpectrophotometricFluxCalibration.PSFType_Auto;
   P.psfGrowth = 1.75;
   P.psfMaxStars = 24576;
   P.psfSearchTolerance = 4.0;
   P.psfChannelSearchTolerance = 2.0;
   P.generateGraphs = WorkflowParameters.generateSPFCGraphs;
   P.generateStarMaps = false;
   P.generateTextFiles = false;
   P.outputDirectory = "";

   if (!P.executeOn(view))
      throw new Error("SPFC execution failed.");
   shMarkDone(view, "SpaceHunter:SPFCDone");

   // The graph window can't be minimized from a script; put the image back in
   // front of it instead so it is out of the way but still available.
   if (WorkflowParameters.generateSPFCGraphs) {
      win.bringToFront();
      CoreApplication.processEvents();
   }

   var spfcElapsed = (Date.now() - spfcStartTime) / 1000;
   var spfcMin = Math.floor(spfcElapsed / 60);
   var spfcSec = (spfcElapsed % 60).toFixed(2);
   console.writeln(spfcMin > 0 ? (spfcMin + "m " + spfcSec + "s") : (spfcSec + "s"));
   console.writeln("SPFC completed successfully.\n");
}

// ============================================================
// STEP 3: Create Previews (variable count)
// ============================================================

// count: number of previews; defaults to the Previews section setting.
// MGC runs planned by createPreviews: [{id, scale, auto, group}], null when
// MGC runs on previews the script did not create.
var shMgcPlan = null;

function createPreviews(prefix, count, step)
{
   if (prefix === undefined) prefix = "BM_";
   if (step === undefined) step = "3";

   var numPreviews = (count !== undefined) ? count : WorkflowParameters.numPreviews;

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP " + step + ": Creating " + numPreviews + " Preview(s)");
   console.writeln("=".repeat(80) + "\n");

   var pvStartTime = Date.now();

   let win = ImageWindow.activeWindow;
   if ( win.isNull )
   {
      console.criticalln( "No active image window." );
      return;
   }

   // Remove existing previews
   let existing = win.previews;
   for ( let i = 0; i < existing.length; ++i )
      win.deletePreview( existing[i] );

   let img  = win.mainView.image;
   let rect = new Rect( 0, 0, img.width, img.height );

   let previews = [];
   // MGC previews: one entry per MGC run, read by runMGCOnPreviews.
   let mgcRuns = (prefix !== "GC_");
   if ( mgcRuns )
      shMgcPlan = [];

   for ( let i = 0; i < numPreviews; ++i )
   {
      let scale = WorkflowParameters.getGradientScale(i);
      let base = (prefix === "BM_") ? (prefix + scale) :
                 (prefix === "GC_") ? (i === 0 ? prefix : prefix + i) :
                 (i === 0 ? prefix : prefix + i);
      let variants = !mgcRuns ? [false] :
                     (WorkflowParameters.mgcScaleMode == "both") ? [false, true] :
                     [WorkflowParameters.mgcScaleMode == "auto"];
      for ( let v = 0; v < variants.length; ++v )
      {
         let auto = variants[v];
         let stem = base + (auto ? MGC_AUTO_SUFFIX : "");
         let id = stem;
         // Same scale twice: BM_1024_1 instead of PixInsight's automatic BM_10241,
         // which reads like a scale of 10241. Same numbering as +Previews.
         for ( let k = 1; previews.some( function( p ) { return p.id == id; } ); ++k )
            id = stem + "_" + k;
         let pv = win.createPreview( rect, id );
         previews.push( pv );
         if ( mgcRuns )
            shMgcPlan.push( { id: pv.id, scale: scale, auto: auto, group: i } );
         console.writeln( "Created preview: " + pv.id );
      }
   }

   // Zoom each preview to fit
   for ( let i = 0; i < previews.length; ++i )
   {
      win.currentView = previews[i];
      win.bringToFront();

      CoreApplication.processEvents();
      CoreApplication.processEvents();

      win.zoomToOptimalFit();

      CoreApplication.processEvents();
      CoreApplication.processEvents();

      console.writeln( "Zoomed preview: " + previews[i].id );
   }

   // Set first preview as active
   win.currentView = previews[0];
   win.bringToFront();
   win.zoomToOptimalFit();

   var pvElapsed = (Date.now() - pvStartTime) / 1000;
   var pvMin = Math.floor(pvElapsed / 60);
   var pvSec = (pvElapsed % 60).toFixed(2);
   console.writeln(pvMin > 0 ? (pvMin + "m " + pvSec + "s") : (pvSec + "s"));
   console.writeln( "Done. " + previews[0].id + " active.\n" );
}

// ============================================================
// STEP 4: MGC on Previews (variable count + per-preview scales)
// ============================================================

// Builds the MGC instance used both for the preview runs and for the tool
// opened at the end, so the opened tool always carries the run's settings.
// autoScale: MGC computes the scale factors itself (autoScaleFactors);
// otherwise they stay at 1.0.
function buildMGCInstance(gradientScale, showGradientModel, autoScale)
{
   var P = new MultiscaleGradientCorrection;
   P.useMARSDatabase = true;
   var marsFiles = resolveMARSFiles();
   if (!marsFiles) {
      console.warningln("No MARS database files found. MGC may fail.");
      P.useMARSDatabase = false;
   } else {
      P.marsDatabaseFiles = marsFiles;
   }
   P.grayMARSFilter  = WorkflowParameters.enableMGCFilters ? WorkflowParameters.mgcGrayFilter  : "L";
   P.redMARSFilter   = WorkflowParameters.enableMGCFilters ? WorkflowParameters.mgcRedFilter    : "R";
   P.greenMARSFilter = WorkflowParameters.enableMGCFilters ? WorkflowParameters.mgcGreenFilter  : "G";
   P.blueMARSFilter  = WorkflowParameters.enableMGCFilters ? WorkflowParameters.mgcBlueFilter   : "B";
   P.referenceImageId = "";
   P.gradientScale = gradientScale;
   P.structureSeparation = 3;
   P.modelSmoothness = 1.00;
   P.minFieldRatio = 0.017;
   P.maxFieldRatio = 0.167;
   P.enforceFieldLimits = true;
   P.scaleFactorRK = 1.0000;
   P.scaleFactorG = 1.0000;
   P.scaleFactorB = 1.0000;
   P.autoScaleFactors = (autoScale === true);
   P.showGradientModel = showGradientModel;
   P.command = "";
   return P;
}

// Scale factors MGC used, per preview id: {auto, sf: [R,G,B], corr: [R,G,B]}.
// Automatic factors are not written back to scaleFactor*; they are only in
// the read-only channelData table of the instance that ran (columns:
// filterId, referenceFluxScaleFactor, targetFluxScaleFactor, referenceFWHM,
// coefficient, scaleFactor, correlation, automatic).
var shMgcFactors = {};

function mgcReadFactors(P)
{
   var cd = P.channelData;
   if (!P.autoScaleFactors || !cd || cd.length < 3)
      return { auto: false, sf: [P.scaleFactorRK, P.scaleFactorG, P.scaleFactorB], corr: null };
   var rows = cd.slice(cd.length - 3);
   return {
      auto: true,
      sf:   rows.map(function(r) { return Number(r[5]); }),
      corr: rows.map(function(r) { return Number(r[6]); })
   };
}

// Factors of a preview's model: from this run, else from the MGC step in
// the preview's history (factors unknown for an automatic run then).
function mgcFactorsOf(preview, P)
{
   var f = shMgcFactors[preview.id];
   if (f)
      return f;
   if (P && P.autoScaleFactors)
      return { auto: true, sf: null, corr: null };
   return { auto: false, sf: P ? [P.scaleFactorRK, P.scaleFactorG, P.scaleFactorB] : [1, 1, 1], corr: null };
}

// "auto SF 1.182 / 0.848! / 0.968!" ("!" = low correlation) or "SF 1.0".
function mgcFactorsText(f, flag)
{
   if (!f.auto)
   {
      var std = f.sf.every(function(v) { return v == 1; });
      return std ? "SF 1.0" : "SF " + f.sf.map(function(v) { return v.toFixed(3); }).join(" / ");
   }
   if (!f.sf)
      return "auto SF";
   if (flag === undefined) flag = "!";
   return "auto SF " + f.sf.map(function(v, c) {
      return v.toFixed(3) + (f.corr[c] < MGC_LOW_CORRELATION ? flag : "");
   }).join(" / ");
}

function mgcCorrelationText(f)
{
   if (!f.auto || !f.corr)
      return "";
   return "correlation R/G/B " + f.corr.map(function(v) { return v.toFixed(3); }).join(" / ");
}

function mgcSameFactors(a, b)
{
   for (var c = 0; c < 3; ++c)
      if (Math.abs(a.sf[c] - b.sf[c]) > 5e-4)
         return false;
   return true;
}

// The automatic factors when every automatic model with known factors has the
// same ones (normal case: they don't depend on the gradient scale), else null.
function mgcSharedFactors(previews)
{
   var shared = null;
   for (var i = 0; i < previews.length; ++i)
   {
      var f = mgcFactorsOf(previews[i], bgmMgcInstanceOf(previews[i]));
      if (!f.auto || !f.sf || !f.corr)
         continue;
      if (shared == null)
         shared = f;
      else if (!mgcSameFactors(f, shared))
         return null;
   }
   return shared;
}

// Model panel header lines for the automatic factors (shared: from
// mgcSharedFactors; anyAuto: the panel holds automatic models at all).
function mgcFactorsHeader(shared, anyAuto)
{
   if (!anyAuto)
      return "";
   var flagged = false;
   var text = "";
   if (shared)
   {
      var corr = shared.corr.map(function(v) {
         if (v < MGC_LOW_CORRELATION) { flagged = true; return v.toFixed(3) + " ⚠"; }
         return v.toFixed(3);
      });
      text = "<br/>Automatic scale factors R/G/B (all scales): <b>" +
         shared.sf.map(function(v) { return v.toFixed(3); }).join(" / ") + "</b>" +
         "<br/>Correlation R/G/B: " + corr.join(" / ");
   }
   else
      flagged = true;   // per-row factors may carry a flag
   if (flagged)
      text += "<br/>⚠ = correlation below " + MGC_LOW_CORRELATION.toFixed(2) +
         ": that channel's automatic factor is uncertain - compare with the 1.0 model.";
   return text;
}

function mgcLogFactors(f)
{
   if (!f.auto)
   {
      console.writeln("Scale factors: " + mgcFactorsText(f));
      return;
   }
   console.writeln("Automatic scale factors R/G/B: " +
      f.sf.map(function(v) { return v.toFixed(4); }).join(" / ") +
      "   (" + mgcCorrelationText(f) + ")");
   var low = [];
   for (var c = 0; c < 3; ++c)
      if (f.corr[c] < MGC_LOW_CORRELATION)
         low.push("RGB"[c]);
   if (low.length > 0)
      console.warningln("⚠  Low correlation (< " + MGC_LOW_CORRELATION.toFixed(2) + ") in " +
         low.join("/") + ": the automatic factor there is uncertain - compare with the 1.0 model.");
}

function runMGC(view, gradientScale, previewName, autoScale)
{
   console.writeln("\n" + "-".repeat(80));
   console.writeln("Processing: " + previewName);
   console.writeln("Gradient Scale: " + gradientScale +
      "   Scale factors: " + (autoScale ? "automatic" : "1.0"));
   console.writeln("-".repeat(80));

   // Preview runs keep the gradient model windows for comparing scales.
   var P = buildMGCInstance(gradientScale, true, autoScale);

   var t0 = Date.now();
   if (!P.executeOn(view))
      throw new Error("MultiscaleGradientCorrection failed on " + previewName);

   var f = mgcReadFactors(P);
   shMgcFactors[view.id] = f;
   mgcLogFactors(f);
   console.writeln(previewName + " completed in " + ((Date.now() - t0) / 1000).toFixed(1) + " s.");
}

// Pause after each preview's MGC run so the user can see the result before the
// next preview becomes active. Events keep pumping so the window repaints and
// the console's abort button stays live.
var MGC_PREVIEW_PAUSE_MS = 3000;

function showPreview(win, preview)
{
   win.currentView = preview;
   win.bringToFront();
   CoreApplication.processEvents();
   CoreApplication.processEvents();
}

// Text of a caught exception. A PI process stopped with Abort throws an object
// without .message ("Process aborted"), so .message alone can be undefined.
function shErrorText(e)
{
   if (e && e.message !== undefined)
      return String(e.message);
   return String(e);
}

// True if the exception means the user stopped the script: our own cancel,
// or a PI process aborted from the Process Console.
function shIsCancel(e)
{
   var t = shErrorText(e);
   return t === "Script cancelled by user." || t.indexOf("Process aborted") >= 0 ||
          console.abortRequested;
}

function pauseWithEvents(ms)
{
   var end = Date.now() + ms;
   while (Date.now() < end)
   {
      if (console.abortRequested)
         throw new Error("Script cancelled by user.");
      CoreApplication.processEvents();
      System.msleep(100);
   }
}

function runMGCOnPreviews()
{
   var numPreviews = WorkflowParameters.numPreviews;

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 4: MGC Multi-Preview Processor (" + numPreviews + " previews)");
   console.writeln("=".repeat(80) + "\n");

   var mgcStartTime = Date.now();

   var win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");

   var previews = win.previews;

   console.writeln("Found " + previews.length + " preview(s) in image: " + win.mainView.id + "\n");

   var runs = mgcRunOrder(previews);
   if (runs.length == 0)
      throw new Error("This script requires " + numPreviews + " previews. Found only " + previews.length);

   for (var i = 0; i < runs.length; i++)
   {
      var preview = runs[i].preview;

      console.writeln("Processing preview " + (i + 1) + " of " + runs.length + ": " + preview.id);

      // Make the preview being processed the active tab, so the user follows along.
      showPreview(win, preview);

      runMGC(preview, runs[i].scale, preview.id, runs[i].auto);

      // The preview now holds this scale's gradient model (showGradientModel);
      // bring it back to the front and hold it before moving on to the next scale.
      showPreview(win, preview);
      pauseWithEvents(MGC_PREVIEW_PAUSE_MS);
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("ALL PREVIEWS PROCESSED SUCCESSFULLY");
   console.writeln("=".repeat(80));
   var mgcElapsed = (Date.now() - mgcStartTime) / 1000;
   var mgcMin = Math.floor(mgcElapsed / 60);
   var mgcSec = (mgcElapsed % 60).toFixed(2);
   console.writeln(mgcMin > 0 ? (mgcMin + "m " + mgcSec + "s") : (mgcSec + "s"));
   console.writeln("\nGradient scales applied:");
   for (var i = 0; i < runs.length; i++)
      console.writeln("  " + runs[i].preview.id + ": " + runs[i].scale + ", " +
         mgcFactorsText(shMgcFactors[runs[i].preview.id]));
   console.writeln("\n");
}

// MGC runs as [{preview, scale, auto}]. From createPreviews' plan when it
// made the previews (per scale the automatic run first: the run after it at
// the same scale reuses more of MGC's cache, test 2026-11-01), else the
// window's first numPreviews previews with the dialog's scales; in Both mode
// a preview named *_autoSF* there gets the automatic factors.
function mgcRunOrder(previews)
{
   var byId = {};
   for (var i = 0; i < previews.length; ++i)
      byId[previews[i].id] = previews[i];

   var runs = [];
   if (shMgcPlan != null && shMgcPlan.length > 0 &&
       shMgcPlan.every(function(e) { return byId[e.id] !== undefined; }))
   {
      var plan = shMgcPlan.slice();
      plan.sort(function(a, b) {
         if (a.group != b.group) return a.group - b.group;
         return (b.auto ? 1 : 0) - (a.auto ? 1 : 0);
      });
      for (var i = 0; i < plan.length; ++i)
         runs.push({ preview: byId[plan[i].id], scale: plan[i].scale, auto: plan[i].auto });
      return runs;
   }

   var numPreviews = WorkflowParameters.numPreviews;
   if (previews.length < numPreviews)
      return runs;
   var mode = WorkflowParameters.mgcScaleMode;
   for (var i = 0; i < numPreviews; ++i)
      runs.push({
         preview: previews[i],
         scale: WorkflowParameters.getGradientScale(i),
         auto: mode == "auto" || (mode == "both" && previews[i].id.indexOf(MGC_AUTO_SUFFIX) >= 0)
      });
   return runs;
}

// ============================================================
// STEP 5: GradientCorrection on 2 Previews (fallback or manual)
// ============================================================

// preset: one entry of GC_PRESETS.
function runGC(view, preset, previewName)
{
   console.writeln("\n" + "-".repeat(80));
   console.writeln("Processing: " + previewName);
   console.writeln(gcPresetText(preset));
   console.writeln("-".repeat(80));

   var P = new GradientCorrection;
   P.reference = 0.50;
   P.lowThreshold = 0.20;
   P.lowTolerance = 0.50;
   P.highThreshold = preset.highThreshold;
   P.highTolerance = preset.highTolerance;
   P.iterations = 15;
   P.scale = 5.00;
   P.smoothness = 0.40;
   P.downsamplingFactor = 16;
   P.protection = true;
   P.protectionThreshold = preset.protectionThreshold;
   P.protectionAmount = preset.protectionAmount;
   P.protectionSmoothingFactor = 16;
   P.lowClippingLevel = 0.000076;
   P.automaticConvergence = true;
   P.convergenceLimit = 0.00001000;
   P.maxIterations = 10;
   P.useSimplification = true;
   P.simplificationDegree = 1;
   P.simplificationScale = 1024;
   P.generateSimpleModel = false;
   P.generateGradientModel = true;
   P.generateProtectionMasks = false;
   P.gridSamplingDelta = 16;

   if (!P.executeOn(view))
      throw new Error("GradientCorrection failed on " + previewName);

   console.writeln(previewName + " completed successfully.");
}

// The two GC settings compared on GC_ and GC_1 (everything else as in runGC).
// GC_  : GradientCorrection defaults - follows the gradient shape more closely,
//        but can leave blotches on nebula-rich fields.
// GC_1 : stronger structure protection - smoother model that spares nebulae,
//        but may under-correct. Chosen from the Sadr test, 2026-10-06.
var GC_PRESETS = [
   { highThreshold: 0.05, highTolerance: 0.00, protectionThreshold: 0.10, protectionAmount: 0.50 },
   { highThreshold: 0.05, highTolerance: 0.00, protectionThreshold: 0.05, protectionAmount: 0.70 }
];

function gcPresetText(preset)
{
   return "highThreshold=" + preset.highThreshold.toFixed(2) +
          ", highTolerance=" + preset.highTolerance.toFixed(2) +
          ", protectionThreshold=" + preset.protectionThreshold.toFixed(2) +
          ", protectionAmount=" + preset.protectionAmount.toFixed(2);
}

function shWindowIds()
{
   var ids = {};
   var w = ImageWindow.windows;
   for (var i = 0; i < w.length; i++)
      ids[w[i].mainView.id] = true;
   return ids;
}

// GC names its model windows itself: GC_gradient_model, GC_gradient_model1, ...
// The previews follow the same pattern (GC_, GC_1, ...) so preview n matches
// model n - also for further manual GC runs on previews added with +Previews.
function gcExpectedModelId(previewId)
{
   return "GC_gradient_model" + previewId.substring("GC_".length);
}

// Runs GC_PRESETS[i] on previews[i]. Returns the model window ids.
function runGCOnPreviews()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 5: GradientCorrection on " + GC_PRESETS.length + " previews");
   console.writeln("=".repeat(80) + "\n");

   var gcStartTime = Date.now();

   var win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");

   var previews = win.previews;
   console.writeln("Found " + previews.length + " preview(s) in image: " + win.mainView.id + "\n");

   if (previews.length < GC_PRESETS.length)
      throw new Error("GradientCorrection requires " + GC_PRESETS.length + " previews. Found only " + previews.length);

   var modelIds = [];
   for (var i = 0; i < GC_PRESETS.length; i++)
   {
      var before = shWindowIds();
      runGC(previews[i], GC_PRESETS[i], previews[i].id);

      var w = ImageWindow.windows;
      for (var j = 0; j < w.length; j++)
         if (!before[w[j].mainView.id])
         {
            var id = w[j].mainView.id;
            modelIds.push(id);
            // Leftover GC_gradient_model* windows from earlier runs shift
            // GC's numbering, so preview and model numbers no longer match.
            if (id != gcExpectedModelId(previews[i].id))
               console.warningln("⚠  " + previews[i].id + " produced model " + id +
                  " (expected " + gcExpectedModelId(previews[i].id) + "). Close old " +
                  "GC_gradient_model windows before running GC to keep the numbers matched.");
         }
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("GC PREVIEWS PROCESSED SUCCESSFULLY");
   console.writeln("=".repeat(80));
   console.writeln("\nSettings applied:");
   for (var i = 0; i < GC_PRESETS.length; i++)
      console.writeln("  " + previews[i].id + ": " + gcPresetText(GC_PRESETS[i]));
   if (modelIds.length > 0)
      console.writeln("  Gradient models: " + modelIds.join(", "));
   var gcElapsed = (Date.now() - gcStartTime) / 1000;
   var gcMin = Math.floor(gcElapsed / 60);
   var gcSec = (gcElapsed % 60).toFixed(2);
   console.writeln(gcMin > 0 ? (gcMin + "m " + gcSec + "s") : (gcSec + "s"));
   console.writeln("\n");
   return modelIds;
}

function openGCTool()
{
   console.writeln("Opening GradientCorrection tool...\n");
   var gc = new GradientCorrection;
   gc.reference = 0.50;
   gc.lowThreshold = 0.20;
   gc.lowTolerance = 0.50;
   gc.highThreshold = 0.05;
   gc.highTolerance = 0.00;
   gc.iterations = 15;
   gc.scale = 5.00;
   gc.smoothness = 0.40;
   gc.downsamplingFactor = 16;
   gc.protection = true;
   gc.protectionThreshold = 0.10;
   gc.protectionAmount = 0.50;
   gc.protectionSmoothingFactor = 16;
   gc.lowClippingLevel = 0.000076;
   gc.automaticConvergence = false;
   gc.convergenceLimit = 0.00001000;
   gc.maxIterations = 10;
   gc.useSimplification = false;
   gc.simplificationDegree = 1;
   gc.simplificationScale = 1024;
   gc.generateSimpleModel = false;
   gc.generateGradientModel = false;
   gc.generateProtectionMasks = false;
   gc.gridSamplingDelta = 16;
   gc.launch();
}

function openDBETool()
{
   console.writeln("Opening DynamicBackgroundExtraction tool...\n");
   var dbe = new DynamicBackgroundExtraction;
   dbe.data = [
      [0.00951695, 0.01424808, 0.00341546, 0.958, 0.00658247, 0.950, 0.00366719, 0.951],
      [0.17914267, 0.01005747, 0.00370514, 0.947, 0.00657792, 0.950, 0.00366891, 0.949],
      [0.34149072, 0.00838123, 0.00372428, 0.943, 0.00657166, 0.952, 0.00365352, 0.952],
      [0.49432182, 0.00586686, 0.00349227, 0.971, 0.00651896, 0.960, 0.00363122, 0.951],
      [0.68130198, 0.00838123, 0.00362543, 0.964, 0.00655951, 0.954, 0.00365450, 0.950],
      [0.85036788, 0.00586686, 0.00349707, 0.967, 0.00658097, 0.948, 0.00366500, 0.944],
      [0.99368202, 0.00586686, 0.00346937, 0.959, 0.00661373, 0.936, 0.00369397, 0.940],
      [0.99480166, 0.25143678, 0.00348773, 0.968, 0.00657299, 0.952, 0.00366469, 0.951],
      [0.99592131, 0.49197797, 0.00339476, 0.948, 0.00653569, 0.955, 0.00364668, 0.949],
      [0.99592131, 0.72581418, 0.00338211, 0.946, 0.00651145, 0.955, 0.00362963, 0.947],
      [0.99368202, 0.98814655, 0.00334217, 0.930, 0.00652308, 0.953, 0.00363259, 0.947],
      [0.85764555, 0.99317529, 0.00334920, 0.935, 0.00646800, 0.951, 0.00360928, 0.947],
      [0.68466091, 0.99233716, 0.00338679, 0.948, 0.00640714, 0.939, 0.00357139, 0.942],
      [0.50775752, 0.98982280, 0.00346771, 0.967, 0.00637533, 0.928, 0.00355381, 0.937],
      [0.34428983, 0.99149904, 0.00350546, 0.968, 0.00639263, 0.931, 0.00356606, 0.940],
      [0.16738644, 0.99317529, 0.00340002, 0.950, 0.00640573, 0.936, 0.00356845, 0.938],
      [0.00391875, 0.99149904, 0.00342210, 0.956, 0.00641846, 0.940, 0.00357075, 0.937],
      [0.00279910, 0.73754789, 0.00335346, 0.940, 0.00643456, 0.948, 0.00358923, 0.946],
      [0.00335893, 0.50622605, 0.00335388, 0.941, 0.00645136, 0.952, 0.00360355, 0.948],
      [0.00239923, 0.26065613, 0.00340259, 0.952, 0.00651146, 0.956, 0.00363900, 0.949]
   ];
   dbe.numberOfChannels = 3;
   dbe.derivativeOrder = 2;
   dbe.smoothing = 0.600;
   dbe.ignoreWeights = false;
   dbe.modelId = "";
   dbe.modelWidth = 0;
   dbe.modelHeight = 0;
   dbe.downsample = 2;
   dbe.modelSampleFormat = DynamicBackgroundExtraction.f32;
   dbe.targetCorrection = DynamicBackgroundExtraction.Divide;
   dbe.normalize = true;
   dbe.discardModel = false;
   dbe.replaceTarget = false;
   dbe.correctedImageId = "";
   dbe.correctedImageSampleFormat = DynamicBackgroundExtraction.SameAsTarget;
   dbe.samples = [
      [119, 119, 30, 0, 6, 0, 0.003415, 0.958, 0.006582, 0.950, 0.003667, 0.951],
      [2240, 84, 30, 0, 6, 0, 0.003705, 0.947, 0.006578, 0.950, 0.003669, 0.949],
      [4270, 70, 30, 0, 6, 0, 0.003724, 0.943, 0.006572, 0.952, 0.003654, 0.952],
      [6181, 49, 30, 0, 6, 0, 0.003492, 0.971, 0.006519, 0.960, 0.003631, 0.951],
      [8519, 70, 30, 0, 6, 0, 0.003625, 0.964, 0.006560, 0.954, 0.003655, 0.950],
      [10633, 49, 30, 0, 6, 0, 0.003497, 0.967, 0.006581, 0.948, 0.003665, 0.944],
      [12425, 49, 30, 0, 6, 0, 0.003469, 0.959, 0.006614, 0.936, 0.003694, 0.940],
      [12439, 2100, 30, 0, 6, 0, 0.003488, 0.968, 0.006573, 0.952, 0.003665, 0.951],
      [12453, 4109, 30, 0, 6, 0, 0.003395, 0.948, 0.006536, 0.955, 0.003647, 0.949],
      [12453, 6062, 30, 0, 6, 0, 0.003382, 0.946, 0.006511, 0.955, 0.003630, 0.947],
      [12425, 8253, 30, 0, 6, 0, 0.003342, 0.930, 0.006523, 0.953, 0.003633, 0.947],
      [10724, 8295, 30, 0, 6, 0, 0.003349, 0.935, 0.006468, 0.951, 0.003609, 0.947],
      [8561, 8288, 30, 0, 6, 0, 0.003387, 0.948, 0.006407, 0.939, 0.003571, 0.942],
      [6349, 8267, 30, 0, 6, 0, 0.003468, 0.967, 0.006375, 0.928, 0.003554, 0.937],
      [4305, 8281, 30, 0, 6, 0, 0.003505, 0.968, 0.006393, 0.931, 0.003566, 0.940],
      [2093, 8295, 30, 0, 6, 0, 0.003400, 0.950, 0.006406, 0.936, 0.003568, 0.938],
      [49, 8281, 30, 0, 6, 0, 0.003422, 0.956, 0.006418, 0.940, 0.003571, 0.937],
      [35, 6160, 30, 0, 6, 0, 0.003353, 0.940, 0.006435, 0.948, 0.003589, 0.946],
      [42, 4228, 30, 0, 6, 0, 0.003354, 0.941, 0.006451, 0.952, 0.003604, 0.948],
      [30, 2177, 30, 0, 6, 0, 0.003403, 0.952, 0.006511, 0.956, 0.003639, 0.949]
   ];
   dbe.imageWidth = 12504;
   dbe.imageHeight = 8352;
   dbe.symmetryCenterX = 0.500000;
   dbe.symmetryCenterY = 0.500000;
   dbe.tolerance = 2.000;
   dbe.shadowsRelaxation = 6.000;
   dbe.minSampleFraction = 0.050;
   dbe.defaultSampleRadius = 30;
   dbe.samplesPerRow = 10;
   dbe.minWeight = 0.750;
   dbe.sampleColor = 4292927712;
   dbe.selectedSampleColor = 4278255360;
   dbe.selectedSampleFillColor = 0;
   dbe.badSampleColor = 4294901760;
   dbe.badSampleFillColor = 2164195328;
   dbe.axisColor = 4292927712;
   dbe.launch();
}

// ============================================================
// Auto Display Stretch (GC gradient model images): PixInsight's
// ScreenTransferFunction set with the AutoSTF method
// ============================================================

function applyDisplayStretch(targetWindow)
{
   targetWindow.bringToFront();
   var view = targetWindow.mainView;
   var img = view.image;

   var CLIP_SIGMA = 2.8;
   var MADN_BLEND = 0.25;
   var FALLBACK_THRESHOLD_MIN = 0.000070;
   var FALLBACK_THRESHOLD_MAX = 0.000260;
   var TARGET_BRIGHT = 0.26;
   var TARGET_FAINT  = 0.30;
   var MEDIAN_FAINT  = 0.0005;
   var MEDIAN_BRIGHT = 0.008;
   var MIN_NORMALIZED_MEDIAN = 1.0e-7;

   function brightnessBlend(value, low, high) {
      if (value <= low) return 0.0;
      if (value >= high) return 1.0;
      var logVal  = Math.log(value);
      var logLow  = Math.log(low);
      var logHigh = Math.log(high);
      return (logVal - logLow) / (logHigh - logLow);
   }

   function lerp(a, b, t) {
      return a + (b - a) * t;
   }

   if (img.isColor) {
      var medians = [];
      var mads = [];
      var madns = [];
      for (var c = 0; c < 3; ++c) {
         img.selectedChannel = c;
         medians[c] = img.median();
         mads[c] = img.MAD();
         madns[c] = mads[c] * 1.4826;
      }

      var avgMADN = (madns[0] + madns[1] + madns[2]) / 3.0;
      var results = [];

      for (var c = 0; c < 3; ++c) {
         var median = medians[c];
         var mad = mads[c];
         var madn = madns[c];
         var blendedMADN = lerp(madn, avgMADN, MADN_BLEND);
         var blend = brightnessBlend(median, MEDIAN_FAINT, MEDIAN_BRIGHT);
         var targetBrightness = lerp(TARGET_FAINT, TARGET_BRIGHT, blend);

         var c0;
         if (mad > 0 && isFinite(mad)) {
            c0 = median - CLIP_SIGMA * blendedMADN;
         } else {
            var threshold = lerp(FALLBACK_THRESHOLD_MIN, FALLBACK_THRESHOLD_MAX, blend);
            c0 = median - threshold;
         }
         c0 = Math.max(c0, 0.0);

         var normalizedMedian;
         if ((1.0 - c0) <= 0) {
            normalizedMedian = MIN_NORMALIZED_MEDIAN;
         } else {
            normalizedMedian = (median - c0) / (1.0 - c0);
         }
         normalizedMedian = Math.max(normalizedMedian, MIN_NORMALIZED_MEDIAN);

         var m = Math.mtf(targetBrightness, normalizedMedian);
         m = Math.max(0.0001, Math.min(m, 0.9999));

         results[c] = { c0: c0, m: m };
      }

      var P = new ScreenTransferFunction;
      P.STF = [
         [results[0].c0, 1.0, results[0].m, 0.0, 1.0],
         [results[1].c0, 1.0, results[1].m, 0.0, 1.0],
         [results[2].c0, 1.0, results[2].m, 0.0, 1.0],
         [0.5, 1.0, 0.0, 0.0, 1.0]
      ];
      P.interaction = ScreenTransferFunction.SeparateChannels;
      P.executeOn(view, false);

   } else {
      img.selectedChannel = 0;
      var median = img.median();
      var mad = img.MAD();
      var madn = mad * 1.4826;
      var blend = brightnessBlend(median, MEDIAN_FAINT, MEDIAN_BRIGHT);
      var targetBrightness = lerp(TARGET_FAINT, TARGET_BRIGHT, blend);

      var c0;
      if (mad > 0 && isFinite(mad)) {
         c0 = median - CLIP_SIGMA * madn;
      } else {
         var threshold = lerp(FALLBACK_THRESHOLD_MIN, FALLBACK_THRESHOLD_MAX, blend);
         c0 = median - threshold;
      }
      c0 = Math.max(c0, 0.0);

      var normalizedMedian;
      if ((1.0 - c0) <= 0) {
         normalizedMedian = MIN_NORMALIZED_MEDIAN;
      } else {
         normalizedMedian = (median - c0) / (1.0 - c0);
      }
      normalizedMedian = Math.max(normalizedMedian, MIN_NORMALIZED_MEDIAN);

      var m = Math.mtf(targetBrightness, normalizedMedian);
      m = Math.max(0.0001, Math.min(m, 0.9999));

      var P = new ScreenTransferFunction;
      P.STF = [
         [c0, 1.0, m, 0.0, 1.0],
         [0.0, 1.0, 0.5, 0.0, 1.0],
         [0.0, 1.0, 0.5, 0.0, 1.0],
         [0.5, 1.0, 0.0, 0.0, 1.0]
      ];
      P.executeOn(view, false);
   }

   img.resetChannelSelection();
}

// ============================================================
// STEP 4b: Choose background model (apply a preview's MGC model)
// ------------------------------------------------------------
// MGC keeps only its LAST run cached: re-applying the last scale takes ~2 s,
// any other scale is a full recompute (measured 2026-10-05 on a 12438x8264
// image: ~32 s at 1024, ~210 s at 3072). The MARS / photometry part (~200 s
// on the first run) is cached across scale and scale-factor changes
// (test 2026-11-01 on two ~12k x 8k images).
//
// The preview runs use showGradientModel = true, which makes MGC write the
// GRADIENT MODEL into each full-frame preview. MGC's correction is, per
// channel:   corrected = original - model + median(model)
// Verified 2026-10-05 against MGC's own output at scales 1024 and 3072:
// max difference 6e-8 (float32 rounding). So the corrected image for ANY
// preview's scale is rebuilt instantly from its model, instead of re-running
// MGC on the main image.
//
// PixelMath cannot reference previews, and per-pixel script loops take
// minutes on large images, so the model is copied into a temporary image
// (fast native assign) and PixelMath does the subtraction.
// ============================================================

// The MGC instance that produced a preview, read from the preview's history.
function bgmMgcInstanceOf(preview)
{
   var pc = preview.processing;
   for (var i = pc.length - 1; i >= 0; --i)
      if (pc[i].processId() == "MultiscaleGradientCorrection")
         return pc[i];
   return null;
}

function bgmDescribe(P)
{
   return "gradientScale " + P.gradientScale +
          ", structureSeparation " + P.structureSeparation +
          ", modelSmoothness " + P.modelSmoothness.toFixed(2) +
          ", MARS filters " + P.grayMARSFilter + "/" + P.redMARSFilter + "/" +
          P.greenMARSFilter + "/" + P.blueMARSFilter +
          ", scale factors " + (P.autoScaleFactors ? "automatic" : "1.0");
}

// Full-frame previews of the window that carry an MGC step (any name).
function bgmPreviews(win)
{
   var list = [];
   var pv = win.previews;
   var W = win.mainView.image.width, H = win.mainView.image.height;
   for (var i = 0; i < pv.length; ++i)
      if (pv[i].image.width == W && pv[i].image.height == H &&
          bgmMgcInstanceOf(pv[i]) != null)
         list.push(pv[i]);
   return list;
}

function bgmChannelMedians(image)
{
   var med = [];
   for (var c = 0; c < image.numberOfChannels; ++c)
   {
      image.selectedChannel = c;
      med.push(image.median());
   }
   image.resetSelections();
   return med;
}

// view = view - model + median(model), per channel, truncated to [0,1].
// PixelMath adds the (undoable) history step itself.
function bgmSubtractModel(view, model)
{
   var med = bgmChannelMedians(model);
   var tmp = new ImageWindow(model.width, model.height, model.numberOfChannels,
                             32, true, model.isColor, "SH_tmp_gradient_model");
   try
   {
      // 0xFFFFFFFF = UndoFlag_NoSwapFile: throwaway image, no undo data needed.
      tmp.mainView.beginProcess(0xFFFFFFFF);
      tmp.mainView.image.assign(model);
      tmp.mainView.endProcess();

      var id = tmp.mainView.id;
      var PM = new PixelMath;
      PM.useSingleExpression = false;
      PM.expression  = "$T - " + id + " + " + med[0];
      PM.expression1 = "$T - " + id + " + " + med[1 % med.length];
      PM.expression2 = "$T - " + id + " + " + med[2 % med.length];
      PM.createNewImage = false;
      PM.rescale = false;
      PM.truncate = true;
      PM.truncateLower = 0;
      PM.truncateUpper = 1;
      if (!PM.executeOn(view))
         throw new Error("PixelMath failed while applying the gradient model.");
   }
   finally
   {
      tmp.forceClose();
   }
   return med;
}

// previews: the panel's list, captured before applying. Once the main image
// changes, PixInsight drops the previews' own history, so they can no longer
// be found by their MGC step afterwards.
function bgmApply(win, preview, previews, removePreviews)
{
   var t0 = Date.now();
   var mgc = bgmMgcInstanceOf(preview);

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 4b: Apply background model " + preview.id + " to " + win.mainView.id);
   console.writeln("MGC settings: " + bgmDescribe(mgc));
   var factors = mgcFactorsOf(preview, mgc);
   var factorsText = mgcFactorsText(factors, "");
   console.writeln("Scale factors: " + factorsText +
      (factors.corr ? "   (" + mgcCorrelationText(factors) + ")" : ""));
   console.writeln("=".repeat(80));

   if (mgc.showGradientModel)
   {
      var med = bgmSubtractModel(win.mainView, preview.image);
      console.writeln("Corrected = original - model + median(model); median R/G/B = " +
         med.map(function(v) { return v.toExponential(4); }).join(" / "));
   }
   else
   {
      // Preview already holds the corrected image.
      win.mainView.beginProcess();
      win.mainView.image.assign(preview.image);
      win.mainView.endProcess();
      console.writeln("Preview holds the corrected image - copied as-is.");
   }

   shMarkDone(win.mainView, "SpaceHunter:GradientDone");

   // Leave a trace in the image's metadata of which model was used.
   var kw = win.keywords;
   kw.push(new FITSKeyword("HISTORY", "",
      "SH: MGC gradient model applied from preview " + preview.id +
      " (scale " + mgc.gradientScale + ")"));
   // Separate line: a FITS HISTORY value holds ~70 characters.
   kw.push(new FITSKeyword("HISTORY", "", "SH: MGC " + factorsText.split(" / ").join("/")));
   win.keywords = kw;

   if (removePreviews)
   {
      for (var i = 0; i < previews.length; ++i)
         win.deletePreview(previews[i]);
      console.writeln("Removed " + previews.length + " background model preview(s).");
   }

   win.currentView = win.mainView;
   console.writeln("✔ Background model applied in " + ((Date.now() - t0) / 1000).toFixed(2) + " s.\n");
}

var BackgroundModelDialog = class extends Dialog {
constructor(win, previews)
{
   super();

   var dlg = this;
   this.win = win;
   this.previews = previews;
   this.choice = null;          // "apply" | "tool" | null (close)
   this.selected = 0;
   this.lastSeenViewId = "";
   this.pendingScale = 0;       // set by "Run MGC", handled by the wait loop

   this.windowTitle = "SH Lazy Workflow Part 1 - Choose background model";

   this.info_Label = new Label(this);
   this.info_Label.wordWrapping = true;
   this.info_Label.useRichText = true;
   this.sharedFactors = mgcSharedFactors(previews);
   this.info_Label.text = "<b>" + win.mainView.id + "</b><br/>" +
      "Click a model below to show its preview. Apply is instant for " +
      "every scale. Need another scale? Add it below." +
      mgcFactorsHeader(this.sharedFactors,
         previews.some(function(p) { return bgmMgcInstanceOf(p).autoScaleFactors; }));

   this.radios = [];
   this.radioSizer = new VerticalSizer;
   this.radioSizer.margin = 6;
   this.radioSizer.spacing = 4;
   for (var i = 0; i < previews.length; ++i)
      this.addRadio(i);

   this.scale_GroupBox = new GroupBox(this);
   this.scale_GroupBox.title = "Background model";
   this.scale_GroupBox.sizer = this.radioSizer;

   // Add scale: run MGC for one more scale on a new full-frame preview.
   this.addScale_Label = new Label(this);
   this.addScale_Label.text = "Add scale:";
   this.addScale_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;

   this.addScale_ComboBox = new ComboBox(this);
   this.addScale_ComboBox.editEnabled = false;
   this.addScale_ComboBox.toolTip = "<p>Gradient scales not run yet. Defaults to the next " +
      "scale above the largest one run.</p>";

   this.addScale_Button = new PushButton(this);
   this.addScale_Button.text = "Run MGC";
   this.addScale_Button.toolTip = "<p>Run MGC at the chosen scale on a new full-frame preview, " +
      "with the same settings as the other models. Takes as long as one MGC preview run " +
      "(two with Both: an automatic and a 1.0 model).</p>";
   this.addScale_Button.onClick = function()
   {
      var idx = dlg.addScale_ComboBox.currentItem;
      if (idx >= 0 && idx < dlg.addScaleValues.length)
         dlg.pendingScale = dlg.addScaleValues[idx];
   };

   var addScaleSizer = new HorizontalSizer;
   addScaleSizer.spacing = 6;
   addScaleSizer.add(this.addScale_Label);
   addScaleSizer.add(this.addScale_ComboBox);
   addScaleSizer.add(this.addScale_Button);
   addScaleSizer.addStretch();

   this.addScaleValues = [];
   this.refreshAddScale();

   // Display only: switch all previews between the image's STF and one
   // shared, stronger model stretch.
   this.origStf = {};
   for (var i = 0; i < previews.length; ++i)
      this.origStf[previews[i].id] = previews[i].stf;
   this.modelStretch_CheckBox = new CheckBox(this);
   this.modelStretch_CheckBox.text = "Stronger model stretch (same for all models)";
   this.modelStretch_CheckBox.checked = false;
   this.modelStretch_CheckBox.toolTip = "<p>Display only - nothing is applied.</p>" +
      "<p><b>Off:</b> the models are shown with the image's own stretch.<br/>" +
      "<b>On:</b> one stronger stretch, computed from all models together and set " +
      "identically on every preview, so switching models compares like with like. " +
      "PixInsight's AutoSTF on a single model is not comparable: it stretches each " +
      "model differently.</p>";
   this.modelStretch_CheckBox.onCheck = function(checked)
   {
      dlg.setModelStretch(checked);
   };

   this.cleanUp_CheckBox = new CheckBox(this);
   this.cleanUp_CheckBox.text = "Remove background model previews after applying";
   this.cleanUp_CheckBox.checked = true;

   this.apply_Button = new PushButton(this);
   this.apply_Button.text = "Apply";
   this.apply_Button.icon = this.scaledResource(":/icons/ok.png");
   this.apply_Button.onClick = function() { dlg.choice = "apply"; dlg.hide(); };

   this.tool_Button = new PushButton(this);
   this.tool_Button.text = "Open MGC tool instead";
   this.tool_Button.toolTip = "Launch MGC with the selected preview's settings (previous behaviour).";
   this.tool_Button.onClick = function() { dlg.choice = "tool"; dlg.hide(); };

   this.close_Button = new PushButton(this);
   this.close_Button.text = "Close";
   this.close_Button.icon = this.scaledResource(":/icons/cancel.png");
   this.close_Button.onClick = function() { dlg.choice = null; dlg.hide(); };

   var buttons = new HorizontalSizer;
   buttons.spacing = 6;
   buttons.add(this.apply_Button);
   buttons.add(this.tool_Button);
   buttons.addStretch();
   buttons.add(this.close_Button);

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add(this.info_Label);
   this.sizer.add(this.scale_GroupBox);
   this.sizer.add(this.modelStretch_CheckBox);
   this.sizer.add(addScaleSizer);
   this.sizer.add(this.cleanUp_CheckBox);
   this.sizer.add(buttons);

   this.adjustToContents();
   this.setMinWidth(420);

   // Pre-select the preview currently shown, else the last one.
   var startIdx = previews.length - 1;
   for (var i = 0; i < previews.length; ++i)
      if (win.currentView.id == previews[i].id)
         startIdx = i;
   this.select(startIdx, false);
}
}; // end class BackgroundModelDialog

// One radio button for this.previews[idx].
BackgroundModelDialog.prototype.addRadio = function(idx)
{
   var dlg = this;
   var rb = new RadioButton(this);
   var mgc = bgmMgcInstanceOf(this.previews[idx]);
   var f = mgcFactorsOf(this.previews[idx], mgc);
   // Factors shown in the header: the row only says "auto SF".
   var shared = f.auto && f.sf && this.sharedFactors && mgcSameFactors(f, this.sharedFactors);
   rb.text = this.previews[idx].id + "   (scale " + mgc.gradientScale + ", " +
      (shared ? "auto SF" : mgcFactorsText(f, " ⚠")) + ")";
   rb.toolTip = "<p>" + bgmDescribe(mgc) + "</p>" +
      (f.corr ? "<p>Automatic factors, " + mgcCorrelationText(f) + ".<br/>" +
         "⚠ = correlation below " + MGC_LOW_CORRELATION.toFixed(2) +
         ": that channel's factor is uncertain - compare with the 1.0 model.</p>" : "");
   rb.onCheck = function(checked)
   {
      if (checked)
         dlg.select(idx, true);
   };
   this.radios.push(rb);
   this.radioSizer.add(rb);
};

// Scales already run, from the previews' MGC steps.
BackgroundModelDialog.prototype.usedScales = function()
{
   var used = [];
   for (var i = 0; i < this.previews.length; ++i)
      used.push(bgmMgcInstanceOf(this.previews[i]).gradientScale);
   return used;
};

// Fill the Add scale list with scales not run yet; default to the next
// scale above the largest one run.
BackgroundModelDialog.prototype.refreshAddScale = function()
{
   var used = this.usedScales();
   var maxUsed = Math.max.apply(null, used);
   this.addScaleValues = GRADIENT_SCALE_VALUES.filter(function(s) { return used.indexOf(s) < 0; });
   this.addScale_ComboBox.clear();
   var def = -1;
   for (var i = 0; i < this.addScaleValues.length; ++i)
   {
      this.addScale_ComboBox.addItem(this.addScaleValues[i].toString());
      if (def < 0 && this.addScaleValues[i] > maxUsed)
         def = i;
   }
   if (this.addScaleValues.length > 0)
      this.addScale_ComboBox.currentItem = (def >= 0) ? def : this.addScaleValues.length - 1;
   this.addScale_ComboBox.enabled = this.addScaleValues.length > 0;
   this.addScale_Button.enabled = this.addScaleValues.length > 0;
};

// One AutoSTF-style stretch per channel for all models together: shadows
// clip below the lowest model's median - 2.8 * MADN, midtones bring the mean
// median to 0.25. Same constants as PixInsight's AutoSTF.
function bgmSharedModelStf(previews)
{
   var stf = [];
   for (var c = 0; c < 3; ++c)
   {
      var c0 = 1, sumMed = 0;
      for (var i = 0; i < previews.length; ++i)
      {
         var img = previews[i].image;
         var ch = Math.min(c, img.numberOfChannels - 1);
         img.selectedChannel = ch;
         var med = img.median();
         var madn = 1.4826 * img.MAD(med);
         img.resetSelections();
         c0 = Math.min(c0, med - 2.8 * madn);
         sumMed += med;
      }
      c0 = Math.max(0, c0);
      var m = Math.mtf(0.25, sumMed / previews.length - c0);
      stf.push([m, c0, 1, 0, 1]);
   }
   stf.push([0.5, 0, 1, 0, 1]);
   return stf;
}

// on: shared stronger model stretch on every preview; off: each preview's
// stretch from when the panel opened (the image's STF).
BackgroundModelDialog.prototype.setModelStretch = function(on)
{
   var stf = on ? bgmSharedModelStf(this.previews) : null;
   for (var i = 0; i < this.previews.length; ++i)
   {
      var pv = this.previews[i];
      if (pv.isNull)
         continue;
      if (on)
         pv.stf = stf;
      else if (this.origStf[pv.id] !== undefined)
         pv.stf = this.origStf[pv.id];
   }
   if (on)
      console.writeln("Model stretch (shared) R/G/B shadows " +
         stf.slice(0, 3).map(function(s) { return s[1].toExponential(3); }).join(" / ") +
         ", midtones " + stf.slice(0, 3).map(function(s) { return s[0].toExponential(2); }).join(" / "));
   CoreApplication.processEvents();
};

BackgroundModelDialog.prototype.setBusy = function(busy)
{
   this.scale_GroupBox.enabled = !busy;
   this.addScale_ComboBox.enabled = !busy && this.addScaleValues.length > 0;
   this.addScale_Button.enabled = !busy && this.addScaleValues.length > 0;
   this.cleanUp_CheckBox.enabled = !busy;
   this.modelStretch_CheckBox.enabled = !busy;
   this.apply_Button.enabled = !busy;
   this.tool_Button.enabled = !busy;
   this.close_Button.enabled = !busy;
   this.addScale_Button.text = busy ? "Running MGC..." : "Run MGC";
};

// Run MGC for one more scale on a new full-frame preview, using the first
// model's MGC settings with only the scale changed. Called from the wait
// loop (not from the button handler) so the long run is outside a GUI event.
// The panel holds automatic and 1.0 models (Both): one preview of each, in
// the main run's order (1.0, then _autoSF) for tabs and list; the automatic
// one runs first, as in the main run.
BackgroundModelDialog.prototype.runAddedScale = function(scale)
{
   var win = this.win;
   var img = win.mainView.image;
   var hasAuto = false, hasStd = false;
   for (var i = 0; i < this.previews.length; ++i)
      if (bgmMgcInstanceOf(this.previews[i]).autoScaleFactors)
         hasAuto = true;
      else
         hasStd = true;

   // Display order.
   var jobs = [];
   if (hasStd) jobs.push({ auto: false, pv: null, done: false });
   if (hasAuto) jobs.push({ auto: true, pv: null, done: false });

   this.setBusy(true);
   CoreApplication.processEvents();
   try
   {
      for (var j = 0; j < jobs.length; ++j)
         jobs[j].pv = win.createPreview(new Rect(0, 0, img.width, img.height),
                                        "BM_" + scale + (jobs[j].auto ? MGC_AUTO_SUFFIX : ""));

      var runOrder = jobs.slice().reverse();   // automatic first
      for (var r = 0; r < runOrder.length; ++r)
      {
         var job = runOrder[r];
         var pv = job.pv;
         var P = new MultiscaleGradientCorrection;
         P.assign(bgmMgcInstanceOf(this.previews[0]));
         P.gradientScale = scale;
         P.autoScaleFactors = job.auto;
         P.scaleFactorRK = 1.0;
         P.scaleFactorG = 1.0;
         P.scaleFactorB = 1.0;
         P.showGradientModel = true;

         showPreview(win, pv);
         win.zoomToOptimalFit();
         CoreApplication.processEvents();

         console.writeln("\n" + "-".repeat(80));
         console.writeln("Added scale - Processing: " + pv.id);
         console.writeln("Gradient Scale: " + scale +
            "   Scale factors: " + (job.auto ? "automatic" : "1.0"));
         console.writeln("-".repeat(80));
         var t0 = Date.now();
         if (!P.executeOn(pv))
            throw new Error("MultiscaleGradientCorrection failed on " + pv.id);
         var f = mgcReadFactors(P);
         shMgcFactors[pv.id] = f;
         mgcLogFactors(f);
         console.writeln(pv.id + " completed in " + ((Date.now() - t0) / 1000).toFixed(1) + " s.");
         job.done = true;
      }
   }
   catch (e)
   {
      console.warningln("⚠  Adding scale " + scale + " failed: " + shErrorText(e));
   }

   // List the finished models in display order; drop unfinished previews.
   var added = 0;
   for (var j = 0; j < jobs.length; ++j)
   {
      var pv = jobs[j].pv;
      if (pv == null || pv.isNull)
         continue;
      if (!jobs[j].done)
      {
         win.deletePreview(pv);
         continue;
      }
      this.previews.push(pv);
      this.origStf[pv.id] = pv.stf;
      this.addRadio(this.previews.length - 1);
      ++added;
   }
   if (added > 0)
   {
      // The shared stretch has to cover the new model(s) too.
      if (this.modelStretch_CheckBox.checked)
         this.setModelStretch(true);
      showPreview(win, this.previews[this.previews.length - 1]);
      this.select(this.previews.length - 1, false);
   }
   this.refreshAddScale();
   this.adjustToContents();
   this.setBusy(false);
};

// fromRadio: the user clicked a radio button -> show that preview too.
BackgroundModelDialog.prototype.select = function(idx, fromRadio)
{
   this.selected = idx;
   if (!this.radios[idx].checked)
      this.radios[idx].checked = true;
   if (fromRadio && this.win.currentView.id != this.previews[idx].id)
      this.win.currentView = this.previews[idx];
   this.lastSeenViewId = this.win.currentView.id;
};

// Called from the wait loop: follow the preview tab the user switches to.
BackgroundModelDialog.prototype.syncWithWindow = function()
{
   if (this.win.isNull)
      return;
   var id = this.win.currentView.id;
   if (id == this.lastSeenViewId)
      return;
   this.lastSeenViewId = id;
   for (var i = 0; i < this.previews.length; ++i)
      if (this.previews[i].id == id)
      {
         this.selected = i;
         this.radios[i].checked = true;
      }
};

// Final MGC step: panel to pick and apply a background model. The script
// keeps pumping events so the image window repaints, but PixInsight stays busy
// (no zoom or pan, Georg's test 2026-10-11): the user switches models by
// clicking the list, which shows that preview.
function chooseBackgroundModel(win)
{
   var previews = bgmPreviews(win);
   if (previews.length == 0)
   {
      console.warningln("⚠  No MGC background model previews found - opening MGC tool instead.");
      buildMGCInstance(WorkflowParameters.getGradientScale(WorkflowParameters.numPreviews - 1), false,
         WorkflowParameters.mgcScaleMode != "standard").launch();
      return;
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 4b: Choose background model (" + previews.length + " preview(s))");
   console.writeln("=".repeat(80));
   for (var i = 0; i < previews.length; ++i)
      console.writeln("  " + previews[i].id + ": " + bgmDescribe(bgmMgcInstanceOf(previews[i])));

   var dlg = new BackgroundModelDialog(win, previews);
   dlg.show();
   while (dlg.visible)
   {
      if (console.abortRequested)
      {
         dlg.hide();
         if (dlg.modelStretch_CheckBox.checked)
            dlg.setModelStretch(false);
         console.writeln("Background model selection cancelled - image left unchanged.\n");
         return;
      }
      if (dlg.pendingScale > 0)
      {
         var s = dlg.pendingScale;
         dlg.pendingScale = 0;
         dlg.runAddedScale(s);
         continue;
      }
      dlg.syncWithWindow();
      CoreApplication.processEvents();
      System.msleep(50);
   }

   // Previews that stay (Close, or Apply without clean-up) get their normal
   // stretch back.
   if (dlg.modelStretch_CheckBox.checked)
      dlg.setModelStretch(false);

   var preview = previews[dlg.selected];
   if (dlg.choice == "apply")
   {
      bgmApply(win, preview, previews, dlg.cleanUp_CheckBox.checked);
   }
   else if (dlg.choice == "tool")
   {
      var P = bgmMgcInstanceOf(preview);
      P.showGradientModel = false;
      win.currentView = win.mainView;
      console.writeln("Opening MultiscaleGradientCorrection tool with " + preview.id + " settings...\n");
      P.launch();
   }
   else
   {
      console.writeln("Background model panel closed - image left unchanged.\n");
   }
}

// ============================================================
// STEP 5b: Choose GC result
// ------------------------------------------------------------
// GC previews hold the corrected image itself (the gradient model goes to a
// separate GC_gradient_model<n> window), so applying is a straight copy.
// ============================================================

// The GC instance that produced a preview, read from the preview's history.
function gcInstanceOf(preview)
{
   var pc = preview.processing;
   for (var i = pc.length - 1; i >= 0; --i)
      if (pc[i].processId() == "GradientCorrection")
         return pc[i];
   return null;
}

function gcDescribe(P)
{
   return "highThreshold " + P.highThreshold.toFixed(2) +
          ", highTolerance " + P.highTolerance.toFixed(2) +
          ", protection " + P.protectionThreshold.toFixed(2) +
          " / " + P.protectionAmount.toFixed(2);
}

// Full-frame previews of the window that carry a GC step (any name).
function gcPreviews(win)
{
   var list = [];
   var pv = win.previews;
   var W = win.mainView.image.width, H = win.mainView.image.height;
   for (var i = 0; i < pv.length; ++i)
      if (pv[i].image.width == W && pv[i].image.height == H &&
          gcInstanceOf(pv[i]) != null)
         list.push(pv[i]);
   return list;
}

// previews/modelIds: captured before applying - once the main image changes,
// PixInsight drops the previews' own history.
function gcApply(win, preview, previews, modelIds, cleanUp)
{
   var t0 = Date.now();
   var gc = gcInstanceOf(preview);

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 5b: Apply GC result " + preview.id + " to " + win.mainView.id);
   console.writeln("GC settings: " + gcDescribe(gc));
   console.writeln("=".repeat(80));

   win.mainView.beginProcess();
   win.mainView.image.assign(preview.image);
   win.mainView.endProcess();
   shMarkDone(win.mainView, "SpaceHunter:GradientDone");

   var kw = win.keywords;
   kw.push(new FITSKeyword("HISTORY", "",
      "SH: GradientCorrection result applied from preview " + preview.id +
      " (" + gcDescribe(gc) + ")"));
   win.keywords = kw;

   if (cleanUp)
   {
      for (var i = 0; i < previews.length; ++i)
         win.deletePreview(previews[i]);
      for (var i = 0; i < modelIds.length; ++i)
      {
         var mw = ImageWindow.windowById(modelIds[i]);
         if (!mw.isNull)
            mw.forceClose();
      }
      console.writeln("Removed " + previews.length + " GC preview(s) and " +
                      modelIds.length + " model window(s).");
   }

   win.currentView = win.mainView;
   win.bringToFront();
   console.writeln("✔ GC result applied in " + ((Date.now() - t0) / 1000).toFixed(2) + " s.\n");
}

var GCResultDialog = class extends Dialog {
constructor(win, previews)
{
   super();

   var dlg = this;
   this.win = win;
   this.previews = previews;
   this.choice = null;          // "apply" | "tool" | null (close)
   this.selected = 0;
   this.lastSeenViewId = "";

   this.windowTitle = "SH Lazy Workflow Part 1 - Choose GC result";

   this.info_Label = new Label(this);
   this.info_Label.wordWrapping = true;
   this.info_Label.useRichText = true;
   this.info_Label.text = "<b>" + win.mainView.id + "</b><br/>" +
      "Each preview holds the GC-corrected image; its gradient model is in the " +
      "window with the same number (GC_ &rarr; GC_gradient_model, GC_1 &rarr; " +
      "GC_gradient_model1). Differences usually show more clearly in the " +
      "models than in the corrected previews. Click a result below to show " +
      "its preview, or tick Show gradient models to compare the models.";

   // Model window of each preview (null if it is gone).
   this.modelWins = [];
   for (var i = 0; i < previews.length; ++i)
   {
      var mw = ImageWindow.windowById(gcExpectedModelId(previews[i].id));
      this.modelWins.push(mw.isNull ? null : mw);
   }
   this.modelStf = {};

   this.radios = [];
   var radioSizer = new VerticalSizer;
   radioSizer.margin = 6;
   radioSizer.spacing = 4;
   for (var i = 0; i < previews.length; ++i)
   {
      let idx = i;
      var rb = new RadioButton(this);
      rb.text = previews[i].id + "   (" + gcDescribe(gcInstanceOf(previews[i])) + ")";
      rb.onCheck = function(checked)
      {
         if (checked)
            dlg.select(idx, true);
      };
      this.radios.push(rb);
      radioSizer.add(rb);
   }

   this.result_GroupBox = new GroupBox(this);
   this.result_GroupBox.title = "GradientCorrection result";
   this.result_GroupBox.sizer = radioSizer;

   // Display only: show the selected result's model window instead of its
   // preview, all models with one shared stretch.
   this.showModels_CheckBox = new CheckBox(this);
   this.showModels_CheckBox.text = "Show gradient models (same stretch for all)";
   this.showModels_CheckBox.checked = false;
   this.showModels_CheckBox.enabled = this.modelWins.some(function(w) { return w != null; });
   this.showModels_CheckBox.toolTip = "<p>Display only - Apply always uses the corrected preview.</p>" +
      "<p><b>On:</b> clicking a result shows its gradient model window; every model " +
      "gets the same stretch, computed from all models together, so they compare " +
      "like with like.<br/><b>Off:</b> clicking a result shows its corrected " +
      "preview; the model windows get their own stretch back.</p>";
   this.showModels_CheckBox.onCheck = function(checked)
   {
      dlg.setShowModels(checked);
   };

   this.cleanUp_CheckBox = new CheckBox(this);
   this.cleanUp_CheckBox.text = "Remove GC previews and model windows after applying";
   this.cleanUp_CheckBox.checked = true;

   this.apply_Button = new PushButton(this);
   this.apply_Button.text = "Apply";
   this.apply_Button.icon = this.scaledResource(":/icons/ok.png");
   this.apply_Button.onClick = function() { dlg.choice = "apply"; dlg.hide(); };

   this.tool_Button = new PushButton(this);
   this.tool_Button.text = "Open GC tool instead";
   this.tool_Button.toolTip = "Launch GradientCorrection with the selected preview's exact settings.";
   this.tool_Button.onClick = function() { dlg.choice = "tool"; dlg.hide(); };

   this.close_Button = new PushButton(this);
   this.close_Button.text = "Close";
   this.close_Button.icon = this.scaledResource(":/icons/cancel.png");
   this.close_Button.onClick = function() { dlg.choice = null; dlg.hide(); };

   var buttons = new HorizontalSizer;
   buttons.spacing = 6;
   buttons.add(this.apply_Button);
   buttons.add(this.tool_Button);
   buttons.addStretch();
   buttons.add(this.close_Button);

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add(this.info_Label);
   this.sizer.add(this.result_GroupBox);
   this.sizer.add(this.showModels_CheckBox);
   this.sizer.add(this.cleanUp_CheckBox);
   this.sizer.add(buttons);

   this.adjustToContents();
   this.setMinWidth(420);

   // Pre-select the preview currently shown, else the first one.
   var startIdx = 0;
   for (var i = 0; i < previews.length; ++i)
      if (win.currentView.id == previews[i].id)
         startIdx = i;
   this.select(startIdx, false);
}
}; // end class GCResultDialog

// fromRadio: the user clicked a radio button -> show that preview (or, with
// Show gradient models, its model window) too.
GCResultDialog.prototype.select = function(idx, fromRadio)
{
   this.selected = idx;
   if (!this.radios[idx].checked)
      this.radios[idx].checked = true;
   if (fromRadio)
      this.showSelected();
   this.lastSeenViewId = this.currentShownId();
};

GCResultDialog.prototype.showingModels = function()
{
   return this.showModels_CheckBox.checked;
};

GCResultDialog.prototype.showSelected = function()
{
   var mw = this.modelWins[this.selected];
   if (this.showingModels() && mw != null && !mw.isNull)
   {
      mw.bringToFront();
   }
   else
   {
      if (this.win.currentView.id != this.previews[this.selected].id)
         this.win.currentView = this.previews[this.selected];
      this.win.bringToFront();
   }
   CoreApplication.processEvents();
};

// Id of what the user looks at: the active model window, or the image
// window's current view.
GCResultDialog.prototype.currentShownId = function()
{
   var aw = ImageWindow.activeWindow;
   if (!aw.isNull)
      for (var i = 0; i < this.modelWins.length; ++i)
         if (this.modelWins[i] != null && !this.modelWins[i].isNull &&
             aw.mainView.id == this.modelWins[i].mainView.id)
            return "model:" + i;
   return this.win.isNull ? "" : this.win.currentView.id;
};

// on: shared stretch on all model windows, show the selected model;
// off: model windows get their own stretch back, show the selected preview.
GCResultDialog.prototype.setShowModels = function(on)
{
   var views = [];
   for (var i = 0; i < this.modelWins.length; ++i)
      if (this.modelWins[i] != null && !this.modelWins[i].isNull)
         views.push(this.modelWins[i].mainView);
   if (on && views.length > 0)
   {
      var stf = bgmSharedModelStf(views);
      for (var i = 0; i < views.length; ++i)
      {
         if (this.modelStf[views[i].id] === undefined)
            this.modelStf[views[i].id] = views[i].stf;
         views[i].stf = stf;
      }
   }
   else
   {
      for (var i = 0; i < views.length; ++i)
         if (this.modelStf[views[i].id] !== undefined)
            views[i].stf = this.modelStf[views[i].id];
   }
   this.showSelected();
   this.lastSeenViewId = this.currentShownId();
};

// Called from the wait loop: follow the preview tab or model window the
// user switches to.
GCResultDialog.prototype.syncWithWindow = function()
{
   if (this.win.isNull)
      return;
   var id = this.currentShownId();
   if (id == this.lastSeenViewId)
      return;
   this.lastSeenViewId = id;
   for (var i = 0; i < this.previews.length; ++i)
      if (this.previews[i].id == id || id == "model:" + i)
      {
         this.selected = i;
         this.radios[i].checked = true;
      }
};

// Final GC step: non-modal panel to pick and apply a GC result, same
// event-pumping pattern as chooseBackgroundModel.
function chooseGCResult(win, modelIds)
{
   var previews = gcPreviews(win);
   if (previews.length == 0)
   {
      console.warningln("⚠  No GC previews found - opening GC tool instead.");
      openGCTool();
      return;
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 5b: Choose GC result (" + previews.length + " preview(s))");
   console.writeln("=".repeat(80));
   for (var i = 0; i < previews.length; ++i)
      console.writeln("  " + previews[i].id + ": " + gcDescribe(gcInstanceOf(previews[i])));

   var dlg = new GCResultDialog(win, previews);
   dlg.show();
   while (dlg.visible)
   {
      if (console.abortRequested)
      {
         dlg.hide();
         if (dlg.showModels_CheckBox.checked)
            dlg.setShowModels(false);
         console.writeln("GC result selection cancelled - image left unchanged.\n");
         return;
      }
      dlg.syncWithWindow();
      CoreApplication.processEvents();
      System.msleep(50);
   }

   // Model windows that stay get their own stretch back.
   if (dlg.showModels_CheckBox.checked)
      dlg.setShowModels(false);

   var preview = previews[dlg.selected];
   if (dlg.choice == "apply")
   {
      gcApply(win, preview, previews, modelIds, dlg.cleanUp_CheckBox.checked);
   }
   else if (dlg.choice == "tool")
   {
      var P = gcInstanceOf(preview);
      win.currentView = win.mainView;
      console.writeln("Opening GradientCorrection tool with " + preview.id + " settings (" +
                      gcDescribe(P) + ")...\n");
      P.launch();
   }
   else
   {
      console.writeln("GC result panel closed - image left unchanged.\n");
   }
}

// ============================================================
// MAIN: Execute master workflow
// ============================================================

// Space Hunter banner for the Process Console, deep orange at the top to
// pale blue at the bottom, bold (24-bit ANSI colour codes). Every "_"
// stroke is printed as U+2017 DOUBLE LOW LINE.
function shBanner()
{
   var art = [
      "   _____                       __  __            __",
      "  / ___/____  ____ _________  / / / /_  ______  / /____  _____",
      "  \\__ \\/ __ \\/ __ `/ ___/ _ \\/ /_/ / / / / __ \\/ __/ _ \\/ ___/",
      " ___/ / /_/ / /_/ / /__/  __/ __  / /_/ / / / / /_/  __/ /",
      "/____/ .___/\\__,_/\\___/\\___/_/ /_/\\__,_/_/ /_/\\__/\\___/_/",
      "    /_/"
   ];
   var c0 = [180, 50, 0], c1 = [175, 210, 255];
   console.writeln("");
   for (var i = 0; i < art.length; i++)
   {
      var t = i / (art.length - 1), rgb = [];
      for (var k = 0; k < 3; k++)
         rgb.push(Math.round(c0[k] + (c1[k] - c0[k]) * t));
      console.writeln("\x1b[1;38;2;" + rgb.join(";") + "m" +
                      art[i].split("_").join("\u2017") + "\x1b[0m");   // double strokes
   }
}

function main()
{
   console.show();
   // A script has to switch the Process Console's Abort button on itself
   // (as PI's ImageSolver does); otherwise it is only active while a PI
   // process runs, and the script's own abort checks never fire.
   console.abortEnabled = true;

   // Start timer
   let startTime = new Date();

   shBanner();
   console.writeln("\n" + "=".repeat(80));
   console.writeln("SPACE HUNTER WORKFLOW SCRIPT PART 1 " + SCRIPT_VERSION);
   console.writeln("Image Solve \u2192 SPFC \u2192 Previews \u2192 MGC \u2192 GC \u2192 cDBE");
   console.writeln("=".repeat(80) + "\n");

   try {
      // Phase 1: Read XSPD databases
      parseFiltersXSPD();
      parseWhiteRefXSPD();

      // Phase 2: Auto-group into dropdown lists
      buildDropdownLists();

      // Default camera to "Ideal QE curve" if not already saved
      if (WorkflowParameters.selectedCameraIdx === -1) {
         var idealIdx = 0;
         for (var i = 0; i < cameraList.length; i++) {
            if (cameraList[i].label.indexOf("Ideal") >= 0) { idealIdx = i; break; }
         }
         WorkflowParameters.selectedCameraIdx = idealIdx;
      }
      WorkflowParameters.loadUserPrefs();
      if (Parameters.isViewTarget || Parameters.isGlobalTarget) {
         try {
            WorkflowParameters.load();
         } catch (e) {
            console.warningln("⚠  Some process icon values could not be read (" +
                              shErrorText(e) + ") - saved settings used for them.");
         }
      }
      WorkflowParameters.validate();
      WorkflowParameters.resolveFilterSelection();

      // Step 0: Equipment & workflow selection dialog
      selectEquipment();

      // Re-run protection: a gradient correction from an earlier run is still
      // applied (its mark disappears when that step is undone in History Explorer).
      if (WorkflowParameters.enableMGC || WorkflowParameters.enableGC) {
         let rw = ImageWindow.activeWindow;
         if (!rw.isNull && shHasMark(rw.mainView, "SpaceHunter:GradientDone")) {
            let msg = new MessageBox(
               "<p><b>A gradient correction (MGC / GC) from this script is already applied to this image.</b></p>" +
               "<p>Running it again corrects the gradient twice and may damage your image.</p>" +
               "<p>To try another model, go back one step in History Explorer first.</p>" +
               "<p>Continue anyway?</p>",
               "Warning: Gradient Correction Already Applied",
               StdIcon.Warning, StdButton.Yes, StdButton.No);
            if (msg.execute() === StdButton.No)
               throw new Error("Script cancelled by user.");
         }
      }

      // Step 1: Plate solving
      let plateSolveComplete = smartPlateSolve();

      if (!plateSolveComplete) {
         // Plate solving needs user action (ImageSolver)
         // Script will pause here and user must run again after ImageSolver

         // Calculate elapsed time
         let endTime = new Date();
         let elapsedMs = endTime - startTime;
         let elapsedSec = Math.floor(elapsedMs / 1000);
         let minutes = Math.floor(elapsedSec / 60);
         let seconds = elapsedSec % 60;

         console.writeln("\n" + "=".repeat(80));
         console.writeln("Total execution time: " + minutes + "m " + seconds + "s");
         console.writeln("=".repeat(80) + "\n");

         return;
      }

      // Steps 2-6: Workflow
      console.writeln("\n" + "=".repeat(80));
      console.writeln("WORKFLOW: SPFC + Previews + Gradient correction");
      console.writeln("=".repeat(80) + "\n");

      var spfcFailed = false;
      var mgcFailed = false;
      if (WorkflowParameters.enableSPFC) {
      // Outside the SPFC try: a failed separation stops the script instead
      // of falling back to GC on a half-processed image.
      if (WorkflowParameters.enableNarrowband && WorkflowParameters.enableSeparation)
         runSeparation();
      try {
      runSPFC();
	} catch (spfcError) {
      if (shIsCancel(spfcError)) throw spfcError;
      console.warningln("\n\u26A0  SPFC failed: " + shErrorText(spfcError));
      spfcFailed = true;
      if (WorkflowParameters.enableMGC) {
         console.writeln("Skipping MGC - falling back to GC...\n");
         mgcFailed = true;
      }
    }
    } else {
      console.writeln("SPFC is DISABLED - skipping\n");
    }
      // GC (manual, or fallback after a failed SPFC) creates its own 2 previews below.
      var gcInstead = WorkflowParameters.enableGC || (spfcFailed && WorkflowParameters.enableMGC);
      if (WorkflowParameters.enablePreviews && gcInstead) {
         console.writeln("Previews: skipped - GradientCorrection creates its own GC_ / GC_1\n");
      } else if (WorkflowParameters.enablePreviews) {
         let previewPrefix = (WorkflowParameters.enableSPFC && !spfcFailed) ? "BM_" : "Preview";
         createPreviews(previewPrefix);
      } else {
         console.writeln("Create Previews is DISABLED - skipping\n");
      }
      // MGC with GC fallback
      if (WorkflowParameters.enableMGC && !spfcFailed) {
         if (!WorkflowParameters.enablePreviews) {
            console.warningln("\u26A0  MGC requires Previews - checking for existing previews...");
            let win = ImageWindow.activeWindow;
            if (win.previews.length < WorkflowParameters.numPreviews) {
               console.warningln("\u26A0  Not enough previews found. Skipping MGC.\n");
            } else {
               try {
                  runMGCOnPreviews();
               } catch (mgcError) {
                  if (shIsCancel(mgcError)) throw mgcError;
                  console.warningln("\n\u26A0  MGC failed: " + shErrorText(mgcError));
                  console.writeln("Falling back to GradientCorrection...\n");
                  mgcFailed = true;
               }
            }
         } else {
            try {
               runMGCOnPreviews();
            } catch (mgcError) {
               if (shIsCancel(mgcError)) throw mgcError;
               console.warningln("\n\u26A0  MGC failed: " + shErrorText(mgcError));
               console.writeln("Falling back to GradientCorrection...\n");
               mgcFailed = true;
            }
         }
      } else if (!spfcFailed) {
         console.writeln("MGC is DISABLED - skipping\n");
      }

      // GC: manual mode or MGC fallback - always on its own 2 previews
      var gcRan = false;
      var gcModelIds = [];
      var gcWin = ImageWindow.activeWindow;
      if (WorkflowParameters.enableGC || (mgcFailed && WorkflowParameters.enableMGC)) {
         if (mgcFailed) {
            console.writeln("\n" + "=".repeat(80));
            console.writeln("MGC FALLBACK: Running GradientCorrection on GC_ and GC_1");
            console.writeln("=".repeat(80) + "\n");
         }
         createPreviews("GC_", GC_PRESETS.length, "5");
         let win = gcWin;
         try {
            gcModelIds = runGCOnPreviews();
            gcRan = true;
         } catch (gcError) {
            if (shIsCancel(gcError)) throw gcError;
            console.warningln("\n\u26A0  GradientCorrection failed: " + shErrorText(gcError) + "\n");
         }

         // Apply Auto Display Stretch to GC gradient model images
         for (var g = 0; g < gcModelIds.length; g++) {
            var modelWin = ImageWindow.windowById(gcModelIds[g]);
            if (!modelWin.isNull) {
               console.writeln("Applying Auto Display Stretch to " + gcModelIds[g] + "...");
               applyDisplayStretch(modelWin);
               console.writeln("\u2714 " + gcModelIds[g] + " stretched.");
            }
         }
         // Bring main image back to front
         win.bringToFront();
      }

      // DBE: manual mode only (just opens the tool)
      if (WorkflowParameters.enableDBE) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 6: DynamicBackgroundExtraction");
         console.writeln("=".repeat(80) + "\n");
      }

      console.writeln("\n" + "=".repeat(80));
      console.writeln("\u2705 COMPLETE WORKFLOW FINISHED \u2705");
      console.writeln("=".repeat(80) + "\n");

      // Calculate elapsed time
      let endTime = new Date();
      let elapsedMs = endTime - startTime;
      let elapsedSec = Math.floor(elapsedMs / 1000);
      let minutes = Math.floor(elapsedSec / 60);
      let seconds = elapsedSec % 60;

      console.writeln("Total execution time: " + minutes + "m " + seconds + "s\n");

      // Open the appropriate tool at the end
      if (WorkflowParameters.enableMGC && !mgcFailed) {
         // Panel to pick a preview's background model and apply it instantly;
         // "Open MGC tool instead" keeps the previous behaviour.
         chooseBackgroundModel( ImageWindow.activeWindow );
      }

      if (WorkflowParameters.enableGC || mgcFailed) {
         // Panel to pick GC_ / GC_1 and apply it; "Open GC tool instead"
         // launches GC with the chosen preview's exact settings.
         if (gcRan)
            chooseGCResult(gcWin, gcModelIds);
         else
            openGCTool();
      }

      if (WorkflowParameters.enableDBE) {
         openDBETool();
      }

    } catch (error) {
      if (shIsCancel(error)) {
         console.writeln("\nScript cancelled by user.\n");
      } else {
         console.criticalln("\nERROR: " + shErrorText(error));
         throw error;
      }
    }
}

main();
