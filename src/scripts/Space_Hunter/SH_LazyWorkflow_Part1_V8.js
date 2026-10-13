#engine v8

#feature-id SHLazyWorkflowPart1 : Space_Hunter > SH Lazy Workflow Part 1
#feature-icon  SH_WorkFlow1.svg
#feature-info Space Hunter Lazy Workflow Part 1 v2.5.2<br/>\
   <br/>\
   Automated Linear Image Processing workflow for OSC camera images.<br/>\
   <br/>\
   Includes: Equipment selection with collapsible sections, ASTAP integration,<br/>\
   ImageSolver, SPFC, variable previews (1-4), MultiscaleGradientCorrection with<br/>\
   per-preview gradient scale selection and instant background model apply.<br/>\
   Optional GC and cDBE, New Instance support.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   See LICENSE file for details: https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE.

// ============================================================
// Space Hunter Lazy Workflow Part 1 v2.5.2
//
// Copyright (c) 2026 Georg G Albrecht. MIT License.
// See LICENSE file for details.
//
// Acknowledgments:
// - PixInsight platform by Pleiades Astrophoto (https://pixinsight.com/)
// - ASTAP plate solving uses the ASTAP command-line interface (https://www.hnsky.org/astap.htm) by Han Kleijn, licensed under the Mozilla Public License 2.0 (https://mozilla.org/MPL/2.0/).
// - ASTAP integration approach inspired by BlindSolver2000 by Franklin Marek (www.setiastro.com), licensed under CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
// - ImageSolver by (C) 2012-2024 Andrés del Pozo/ (C) 2019-2024 Juan Conejero (PTeam)
// - Standard PixInsight processes called: SPFC, MultiscaleGradientCorrection, GradientCorrection, DynamicBackgroundExtraction
// - Developed with assistance from Claude AI (Anthropic)
//
// Part 0: Process & Equipment selection dialog (SectionBar UI)
// Part 1: Smart Plate Solve (ASTAP only if needed)
// Part 2: ImageSolve
// Part 3: SPFC
// Part 4: Creates 1-4 Previews in full size (user selectable)
// Part 5: MGC with per-preview gradient scale selection
// Part 5b: Choose background model - apply any preview's MGC model instantly
// Part 6: GradientCorrection (MGC fallback or manual, previews GC_ / GC_1)
// Part 6b: Choose GC result - apply GC_ or GC_1, or open GC with its settings
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
// Part 7: cDBE - DynamicBackgroundExtraction
// ============================================================
//
// THIS SCRIPT IS FOR OSC CAMERA IMAGES ONLY
//
// Requirements:
// - Windows machine
// - PixInsight 1.9.4
// - MARS database installed
// - ASTAP and D50 star map installed - Path: C:\Program Files\astap
// - OSC Camera Image
// - Image pre-cropped

// The auto-solve path drives PixInsight's modern ImageSolver engine, which
// exists only in 1.9.5+ and writes the standard "AstrometricSolution:*"
// property namespace that older cores do not recognize. Require 1.9.5.
CoreApplication.ensureMinimumVersion( 1, 9, 5 );

// ============================================================
// ImageSolver engine (V8-native, portable) for auto plate-solve
// ------------------------------------------------------------
// We drive PixInsight's CURRENT ImageSolver engine (v6.5.0) as a library,
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
#define STAR_CSV_FILE       File.systemTempDirectory + "/stars.csv"
#include "../ImageSolver/ImageSolver.js"
/* beautify ignore:end */

// ============================================================
// ASTAP PATH - Auto-detect with persistent storage + browse fallback
// ============================================================

var SETTINGS_KEY_ASTAP = "SpaceHunter/ASTAPPath";

function resolveASTAPPath()
{
   // 1. Check saved path from previous run
   let savedPath = null;
   try {
      savedPath = Settings.read(SETTINGS_KEY_ASTAP, DataType.String);
   } catch (e) {}
   if (savedPath && File.exists(savedPath)) {
      console.writeln("ASTAP found (saved): " + savedPath);
      return savedPath;
   }

   // 2. Check common installation locations
   let commonPaths = [
      "C:/Program Files/astap/astap.exe",
      "C:/Program Files (x86)/astap/astap.exe",
      "D:/Program Files/astap/astap.exe",
      "D:/astap/astap.exe",
      "E:/Program Files/astap/astap.exe"
   ];

   for (let i = 0; i < commonPaths.length; i++) {
      if (File.exists(commonPaths[i])) {
         console.writeln("ASTAP found: " + commonPaths[i]);
         Settings.write(SETTINGS_KEY_ASTAP, DataType.String, commonPaths[i]);
         return commonPaths[i];
      }
   }

   // 3. Not found — ask user to locate it
   console.warningln("ASTAP not found in common locations. Asking user...");

   let ofd = new OpenFileDialog;
   ofd.caption = "Locate ASTAP - Select astap.exe";
   ofd.filters = [
      ["ASTAP executable", "astap.exe"],
      ["All files", "*.*"]
   ];

   if (ofd.execute()) {
      let selectedPath = ofd.fileName;
      if (File.exists(selectedPath)) {
         console.writeln("ASTAP selected by user: " + selectedPath);
         Settings.write(SETTINGS_KEY_ASTAP, DataType.String, selectedPath);
         return selectedPath;
      }
   }

   // User cancelled or invalid selection
   return null;
}

// ============================================================
// MARS DATABASE - Auto-detect .xmars files
// ============================================================

var SETTINGS_KEY_MARS = "SpaceHunter/MARSFiles";
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
   try { Settings.remove(SETTINGS_KEY_MARS); } catch (e) {}

   // Search common locations for .xmars files
   let searchDirs = [
      "C:/Program Files/PixInsight/library",
      "C:/Program Files (x86)/PixInsight/library",
      "D:/Program Files/PixInsight/library",
      File.homeDirectory + "/AppData/Local/PixInsight",
      File.homeDirectory + "/AppData/Roaming/Pleiades"
   ];

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
               console.writeln("  MARS file found: " + fullPath);
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

   if (foundFiles.length > 0) {
      // Save for next time
      Settings.write(SETTINGS_KEY_MARS, DataType.String, JSON.stringify(foundFiles));
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
         Settings.write(SETTINGS_KEY_MARS, DataType.String, JSON.stringify(userFiles));
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
#define SCRIPT_VERSION "v2.5.2"
var SCRIPT_DIR = File.extractDrive(#__FILE__) + File.extractDirectory(#__FILE__);
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
   enableASTAP: true,

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

      Parameters.set("enableASTAP", this.enableASTAP);

      Parameters.set("selectedWhiteRefIdx", this.selectedWhiteRefIdx);
      Parameters.set("selectedCameraIdx",   this.selectedCameraIdx);
      this.syncFilterNames();
      Parameters.set("selectedFilterLabel", this.selectedFilterLabel);
      Parameters.set("selectedGrayName",    this.selectedGrayName);
      Parameters.set("selectedCameraName",  this.selectedCameraName);

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
      Parameters.set("sepProfileFolder", this.sepProfileFolder);
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
   },
   // -----------------------------------------------------------
   // Save user preferences to persistent Settings store
   // -----------------------------------------------------------
   saveUserPrefs: function()
   {
      this.syncFilterNames();
      var prefs = {
         enableImageSolve:    this.enableImageSolve,
         enableASTAP:         this.enableASTAP,
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
         mgcBlueFilter:       this.mgcBlueFilter
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
            if (prefs.enableASTAP         !== undefined) this.enableASTAP         = prefs.enableASTAP;
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
      try {
         Settings.remove(SETTINGS_KEY_USERPREFS);
      } catch (e) {}
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

      if (Parameters.has("enableASTAP"))
         this.enableASTAP = Parameters.getBoolean("enableASTAP");

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
      if (Parameters.has("sepProfileFolder"))
         this.sepProfileFolder = Parameters.getString("sepProfileFolder");
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
   },

   // Call after the lists are built and the saved names are loaded.
   resolveFilterSelection: function()
   {
      var idx = shIndexBy(filterList, "label", this.selectedFilterLabel);
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
//   1. ImageSolve section (ASTAP checkbox inside)
//   2. SPFC section (White Ref, Camera, Filter dropdowns inside)
//   3. Previews section (number of previews dropdown inside)
//   4. MGC section (4 gradient scale dropdowns inside, greyed by count)
// Bottom bar: New Instance + OK + Cancel
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
         WorkflowParameters.enableASTAP = true;
         dlg.astap_CheckBox.checked = true;
         dlg.astap_CheckBox.enabled = true;
      }

      // ASTAP requires ImageSolve
      dlg.astap_CheckBox.enabled = WorkflowParameters.enableImageSolve;
      if ( !WorkflowParameters.enableImageSolve )
      {
         WorkflowParameters.enableASTAP = false;
         dlg.astap_CheckBox.checked = false;
      }

      // GC manually enabled -> ImageSolve + ASTAP on, SPFC off, MGC off,
      // Previews off. GC always makes its own 2 previews (GC_, GC_1); the
      // MGC preview count is left alone and comes back with MGC.
      if ( WorkflowParameters.enableGC )
      {
         if ( !WorkflowParameters.enableImageSolve )
         {
         WorkflowParameters.enableImageSolve = true;
         dlg.imageSolve_Section.checkBox.checked = true;
         dlg.imageSolve_Control.enabled = true;
         WorkflowParameters.enableASTAP = true;
         dlg.astap_CheckBox.checked = true;
         dlg.astap_CheckBox.enabled = true;
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
         WorkflowParameters.enableASTAP = true;
         dlg.astap_CheckBox.checked = true;
         dlg.astap_CheckBox.enabled = true;
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
      // ASTAP requires ImageSolve
      dlg.astap_CheckBox.enabled = WorkflowParameters.enableImageSolve;
      if ( !WorkflowParameters.enableImageSolve )
      {
         WorkflowParameters.enableASTAP = false;
         dlg.astap_CheckBox.checked = false;
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

   // ASTAP checkbox
   this.astap_CheckBox = new CheckBox( this );
   this.astap_CheckBox.text = "ASTAP Blind Solve (if needed)";
   this.astap_CheckBox.checked = WorkflowParameters.enableASTAP;
   this.astap_CheckBox.toolTip = "<p>Run ASTAP blind plate solve when FITS keywords are missing.<br/>" +
      "Requires ImageSolver to be enabled.</p>";
   this.astap_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableASTAP = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // ImageSolve section content control
   this.imageSolve_Control = new Control( this );
   this.imageSolve_Control.sizer = new VerticalSizer;
   this.imageSolve_Control.sizer.margin = 6;
   this.imageSolve_Control.sizer.spacing = 4;
   this.astap_Sizer = new HorizontalSizer;
   this.astap_Sizer.addSpacing( 44 );
   this.astap_Sizer.add( this.astap_CheckBox );
   this.astap_Sizer.addStretch();
   this.imageSolve_Control.sizer.add( this.astap_Sizer );

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
   nbWaveLabel.setFixedWidth( 120 );
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
   this.nbRedWave_Edit.setFixedWidth( 120 );
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
   this.nbGreenWave_Edit.setFixedWidth( 120 );
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
   this.nbBlueWave_Edit.setFixedWidth( 120 );
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
      var path = d.fileName;
      if ( File.extractExtension( path ).toLowerCase() !== ".txt" )
         path += ".txt";
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

   // MGC Filter selection
   var MGC_FILTERS = ["L", "R", "G", "B", "Ha", "OIII", "SII", "IR"];

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
   // SECTION 5: GradientCorrection (collapsed, disabled by default)
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
   this.gc_Section.onToggleSection = toggleSectionHandler;

   // Always start collapsed - opens only via the arrow
   this.gc_Section.toggleSection();

   // =================================================================
   // SECTION 6: DynamicBackgroundExtraction (collapsed, disabled by default)
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
   this.dbe_Section.onToggleSection = toggleSectionHandler;

   // Always start collapsed - opens only via the arrow
   this.dbe_Section.toggleSection();

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
      WorkflowParameters.enableASTAP = false;
      WorkflowParameters.enableSPFC = false;
      WorkflowParameters.enablePreviews = false;
      WorkflowParameters.enableMGC = false;

      dlg.imageSolve_Section.checkBox.checked = false;
      dlg.imageSolve_Control.enabled = false;
      dlg.astap_CheckBox.checked = false;
      dlg.astap_CheckBox.enabled = false;
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
      "Default: ImageSolve (with ASTAP), SPFC, Previews (4), MGC enabled. GC and DBE disabled.<br/>" +
      "Equipment settings (camera, filter, white reference, gradient scales) are not changed.</p>";
   this.resetDefaultsButton.onClick = function()
   {
      WorkflowParameters.enableImageSolve = true;
      WorkflowParameters.enableASTAP = true;
      WorkflowParameters.enableSPFC = true;
      WorkflowParameters.enablePreviews = true;
      WorkflowParameters.enableMGC = true;
      WorkflowParameters.numPreviews = 4;
      WorkflowParameters.gradientScale0 = 768;
      WorkflowParameters.gradientScale1 = 1024;
      WorkflowParameters.gradientScale2 = 2048;
      WorkflowParameters.gradientScale3 = 3072;

      dlg.imageSolve_Section.checkBox.checked = true;
      dlg.imageSolve_Control.enabled = true;
      dlg.astap_CheckBox.checked = true;
      dlg.astap_CheckBox.enabled = true;
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
      for (var i = 0; i < 4; i++)
         dlg.gradientScaleCombo[i].currentItem = WorkflowParameters.gradientScaleToComboIndex(
            WorkflowParameters.getGradientScale(i));
      dlg.updateGradientScaleStates();
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
      dlg.mgcFilters_CheckBox.checked = false;
      dlg.mgcFilterRows_Control.visible = false;
      dlg.mgcGray_ComboBox.currentItem = mgcFilterIndex( "L" );
      dlg.mgcRed_ComboBox.currentItem = mgcFilterIndex( "Ha" );
      dlg.mgcGreen_ComboBox.currentItem = mgcFilterIndex( "OIII" );
      dlg.mgcBlue_ComboBox.currentItem = mgcFilterIndex( "OIII" );
      dlg.adjustToContents();
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
   console.writeln("    ASTAP:    " + (WorkflowParameters.enableASTAP ? "Yes" : "No"));
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
   }

   console.writeln("=".repeat(80) + "\n");
}

// ============================================================
// PART 1: PLATE SOLVING FUNCTIONS
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
        focallen: { exists: false, value: "" },
        dateobs: { exists: false, value: "" },
        equinox: { exists: false, value: "" }
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
        if (name == "DATE-OBS") {
            found.dateobs.exists = true;
            found.dateobs.value = value;
        }
        if (name == "EQUINOX") {
            found.equinox.exists = true;
            found.equinox.value = value;
        }
    }

    return found;
}

function runASTAPWorkflow() {
    let win = ImageWindow.activeWindow;
    let view = win.mainView;   // always the whole image, whatever tab is selected
    let keywords = win.keywords;

    let astapPath = resolveASTAPPath();
    if (!astapPath) {
        console.criticalln("ASTAP not found and no path selected. Cannot proceed.");
        return false;
    }

    let raStr = null, decStr = null;
    let pixelSize = null, focalLength = null;

    function stripQuotes(str) {
        str = str.trim();
        while (str.length > 0 && (str[0] == "'" || str[0] == '"'))
            str = str.substring(1);
        while (str.length > 0 && (str[str.length-1] == "'" || str[str.length-1] == '"'))
            str = str.substring(0, str.length-1);
        return str.trim();
    }

    for (let i = 0; i < keywords.length; i++) {
        let name = keywords[i].name;
        let value = keywords[i].value;

        if (name == "OBJCTRA" || (name == "RA" && !raStr)) raStr = stripQuotes(value);
        if (name == "OBJCTDEC" || (name == "DEC" && !decStr)) decStr = stripQuotes(value);
        if (name == "XPIXSZ") pixelSize = parseFloat(value);
        if (name == "FOCALLEN") focalLength = parseFloat(value);
    }

    var blindMode = false;
    if (!raStr || !decStr) {
        console.writeln("  No RA/Dec coordinates found - switching to blind solve mode (-r 179)");
        blindMode = true;
    } else if (!focalLength) {
        console.writeln("  FOCALLEN missing from master - switching to blind solve mode (-r 179)");
        blindMode = true;
    }

    function parseRA(str) {
        str = str.replace(/[hms: '"]/g, ' ').replace(/\s+/g, ' ').trim();
        let parts = str.split(' ');
        if (parts.length >= 3) {
            let h = parseFloat(parts[0]);
            let m = parseFloat(parts[1]);
            let s = parseFloat(parts[2]);
            return (h + m/60.0 + s/3600.0) * 15.0;
        }
        let val = parseFloat(str);
        if (val <= 24) val *= 15.0;
        return val;
    }

    function parseDec(str) {
        let sign = str.indexOf('-') >= 0 ? -1 : 1;
        str = str.replace(/[hms: '"+-]/g, ' ').replace(/\s+/g, ' ').trim();
        let parts = str.split(' ');
        if (parts.length >= 3) {
            let d = parseFloat(parts[0]);
            let m = parseFloat(parts[1]);
            let s = parseFloat(parts[2]);
            return sign * (Math.abs(d) + m/60.0 + s/3600.0);
        }
        return parseFloat(str);
    }

    var raDeg = 0, decDeg = 0, spd = 0;
    if (!blindMode) {
        raDeg = parseRA(raStr);
        decDeg = parseDec(decStr);
        spd = 90.0 - decDeg;
        console.writeln("  RA:  " + raDeg.toFixed(3) + " ");
        console.writeln("  Dec: " + decDeg.toFixed(3) + " ");
    }

    let tempJpg = File.systemTempDirectory + "/astap_solve.jpg";

    let exportWin = new ImageWindow(
        view.image.width, view.image.height,
        view.image.numberOfChannels, 16, false,
        view.image.isColor, "temp_astap"
    );

    exportWin.mainView.beginProcess(UndoFlag.NoSwapFile);
    exportWin.mainView.image.assign(view.image);

    // Auto-stretch if linear (median < 0.1) so ASTAP can detect stars
    let median = exportWin.mainView.image.median();
    if (median < 0.1) {
        console.writeln("  Image is linear (median=" + median.toFixed(4) + ") - applying auto-stretch for ASTAP...");
        let P = new PixelMath;
        P.expression = "mtf(mtf(0.25,med($T)-min(max(0,med($T)+(-2.8)*1.4826*mdev($T)),1)),max(0,($T-min(max(0,med($T)+(-2.8)*1.4826*mdev($T)),1))/~min(max(0,med($T)+(-2.8)*1.4826*mdev($T)),1)))";
        P.useSingleExpression = true;
        P.createNewImage = false;
        P.executeOn(exportWin.mainView);
    }

    exportWin.mainView.endProcess();
    exportWin.saveAs(tempJpg, false, false, false, false);
    exportWin.forceClose();

    if (blindMode)
        console.writeln("\nRunning ASTAP blind solve (may take 1-3 minutes)...");
    else
        console.writeln("\nRunning ASTAP targeted solve (10-30 seconds)...");

    let scriptPath = File.systemTempDirectory + "/run_astap.bat";
    let astapDir = File.extractDrive(astapPath) + File.extractDirectory(astapPath);
    let scriptContent = "@echo on\n";
    scriptContent += "cd /d \"" + astapDir.replace(new RegExp("/", "g"), "\\") + "\"\n";
    if (blindMode) {
        let tempJpgWin = tempJpg.replace(new RegExp("/", "g"), "\\");
        scriptContent += "\"astap.exe\" -f \"" + tempJpgWin + "\" -r 179 -fov 0 -z 0 -wcs\n";
        console.writeln("BAT content: " + scriptContent);
        console.writeln("ASTAP command: blind solve (-r 179, full sky search)");
    } else {
        let tempJpgWin = tempJpg.replace(new RegExp("/", "g"), "\\");
        scriptContent += "\"astap.exe\" -f \"" + tempJpgWin + "\" -ra " + raDeg.toFixed(3);
        scriptContent += " -spd " + spd.toFixed(3) + " -fov 0 -z 0 -wcs\n";
        console.writeln("BAT content: " + scriptContent);
        console.writeln("ASTAP command: targeted solve (RA=" + raDeg.toFixed(3) + " SPD=" + spd.toFixed(3) + ")");
    }
    scriptContent += "exit\n";

    File.writeTextFile(scriptPath, scriptContent);

    let process = new ExternalProcess;

    process.onFinished = function(exitCode) {
        console.writeln("  ASTAP finished (exit: " + exitCode + ")");
    };

    try {
        process.start("cmd.exe", ["/c", scriptPath]);

        while (process.isStarting)
            CoreApplication.processEvents();
        while (process.isRunning)
            CoreApplication.processEvents();

        System.msleep(2000);

    } catch (error) {
        console.criticalln("✘ Error running ASTAP: " + error);
        return false;
    }

    let wcsFile = tempJpg.replace(".jpg", ".wcs");
    let iniFile = tempJpg.replace(".jpg", ".ini");

    if (!File.exists(wcsFile)) {
        console.criticalln("✘ WCS file not created");
        return false;
    }

    if (File.exists(iniFile)) {
        let iniContent = File.readTextFile(iniFile);
        if (iniContent.indexOf("PLTSOLVD=T") < 0) {
            console.criticalln("✘ Plate solve failed");
            return false;
        }
    }

    console.writeln("  ✔ ASTAP plate solve successful");

    let wcsContent = File.readTextFile(wcsFile);
    const cardLength = 80;
    let wcsHeader = {};

    for (let i = 0; i < wcsContent.length; i += cardLength) {
        let card = wcsContent.substring(i, i + cardLength).trim();
        if (card === "" || card.startsWith("END")) break;
        if (card.indexOf("=") === -1) continue;

        let key = card.substring(0, 8).trim().toUpperCase();
        let valueStr = card.substring(10, 80).trim();
        let parts = valueStr.split("/");
        let valuePart = parts[0].trim();

        if (valuePart.startsWith("'") && valuePart.endsWith("'")) {
            valuePart = valuePart.substring(1, valuePart.length - 1);
        }

        wcsHeader[key] = valuePart;
    }

    console.writeln("  ✔ WCS parsed");

    let newKeywords = [
        new FITSKeyword("CTYPE1", "RA---TAN", "Coordinate type"),
        new FITSKeyword("CTYPE2", "DEC--TAN", "Coordinate type"),
        new FITSKeyword("CRVAL1", wcsHeader["CRVAL1"], "RA reference (deg)"),
        new FITSKeyword("CRVAL2", wcsHeader["CRVAL2"], "Dec reference (deg)"),
        new FITSKeyword("CRPIX1", wcsHeader["CRPIX1"], "Reference pixel X"),
        new FITSKeyword("CRPIX2", wcsHeader["CRPIX2"], "Reference pixel Y"),
        new FITSKeyword("CD1_1", wcsHeader["CD1_1"], "CD matrix"),
        new FITSKeyword("CD1_2", wcsHeader["CD1_2"], "CD matrix"),
        new FITSKeyword("CD2_1", wcsHeader["CD2_1"], "CD matrix"),
        new FITSKeyword("CD2_2", wcsHeader["CD2_2"], "CD matrix"),
        new FITSKeyword("RADECSYS", "ICRS", "Reference system")
    ];

    let existingKeywords = win.keywords;
    let finalKeywords = [];

    for (let i = 0; i < existingKeywords.length; i++) {
        let name = existingKeywords[i].name;
        if (name != "CTYPE1" && name != "CTYPE2" &&
            name != "CRVAL1" && name != "CRVAL2" &&
            name != "CRPIX1" && name != "CRPIX2" &&
            name != "CD1_1" && name != "CD1_2" &&
            name != "CD2_1" && name != "CD2_2" &&
            name != "RADECSYS") {
            finalKeywords.push(existingKeywords[i]);
        }
    }

    for (let i = 0; i < newKeywords.length; i++) {
        finalKeywords.push(newKeywords[i]);
    }

    win.keywords = finalKeywords;
    console.writeln("  ✔ WCS keywords written");

    try {
        if (File.exists(tempJpg)) File.remove(tempJpg);
        if (File.exists(wcsFile)) File.remove(wcsFile);
        if (File.exists(iniFile)) File.remove(iniFile);
        if (File.exists(scriptPath)) File.remove(scriptPath);
    } catch (e) {}

    return true;
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

// True if the view carries an astrometric solution (either namespace).
function shHasSolution(view) {
    return shSolutionProperty(view, "CreatorModule") != null;
}

// Re-run marks, written right after a step runs. PixInsight keeps view
// properties per history state, so undoing that step in History Explorer
// removes its mark again. Storable: saved with the file.
// (view.processing alone is NOT usable for this: it still lists undone steps.)
function shMarkDone(view, id) {
    try { view.setPropertyValue(id, true, PropertyType.Boolean,
                                PropertyAttribute.Storable | PropertyAttribute.Permanent); } catch (e) {}
}
function shHasMark(view, id) {
    try { return view.hasProperty(id); } catch (e) { return false; }
}

// True if a process with this id is in the view's processing history
// (including steps undone in History Explorer).
function shInHistory(view, processId) {
    try {
        var pc = view.processing;
        for (var i = 0; i < pc.length; i++)
            if (pc[i].processId() == processId)
                return true;
    } catch (e) {}
    return false;
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

        // Observation-time fallback: Gaia/XPSD catalogs require a valid
        // observation time or ImageSolver refuses to run. initialize() reads it
        // from the image; if the master lacks DATE-OBS, try to recover it from
        // the image's WCS keywords (same approach as WBPP's BPP-Solver).
        if (!solver.metadata.observationTime) {
            try {
                let wcs = new WCSKeywords();
                wcs.Read(win);
                if (wcs.observationTime)
                    solver.metadata.observationTime = wcs.observationTime;
            } catch (e) {}
            if (!solver.metadata.observationTime)
                console.warningln("  Note: image has no observation time (DATE-OBS); " +
                                  "Gaia catalogs require one - the solve may fail.");
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
        console.criticalln("\n⚠  ImageSolver failed: " + error.toString());
    }

    // Manual fallback (kept intact): let the user solve by hand and re-run.
    console.warningln("Please plate-solve manually, then run this script again:");
    console.warningln("  Script > Image Analysis > ImageSolver\n");
    return false;
}

function smartPlateSolve() {
    console.writeln("\n" + "=".repeat(80));
    console.writeln("PART 1: Smart Plate Solve");
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
        console.writeln("✔ Skipping ASTAP (not needed)\n");

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
        // Check if ASTAP is enabled
        if (!WorkflowParameters.enableASTAP) {
            console.writeln("DECISION: ASTAP needed but is DISABLED");
            console.writeln("-".repeat(80));
            console.writeln("\nMissing data:");
            if (!hasCoordinates) console.writeln("  ✘ RA/Dec coordinates");
            if (!hasImageScale) console.writeln("  ✘ Image scale");
            console.writeln("\n⚠  ASTAP is disabled. Cannot proceed with plate solving.");
            console.writeln("Either enable ASTAP or manually add WCS keywords.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
        }

        console.writeln("DECISION: ASTAP needed");
        console.writeln("-".repeat(80));
        console.writeln("\nMissing data:");
        if (!hasCoordinates) console.writeln("  ✘ RA/Dec coordinates");
        if (!hasImageScale) console.writeln("  ✘ Image scale");
        console.writeln();

        if (!runASTAPWorkflow()) {
            console.criticalln("✘ ASTAP workflow failed");
            return false;
        }

        console.writeln("\n" + "=".repeat(80));
        console.writeln("✔ ASTAP COMPLETE");
        console.writeln("=".repeat(80));

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
// PART 2: WORKFLOW FUNCTIONS (SPFC + Previews + MGC)
// ============================================================

// ============================================================
// Ha/OIII separation (dual-band OSC, before SPFC)
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
   console.writeln("Ha/OIII SEPARATION (dual-band OSC)");
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
   if (shHasMark(view, "SpaceHunter:SPFCDone") ||
       (shHasMark(view, "PCL:SPFC:Version") && !shInHistory(view, "SpectrophotometricFluxCalibration"))) {
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
   console.writeln("STEP 1: Running SPFC (Dynamic XSPD Version)");
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

   // Our own mark follows History Explorer rollbacks. A file saved after SPFC
   // by an older version has only SPFC's own properties: count those too, but
   // not when SPFC is in this session's history without our mark (= undone).
   var spfcAlreadyApplied = shHasMark(view, "SpaceHunter:SPFCDone") ||
      (shHasMark(view, "PCL:SPFC:Version") && !shInHistory(view, "SpectrophotometricFluxCalibration"));

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
// STEP 2: Create Previews (variable count)
// ============================================================

// count: number of previews; defaults to the Previews section setting.
function createPreviews(prefix, count)
{
   if (prefix === undefined) prefix = "BM_";

   var numPreviews = (count !== undefined) ? count : WorkflowParameters.numPreviews;

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 2: Creating " + numPreviews + " Preview(s)");
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

   for ( let i = 0; i < numPreviews; ++i )
   {
      let scale = WorkflowParameters.getGradientScale(i);
      let id = (prefix === "BM_") ? (prefix + scale) :
               (prefix === "GC_") ? (i === 0 ? prefix : prefix + i) :
               (i === 0 ? prefix : prefix + i);
      // Same scale twice: BM_1024_1 instead of PixInsight's automatic BM_10241,
      // which reads like a scale of 10241. Same numbering as +Previews.
      for ( let k = 1; previews.some( function( p ) { return p.id == id; } ); ++k )
         id = prefix + scale + "_" + k;
      let pv = win.createPreview( rect, id );
      previews.push( pv );
      console.writeln( "Created preview: " + id );
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
// STEP 3: MGC on Previews (variable count + per-preview scales)
// ============================================================

// Builds the MGC instance used both for the preview runs and for the tool
// opened at the end, so the opened tool always carries the run's settings.
function buildMGCInstance(gradientScale, showGradientModel)
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
   P.showGradientModel = showGradientModel;
   P.command = "";
   return P;
}

function runMGC(view, gradientScale, previewName)
{
   console.writeln("\n" + "-".repeat(80));
   console.writeln("Processing: " + previewName);
   console.writeln("Gradient Scale: " + gradientScale);
   console.writeln("-".repeat(80));

   // Preview runs keep the gradient model windows for comparing scales.
   var P = buildMGCInstance(gradientScale, true);

   if (!P.executeOn(view))
      throw new Error("MultiscaleGradientCorrection failed on " + previewName);

   console.writeln(previewName + " completed successfully.");
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
   console.writeln("STEP 3: MGC Multi-Preview Processor (" + numPreviews + " previews)");
   console.writeln("=".repeat(80) + "\n");

   var mgcStartTime = Date.now();

   var win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");

   var previews = win.previews;

   console.writeln("Found " + previews.length + " preview(s) in image: " + win.mainView.id + "\n");

   if (previews.length < numPreviews)
      throw new Error("This script requires " + numPreviews + " previews. Found only " + previews.length);

   for (var i = 0; i < numPreviews; i++)
   {
      var preview = previews[i];
      var scale = WorkflowParameters.getGradientScale(i);

      console.writeln("Processing preview " + (i + 1) + " of " + numPreviews + ": " + preview.id);

      // Make the preview being processed the active tab, so the user follows along.
      showPreview(win, preview);

      runMGC(preview, scale, preview.id);

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
   for (var i = 0; i < numPreviews; i++)
      console.writeln("  " + previews[i].id + ": " + WorkflowParameters.getGradientScale(i));
   console.writeln("\n");
}

// ============================================================
// STEP 4: GradientCorrection on 2 Previews (fallback or manual)
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
   console.writeln("STEP 4: GradientCorrection on " + GC_PRESETS.length + " previews");
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
// Adaptive Auto STF (internal use - for GC gradient model images)
// ============================================================

function applyAdaptiveAutoSTF(targetWindow)
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
// STEP 5b: Choose background model (apply a preview's MGC model)
// ------------------------------------------------------------
// MGC keeps only its LAST run cached: re-applying the last scale takes ~2 s,
// any other scale is a full recompute (measured 2026-10-05 on a 12438x8264
// image: ~32 s at 1024, ~210 s at 3072).
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
          P.greenMARSFilter + "/" + P.blueMARSFilter;
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
   console.writeln("STEP: Apply background model " + preview.id + " to " + win.mainView.id);
   console.writeln("MGC settings: " + bgmDescribe(mgc));
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
   this.info_Label.text = "<b>" + win.mainView.id + "</b><br/>" +
      "Click a model below to show its preview. Apply is instant for " +
      "every scale. Need another scale? Add it below.";

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
      "with the same settings as the other models. Takes as long as one MGC preview run.</p>";
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
   rb.text = this.previews[idx].id + "   (scale " + mgc.gradientScale + ")";
   rb.toolTip = bgmDescribe(mgc);
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

BackgroundModelDialog.prototype.setBusy = function(busy)
{
   this.scale_GroupBox.enabled = !busy;
   this.addScale_ComboBox.enabled = !busy && this.addScaleValues.length > 0;
   this.addScale_Button.enabled = !busy && this.addScaleValues.length > 0;
   this.cleanUp_CheckBox.enabled = !busy;
   this.apply_Button.enabled = !busy;
   this.tool_Button.enabled = !busy;
   this.close_Button.enabled = !busy;
   this.addScale_Button.text = busy ? "Running MGC..." : "Run MGC";
};

// Run MGC for one more scale on a new full-frame preview, using the first
// model's MGC settings with only the scale changed. Called from the wait
// loop (not from the button handler) so the long run is outside a GUI event.
BackgroundModelDialog.prototype.runAddedScale = function(scale)
{
   var win = this.win;
   var id = "BM_" + scale;
   var img = win.mainView.image;
   var pv = null;
   this.setBusy(true);
   CoreApplication.processEvents();
   try
   {
      var P = new MultiscaleGradientCorrection;
      P.assign(bgmMgcInstanceOf(this.previews[0]));
      P.gradientScale = scale;
      P.showGradientModel = true;

      pv = win.createPreview(new Rect(0, 0, img.width, img.height), id);
      showPreview(win, pv);
      win.zoomToOptimalFit();
      CoreApplication.processEvents();

      console.writeln("\n" + "-".repeat(80));
      console.writeln("Added scale - Processing: " + pv.id);
      console.writeln("Gradient Scale: " + scale);
      console.writeln("-".repeat(80));
      var t0 = Date.now();
      if (!P.executeOn(pv))
         throw new Error("MultiscaleGradientCorrection failed on " + pv.id);
      console.writeln(pv.id + " completed in " + ((Date.now() - t0) / 1000).toFixed(1) + " s.");

      this.previews.push(pv);
      this.addRadio(this.previews.length - 1);
      this.refreshAddScale();
      this.adjustToContents();
      showPreview(win, pv);
      this.select(this.previews.length - 1, false);
   }
   catch (e)
   {
      console.warningln("⚠  Adding scale " + scale + " failed: " + e.message);
      if (pv != null && !pv.isNull)
         win.deletePreview(pv);
   }
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
      buildMGCInstance(WorkflowParameters.getGradientScale(WorkflowParameters.numPreviews - 1), false).launch();
      return;
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP: Choose background model (" + previews.length + " preview(s))");
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
// STEP 4b: Choose GC result
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
   console.writeln("STEP: Apply GC result " + preview.id + " to " + win.mainView.id);
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
      "its preview.";

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

// fromRadio: the user clicked a radio button -> show that preview too.
GCResultDialog.prototype.select = function(idx, fromRadio)
{
   this.selected = idx;
   if (!this.radios[idx].checked)
      this.radios[idx].checked = true;
   if (fromRadio && this.win.currentView.id != this.previews[idx].id)
      this.win.currentView = this.previews[idx];
   this.lastSeenViewId = this.win.currentView.id;
};

// Called from the wait loop: follow the preview tab the user switches to.
GCResultDialog.prototype.syncWithWindow = function()
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
   console.writeln("STEP: Choose GC result (" + previews.length + " preview(s))");
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
         console.writeln("GC result selection cancelled - image left unchanged.\n");
         return;
      }
      dlg.syncWithWindow();
      CoreApplication.processEvents();
      System.msleep(50);
   }

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

function main()
{
   console.show();

   // Start timer
   let startTime = new Date();

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
         WorkflowParameters.load();
      }
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

      // Part 1: Plate solving
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

      // Part 2: Workflow
      console.writeln("\n" + "=".repeat(80));
      console.writeln("PART 2: SPFC + Previews + MGC Workflow");
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
      if (spfcError.message === "Script cancelled by user.") throw spfcError;
      console.warningln("\n\u26A0  SPFC failed: " + spfcError.message);
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
                  if (mgcError.message === "Script cancelled by user.") throw mgcError;
                  console.warningln("\n\u26A0  MGC failed (likely no MARS reference data available).");
                  console.writeln("Falling back to GradientCorrection...\n");
                  mgcFailed = true;
               }
            }
         } else {
            try {
               runMGCOnPreviews();
            } catch (mgcError) {
               if (mgcError.message === "Script cancelled by user.") throw mgcError;
               console.warningln("\n\u26A0  MGC failed (likely no MARS reference data available).");
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
         createPreviews("GC_", GC_PRESETS.length);
         let win = gcWin;
         try {
            gcModelIds = runGCOnPreviews();
            gcRan = true;
         } catch (gcError) {
            if (gcError.message === "Script cancelled by user.") throw gcError;
            console.warningln("\n\u26A0  GradientCorrection failed: " + gcError.message + "\n");
         }

         // Apply Adaptive Auto STF to GC gradient model images
         for (var g = 0; g < gcModelIds.length; g++) {
            var modelWin = ImageWindow.windowById(gcModelIds[g]);
            if (!modelWin.isNull) {
               console.writeln("Applying Adaptive Auto STF to " + gcModelIds[g] + "...");
               applyAdaptiveAutoSTF(modelWin);
               console.writeln("\u2714 " + gcModelIds[g] + " stretched.");
            }
         }
         // Bring main image back to front
         win.bringToFront();
      }

      // DBE: manual mode only (just opens the tool)
      if (WorkflowParameters.enableDBE) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP: DynamicBackgroundExtraction");
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
      if (error.message === "Script cancelled by user.") {
         console.writeln("\nScript cancelled by user.\n");
      } else {
         console.criticalln("\nERROR: " + error.message);
      throw error;
      }
    }
}

main();
