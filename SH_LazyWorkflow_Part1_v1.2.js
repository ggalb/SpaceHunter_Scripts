#feature-id Space_Hunter > SH Lazy Workflow Part 1
#feature-icon  SH_WorkFlow1.svg
#feature-info Space Hunter Lazy Workflow Part 1 v1.2<br/>\
   <br/>\
   Automated Linear Image Processing workflow for OSC camera images.<br/>\
   <br/>\
   Includes: Equipment selection with collapsible sections, ASTAP integration,<br/>\
   ImageSolver, SPFC, variable previews (1-4), MultiscaleGradientCorrection with<br/>\
   per-preview gradient scale selection. Optional GC and cDBE, New Instance support.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   See LICENSE file for details: https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE.

// ============================================================
// Space Hunter Lazy Workflow Part 1 v1.2
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
// Part 6: GradientCorrection (MGC fallback or manual, 2 previews)
// Part 7: cDBE - DynamicBackgroundExtraction
// ============================================================
//
// THIS SCRIPT IS FOR OSC CAMERA IMAGES ONLY
//
// Requirements:
// - Windows machine
// - PixInsight 1.9.3
// - MARS database installed
// - ASTAP and D50 star map installed - Path: C:\Program Files\astap
// - OSC Camera Image
// - Image pre-cropped

#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/NumericControl.jsh>

// ============================================================
// ASTAP PATH - Auto-detect with persistent storage + browse fallback
// ============================================================

var SETTINGS_KEY_ASTAP = "SpaceHunter/ASTAPPath";

function resolveASTAPPath()
{
   // 1. Check saved path from previous run
   let savedPath = null;
   try {
      savedPath = Settings.read(SETTINGS_KEY_ASTAP, DataType_String);
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
         Settings.write(SETTINGS_KEY_ASTAP, DataType_String, commonPaths[i]);
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
         Settings.write(SETTINGS_KEY_ASTAP, DataType_String, selectedPath);
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

function resolveMARSFiles()
{
   // 1. Check saved paths from previous run
   let savedJSON = null;
   try {
      savedJSON = Settings.read(SETTINGS_KEY_MARS, DataType_String);
   } catch (e) {}
   if (savedJSON) {
      try {
         let savedFiles = JSON.parse(savedJSON);
         let allExist = true;
         for (let i = 0; i < savedFiles.length; i++) {
            if (!File.exists(savedFiles[i])) { allExist = false; break; }
         }
         if (allExist && savedFiles.length > 0) {
            console.writeln("MARS database found (saved): " + savedFiles.length + " file(s)");
            let result = [];
            for (let i = 0; i < savedFiles.length; i++)
               result.push([true, savedFiles[i]]);
            return result;
         }
      } catch (e) {}
   }

   // 2. Search common locations for .xmars files
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
      Settings.write(SETTINGS_KEY_MARS, DataType_String, JSON.stringify(foundFiles));
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
         Settings.write(SETTINGS_KEY_MARS, DataType_String, JSON.stringify(userFiles));
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
#define SCRIPT_VERSION "v1.2"
// PDF User Guide - same folder as this script
var SCRIPT_DIR = File.extractDrive(#__FILE__) + File.extractDirectory(#__FILE__);
var PDF_GUIDE_PATH = SCRIPT_DIR + "/SH_Workflow_Guide.pdf";
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

// Determine which filter database to use
var FILTERS_XSPD_PATH;
if (File.exists(customFilterPath)) {
   FILTERS_XSPD_PATH = customFilterPath;
} else {
   FILTERS_XSPD_PATH = null;
   for (var i = 0; i < libraryPaths.length; i++) {
      if (File.exists(libraryPaths[i])) {
         FILTERS_XSPD_PATH = libraryPaths[i];
         break;
      }
   }
}

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
var filterList = [];    // array of { label: "...", type: "...", redName: "...", greenName: "...", blueName: "..." }

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
   selectedFilterIdx:   0,

   // Previews section
   numPreviews: 4,

   // MGC section - per-preview gradient scales
   gradientScale0: 768,
   gradientScale1: 1024,
   gradientScale2: 2048,
   gradientScale3: 3072,

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
      Parameters.set("selectedFilterIdx",   this.selectedFilterIdx);

      Parameters.set("numPreviews", this.numPreviews);

      Parameters.set("gradientScale0", this.gradientScale0);
      Parameters.set("gradientScale1", this.gradientScale1);
      Parameters.set("gradientScale2", this.gradientScale2);
      Parameters.set("gradientScale3", this.gradientScale3);
   },
   // -----------------------------------------------------------
   // Save user preferences to persistent Settings store
   // -----------------------------------------------------------
   saveUserPrefs: function()
   {
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
         selectedFilterIdx:   this.selectedFilterIdx,
         numPreviews:         this.numPreviews,
         gradientScale0:      this.gradientScale0,
         gradientScale1:      this.gradientScale1,
         gradientScale2:      this.gradientScale2,
         gradientScale3:      this.gradientScale3
      };
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType_String, JSON.stringify(prefs));
      } catch (e) {}
   },

   // -----------------------------------------------------------
   // Load user preferences from persistent Settings store
   // -----------------------------------------------------------
   loadUserPrefs: function()
   {
      try {
         var saved = Settings.read(SETTINGS_KEY_USERPREFS, DataType_String);
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
            if (prefs.selectedFilterIdx   !== undefined) this.selectedFilterIdx   = prefs.selectedFilterIdx;
            if (prefs.numPreviews         !== undefined) this.numPreviews         = prefs.numPreviews;
            if (prefs.gradientScale0      !== undefined) this.gradientScale0      = prefs.gradientScale0;
            if (prefs.gradientScale1      !== undefined) this.gradientScale1      = prefs.gradientScale1;
            if (prefs.gradientScale2      !== undefined) this.gradientScale2      = prefs.gradientScale2;
            if (prefs.gradientScale3      !== undefined) this.gradientScale3      = prefs.gradientScale3;
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
      this.selectedFilterIdx   = 0;
      this.numPreviews         = 4;
      this.gradientScale0      = 768;
      this.gradientScale1      = 1024;
      this.gradientScale2      = 2048;
      this.gradientScale3      = 3072;
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
      if (Parameters.has("selectedFilterIdx"))
         this.selectedFilterIdx = Parameters.getInteger("selectedFilterIdx");

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

function parseFiltersXSPD()
{
   console.writeln("Reading filter database: " + FILTERS_XSPD_PATH);

   if (FILTERS_XSPD_PATH === null || !File.exists(FILTERS_XSPD_PATH)) {
      throw new Error("No filter database found! Checked both custom and library locations.");
   }

   var xml = File.readTextFile(FILTERS_XSPD_PATH);
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

   console.writeln("  Parsed " + count + " filter entries");
   if (count === 0)
      throw new Error("No filter entries found in XSPD file.");
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

   // Add PAN filters
   for (var i = 0; i < panEntries.length; i++) {
      filterList.push({
         label: panEntries[i] + " (PAN)",
         type: "pan",
         panName: panEntries[i]
      });
   }

   // Add Luminance filters
   for (var i = 0; i < lumEntries.length; i++) {
      filterList.push({
         label: lumEntries[i] + " (L)",
         type: "lum",
         lumName: lumEntries[i]
      });
   }

   // Sort: broadband first, then precombined, then PAN/L
   filterList.sort(function(a, b) {
      var typeOrder = { broadband: 0, precombined: 1, pan: 2, lum: 3 };
      var ta = typeOrder[a.type] || 99;
      var tb = typeOrder[b.type] || 99;
      if (ta !== tb) return ta - tb;
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   console.writeln("  Filter sets found: " + filterList.length);
   console.writeln("    Broadband RGB: " + filterList.filter(function(f){return f.type==="broadband";}).length);
   console.writeln("    Pre-combined:  " + filterList.filter(function(f){return f.type==="precombined";}).length);
   console.writeln("    PAN filters:   " + filterList.filter(function(f){return f.type==="pan";}).length);
   console.writeln("    L filters:     " + filterList.filter(function(f){return f.type==="lum";}).length);
   console.writeln("");
}

// ============================================================
// Collapsible SectionBar dialog with:
//   1. ImageSolve section (ASTAP checkbox inside)
//   2. SPFC section (White Ref, Camera, Filter dropdowns inside)
//   3. Previews section (number of previews dropdown inside)
//   4. MGC section (4 gradient scale dropdowns inside, greyed by count)
// Bottom bar: New Instance + OK + Cancel
// ============================================================

function SpaceHunterDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dlg = this;

   let labelWidth = this.font.width( "White Reference:" + "MM" );

   // -----------------------------------------------------------------
   // Title / Help Label
   // -----------------------------------------------------------------

   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle = FrameStyle_Box;
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

      // GC manually enabled -> ImageSolve + ASTAP on, SPFC off, MGC off, Previews on with 4
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
         if ( !WorkflowParameters.enablePreviews )
         {
         WorkflowParameters.enablePreviews = true;
         dlg.previews_Section.checkBox.checked = true;
         dlg.previews_Control.enabled = true;
         }
         WorkflowParameters.numPreviews = 4;
         dlg.numPreviews_ComboBox.currentItem = 3;
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
   this.whiteRef_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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

   this.whiteRef_Sizer = new HorizontalSizer;
   this.whiteRef_Sizer.spacing = 6;
   this.whiteRef_Sizer.add( this.whiteRef_Label );
   this.whiteRef_Sizer.add( this.whiteRef_ComboBox, 100 );

   // Camera dropdown
   this.camera_Label = new Label( this );
   this.camera_Label.text = "Camera / Sensor:";
   this.camera_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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

   // Filter dropdown
   this.filter_Label = new Label( this );
   this.filter_Label.text = "Filter:";
   this.filter_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.filter_Label.setFixedWidth( labelWidth );

   this.filter_ComboBox = new ComboBox( this );
   this.filter_ComboBox.editEnabled = false;
   for ( var i = 0; i < filterList.length; i++ )
      this.filter_ComboBox.addItem( filterList[i].label );
   this.filter_ComboBox.currentItem = WorkflowParameters.selectedFilterIdx;
   this.filter_ComboBox.toolTip = "<p>Select filter set for RGB channel curve lookup.</p>";
   this.filter_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedFilterIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.filter_Sizer = new HorizontalSizer;
   this.filter_Sizer.spacing = 6;
   this.filter_Sizer.add( this.filter_Label );
   this.filter_Sizer.add( this.filter_ComboBox, 100 );

   // SPFC section content control
   this.spfc_Control = new Control( this );
   this.spfc_Control.sizer = new VerticalSizer;
   this.spfc_Control.sizer.margin = 6;
   this.spfc_Control.sizer.spacing = 6;
   this.spfc_Control.sizer.add( this.whiteRef_Sizer );
   this.spfc_Control.sizer.add( this.camera_Sizer );
   this.spfc_Control.sizer.add( this.filter_Sizer );

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
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.spfc_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 3: Previews
   // =================================================================

   // Number of previews dropdown
   this.numPreviews_Label = new Label( this );
   this.numPreviews_Label.text = "Number of Previews:";
   this.numPreviews_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.numPreviews_Label.setFixedWidth( labelWidth );

   this.numPreviews_ComboBox = new ComboBox( this );
   this.numPreviews_ComboBox.editEnabled = false;
   this.numPreviews_ComboBox.addItem( "1" );
   this.numPreviews_ComboBox.addItem( "2" );
   this.numPreviews_ComboBox.addItem( "3" );
   this.numPreviews_ComboBox.addItem( "4" );
   this.numPreviews_ComboBox.currentItem = WorkflowParameters.numPreviews - 1;
   this.numPreviews_ComboBox.toolTip = "<p>Select how many full-size previews to create (1-4).<br/>" +
      "MGC will process each preview with its own gradient scale.</p>";
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
   this.previews_Section = new SectionBar( this, "Previews" );
   this.previews_Section.setSection( this.previews_Control );
   this.previews_Section.enableCheckBox( true );
   this.previews_Section.checkBox.checked = WorkflowParameters.enablePreviews;
   this.previews_Section.checkBox.toolTip = "<p>Enable/disable creation of full-size previews.</p>";

   this.previews_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enablePreviews = sectionbar.checkBox.checked;
      dlg.previews_Control.enabled = WorkflowParameters.enablePreviews;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
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
      lbl.text = "Preview " + p + " Gradient Scale:";
      lbl.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      lbl.setFixedWidth( labelWidth );
      this.gradientScaleLabel.push( lbl );

      var combo = new ComboBox( this );
      combo.editEnabled = false;
      for ( var s = 0; s < GRADIENT_SCALE_VALUES.length; s++ )
         combo.addItem( GRADIENT_SCALE_VALUES[s].toString() );
      combo.currentItem = WorkflowParameters.gradientScaleToComboIndex(
         WorkflowParameters.getGradientScale( p ) );
      combo.toolTip = "<p>Select gradient scale for Preview " + p + ".</p>";

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

   // MGC section content control
   this.mgc_Control = new Control( this );
   this.mgc_Control.sizer = new VerticalSizer;
   this.mgc_Control.sizer.margin = 6;
   this.mgc_Control.sizer.spacing = 4;
   for ( var p = 0; p < 4; p++ )
      this.mgc_Control.sizer.add( mgcSizers[p] );

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
   // No user controls needed - GC uses fixed presets on Preview0 and Preview1

   this.gc_Section = new SectionBar( this, "GradientCorrection" );
   this.gc_Section.setSection( this.gc_Control );
   this.gc_Section.enableCheckBox( true );
   this.gc_Section.checkBox.checked = WorkflowParameters.enableGC;
   this.gc_Section.checkBox.toolTip =
      "<p>Run GradientCorrection on Preview0 and Preview1 with two different settings.</p>" +
      "<p>This is an alternative to MGC for images where MARS reference data is not available.</p>" +
      "<p>When enabled: ImageSolve stays on, SPFC and MGC are disabled, 4 Previews are created.</p>" +
      "<p>GC also activates automatically as a fallback if MGC fails due to missing MARS data.</p>" +
      "<p>ImageSolve will be skipped if an astrometric solution already exists.</p>";

   this.gc_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableGC = sectionbar.checkBox.checked;
      dlg.gc_Control.enabled = WorkflowParameters.enableGC;
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.gc_Section.onToggleSection = toggleSectionHandler;

   // Collapse GC by default
   if ( !WorkflowParameters.enableGC )
      this.gc_Section.toggleSection();

   // =================================================================
   // SECTION 6: DynamicBackgroundExtraction (collapsed, disabled by default)
   // =================================================================

   this.dbe_Control = new Control( this );
   this.dbe_Control.sizer = new VerticalSizer;
   this.dbe_Control.sizer.margin = 6;
   // No user controls - DBE opens with basic settings for manual use

   this.dbe_Section = new SectionBar( this, "DynamicBackgroundExtraction" );
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
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.dbe_Section.onToggleSection = toggleSectionHandler;

   // Collapse DBE by default
   if ( !WorkflowParameters.enableDBE )
      this.dbe_Section.toggleSection();

   // =================================================================
   // Info Label
   // =================================================================

   this.info_Label = new Label( this );
   this.info_Label.text = "Loaded: " + whiteRefList.length + " white refs, " +
      cameraList.length + " cameras, " + filterList.length + " filter sets";
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

   // PDF Documentation button
   this.pdfButton = new ToolButton( this );
   var pdfIconPath = SCRIPT_DIR + "/SH_pdfIcon.png";
if (File.exists(pdfIconPath))
   this.pdfButton.icon = new Bitmap(pdfIconPath);
else
   this.pdfButton.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
   this.pdfButton.setScaledFixedSize( 24, 24 );
   this.pdfButton.toolTip = "<p>Open the Space Hunter Workflow Guide (PDF).</p>";
   this.pdfButton.onClick = function()
   {
      if (File.exists(PDF_GUIDE_PATH)) {
         var pdfWinPath = PDF_GUIDE_PATH.replace(new RegExp("/", "g"), "\\");
         var p = new ExternalProcess;
         p.start("explorer.exe", [pdfWinPath]);
      } else {
         (new MessageBox(
            "<p>PDF guide not found:</p><p>" + PDF_GUIDE_PATH + "</p>" +
            "<p>Please make sure <b>SH_Workflow_Guide.pdf</b> is in the same folder as the script.</p>",
            "Guide Not Found", StdIcon_Warning, StdButton_Ok
         )).execute();
      }
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
   var cogIconPath = SCRIPT_DIR + "/SH_Cog.png";
   if (File.exists(cogIconPath))
      this.resetSettingsButton.icon = new Bitmap(cogIconPath).scaledTo(30, 30);
   this.resetSettingsButton.setScaledFixedSize( 30, 30 );
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
      dlg.filter_ComboBox.currentItem = 0;
      dlg.numPreviews_ComboBox.currentItem = 3;
      for (var i = 0; i < 4; i++)
         dlg.gradientScaleCombo[i].currentItem = WorkflowParameters.gradientScaleToComboIndex(
            WorkflowParameters.getGradientScale(i));
      dlg.updateGradientScaleStates();
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

   // Collapse sections with no parameters
   this.gc_Control.hide();
   this.dbe_Control.hide();

   // Size the dialog
   this.ensureLayoutUpdated();
   this.adjustToContents();
   this.setMinWidth( 540 );
   this.setMinHeight();
}

// Inherit from Dialog
SpaceHunterDialog.prototype = new Dialog;

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
      throw new Error("Script cancelled by user.");

   // Log selections
   var wr = whiteRefList[WorkflowParameters.selectedWhiteRefIdx];
   var cam = cameraList[WorkflowParameters.selectedCameraIdx];
   var flt = filterList[WorkflowParameters.selectedFilterIdx];

   console.writeln("\nSelected white reference: " + wr.label);
   console.writeln("Selected camera: " + cam.label);
   console.writeln("Selected filter: " + flt.label + " [" + flt.type + "]");
   if (flt.type === "broadband" || flt.type === "precombined") {
      console.writeln("  R: " + flt.redName);
      console.writeln("  G: " + flt.greenName);
      console.writeln("  B: " + flt.blueName);
   }

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
    let view = win.currentView;
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

    exportWin.mainView.beginProcess(UndoFlag_NoSwapFile);
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
        console.writeln("  ? ASTAP finished (exit: " + exitCode + ")");
    };

    try {
        process.start("cmd.exe", ["/c", scriptPath]);

        while (process.isStarting)
            processEvents();
        while (process.isRunning)
            processEvents();

        msleep(2000);

    } catch (error) {
        console.criticalln("? Error running ASTAP: " + error);
        return false;
    }

    let wcsFile = tempJpg.replace(".jpg", ".wcs");
    let iniFile = tempJpg.replace(".jpg", ".ini");

    if (!File.exists(wcsFile)) {
        console.criticalln("? WCS file not created");
        return false;
    }

    if (File.exists(iniFile)) {
        let iniContent = File.readTextFile(iniFile);
        if (iniContent.indexOf("PLTSOLVD=T") < 0) {
            console.criticalln("? Plate solve failed");
            return false;
        }
    }

    console.writeln("  ? ASTAP plate solve successful");

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

    console.writeln("  ? WCS parsed");

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
    console.writeln("  ? WCS keywords written");

    try {
        if (File.exists(tempJpg)) File.remove(tempJpg);
        if (File.exists(wcsFile)) File.remove(wcsFile);
        if (File.exists(iniFile)) File.remove(iniFile);
        if (File.exists(scriptPath)) File.remove(scriptPath);
    } catch (e) {}

    return true;
}

function openImageSolver() {
    console.writeln("\n" + "-".repeat(80));
    console.writeln("Opening ImageSolver...");
    console.writeln("-".repeat(80));

    let win = ImageWindow.activeWindow;
    let view = win.currentView;

    try {
        #include "C:/Program Files/PixInsight/src/scripts/AdP/ImageSolver.js"

        let solver = new ImageSolver();

        msleep(5000);

        let hasSolution = view.propertyValue("PCL:AstrometricSolution:CreatorModule") != null;

        if (hasSolution) {
            console.writeln("\n? ImageSolver completed successfully!");
            console.writeln("? Astrometric solution created");
            console.writeln("? Continuing with workflow...\n");
            return true;
        } else {
            console.writeln("\n?? ImageSolver opened but solution not detected");
            console.writeln("Please complete ImageSolver manually, then run script again.\n");
            return false;
        }

    } catch (error) {
        console.warningln("\n??  Could not auto-open ImageSolver");
        console.warningln("Please manually run:");
        console.warningln("  Script > Image Analysis > ImageSolver");
        console.warningln("  Then click 'OK'\n");
        return false;
    }
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
    let view = win.currentView;

    console.writeln("Checking for existing astrometric solution...");

    // Check processing history for ImageSolver
    let imageSolverApplied = false;
    if (win.processingHistory && win.processingHistory.length > 0) {
        var history = win.processingHistory;
        for (var i = 0; i < history.length; i++) {
            if (history[i].indexOf("P.information = \"ImageSolver") >= 0) {
                imageSolverApplied = true;
                break;
            }
        }
    }

    // Fall back to PCL property check (handles History Explorer rollback scenario)
     let hasSolution = imageSolverApplied;

    if (hasSolution) {
        let catalog = view.propertyValue("PCL:AstrometricSolution:Catalog");
        let creator = view.propertyValue("PCL:AstrometricSolution:CreatorModule");
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
    console.writeln("  OBJCTRA/RA:  " + ((found.objctra.exists || found.ra.exists) ? "?" : "?"));
    console.writeln("  OBJCTDEC/DEC: " + ((found.objctdec.exists || found.dec.exists) ? "?" : "?"));
    console.writeln("  XPIXSZ:      " + (found.xpixsz.exists ? "?" : "?"));
    console.writeln("  FOCALLEN:    " + (found.focallen.exists ? "?" : "?"));

    console.writeln("\n" + "-".repeat(80));

    let hasCoordinates = (found.objctra.exists && found.objctdec.exists) || (found.ra.exists && found.dec.exists);
    let hasImageScale = found.xpixsz.exists && found.focallen.exists;

    if (hasCoordinates && hasImageScale) {
        console.writeln("DECISION: ImageSolver can work directly");
        console.writeln("-".repeat(80));
        console.writeln("\n? Image has sufficient FITS data");
        console.writeln("? Skipping ASTAP (not needed)\n");

        let solveSuccess = openImageSolver();

        if (solveSuccess) {
            return true;
        } else {
            console.writeln("\n??  WORKFLOW PAUSED");
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
            if (!hasCoordinates) console.writeln("  ? RA/Dec coordinates");
            if (!hasImageScale) console.writeln("  ? Image scale");
            console.writeln("\n??  ASTAP is disabled. Cannot proceed with plate solving.");
            console.writeln("Either enable ASTAP or manually add WCS keywords.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
        }

        console.writeln("DECISION: ASTAP needed");
        console.writeln("-".repeat(80));
        console.writeln("\nMissing data:");
        if (!hasCoordinates) console.writeln("  ? RA/Dec coordinates");
        if (!hasImageScale) console.writeln("  ? Image scale");
        console.writeln();

        if (!runASTAPWorkflow()) {
            console.criticalln("? ASTAP workflow failed");
            return false;
        }

        console.writeln("\n" + "=".repeat(80));
        console.writeln("? ASTAP COMPLETE");
        console.writeln("=".repeat(80));

        let solveSuccess = openImageSolver();

        if (solveSuccess) {
            return true;
        } else {
            console.writeln("\n??  WORKFLOW PAUSED");
            console.writeln("After ImageSolver completes, run this script again.\n");
            console.writeln("=".repeat(80) + "\n");
            return false;
            }
        }
    }

// ============================================================
// PART 2: WORKFLOW FUNCTIONS (SPFC + Previews + MGC)
// ============================================================

function runSPFC()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 1: Running SPFC (Dynamic XSPD Version)");
   console.writeln("=".repeat(80) + "\n");

   let win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");
   let view = win.currentView;
   if (view.isNull)
      return;

   // Pre-flight check: verify astrometric solution exists before attempting SPFC
   let hasPCL = view.propertyValue("PCL:AstrometricSolution:CreatorModule") != null;
   if (!hasPCL)
      throw new Error("No astrometric solution found - please run ImageSolver before running SPFC.");

   // Check if SPFC was already applied
   console.writeln("Checking processing history for SPFC...");

   var spfcAlreadyApplied = false;

   // Try to access processing history safely
   if (win.processingHistory && win.processingHistory.length > 0) {
      var history = win.processingHistory;
      for (var i = 0; i < history.length; i++) {
         if (history[i].indexOf("SpectroPhotometricFluxCalibration") >= 0) {
            spfcAlreadyApplied = true;
            break;
         }
      }
   }

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

   // Camera QE
   var qeCurve = getFilterData(cam.xspdName, "Q");
   if (!qeCurve)
      throw new Error("Camera QE curve not found: " + cam.xspdName);

   // Filter curves
   if (flt.type === "pan" || flt.type === "lum") {
      throw new Error("PAN/L filters cannot be used with standard RGB SPFC. " +
                       "Select an RGB or pre-combined filter set.");
   }

   var redData = getFilterData(flt.redName, "R");
   var greenData = getFilterData(flt.greenName, "G");
   var blueData = getFilterData(flt.blueName, "B");

   if (!redData) throw new Error("Red filter not found: " + flt.redName);
   if (!greenData) throw new Error("Green filter not found: " + flt.greenName);
   if (!blueData) throw new Error("Blue filter not found: " + flt.blueName);

   console.writeln("White ref:  " + wr.name + " (stored for SPCC use)");
   console.writeln("Camera QE:  " + cam.xspdName + " (" + qeCurve.length + " chars)");
   console.writeln("Red filter: " + flt.redName + " (" + redData.length + " chars)");
   console.writeln("Green:      " + flt.greenName + " (" + greenData.length + " chars)");
   console.writeln("Blue:       " + flt.blueName + " (" + blueData.length + " chars)");
   console.writeln("\nRunning SPFC on view: " + view.id + "\n");

   var P = new SpectrophotometricFluxCalibration;
   P.narrowbandMode = false;

   // Gray filter (standard)
   P.grayFilterTrCurve = "300,0,380,0,400,1,500,1,675,1,710,0,800,0";
   P.grayFilterName = "Astronomik UV-IR Block L-2";
   P.grayFilterWavelength = 656.3;
   P.grayFilterBandwidth = 3.0;

   // RGB filter curves from XSPD
   P.redFilterTrCurve = redData;
   P.redFilterName = flt.redName;
   P.greenFilterTrCurve = greenData;
   P.greenFilterName = flt.greenName;
   P.blueFilterTrCurve = blueData;
   P.blueFilterName = flt.blueName;

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
   P.psfType = SpectrophotometricFluxCalibration.prototype.PSFType_Auto;
   P.psfGrowth = 1.75;
   P.psfMaxStars = 24576;
   P.psfSearchTolerance = 4.0;
   P.psfChannelSearchTolerance = 2.0;
   P.generateGraphs = false;
   P.generateStarMaps = false;
   P.generateTextFiles = false;
   P.outputDirectory = "";

   if (!P.executeOn(view))
      throw new Error("SPFC execution failed.");

   console.writeln("SPFC completed successfully.\n");
}

// ============================================================
// STEP 2: Create Previews (variable count)
// ============================================================

function createPreviews(prefix)
{
   if (prefix === undefined) prefix = "BM_";

   var numPreviews = WorkflowParameters.numPreviews;

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 2: Creating " + numPreviews + " Preview(s)");
   console.writeln("=".repeat(80) + "\n");

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
      let id = (prefix === "BM_") ? (prefix + scale) : (i === 0 ? prefix : prefix + i);
      let pv = win.createPreview( rect, id );
      previews.push( pv );
      console.writeln( "Created preview: " + id );
   }

   // Zoom each preview to fit
   for ( let i = 0; i < previews.length; ++i )
   {
      win.currentView = previews[i];
      win.bringToFront();

      processEvents();
      processEvents();

      win.zoomToOptimalFit();

      processEvents();
      processEvents();

      console.writeln( "Zoomed preview: " + previews[i].id );
   }

   // Set first preview as active
   win.currentView = previews[0];
   win.bringToFront();
   win.zoomToOptimalFit();

   console.writeln( "Done. " + previews[0].id + " active.\n" );
}

// ============================================================
// STEP 3: MGC on Previews (variable count + per-preview scales)
// ============================================================

function runMGC(view, gradientScale, previewName)
{
   console.writeln("\n" + "-".repeat(80));
   console.writeln("Processing: " + previewName);
   console.writeln("Gradient Scale: " + gradientScale);
   console.writeln("-".repeat(80));

   var P = new MultiscaleGradientCorrection;
   P.useMARSDatabase = true;
   var marsFiles = resolveMARSFiles();
   if (!marsFiles) {
      console.warningln("No MARS database files found. MGC may fail.");
      P.useMARSDatabase = false;
   } else {
      P.marsDatabaseFiles = marsFiles;
   }
   P.grayMARSFilter = "L";
   P.redMARSFilter = "R";
   P.greenMARSFilter = "G";
   P.blueMARSFilter = "B";
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
   P.showGradientModel = true;
   P.command = "";

   if (!P.executeOn(view))
      throw new Error("MultiscaleGradientCorrection failed on " + previewName);

   console.writeln(previewName + " completed successfully.");
}

function runMGCOnPreviews()
{
   var numPreviews = WorkflowParameters.numPreviews;

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 3: MGC Multi-Preview Processor (" + numPreviews + " previews)");
   console.writeln("=".repeat(80) + "\n");

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

      runMGC(preview, scale, preview.id);
   }

   console.writeln("\n" + "=".repeat(80));
   console.writeln("ALL PREVIEWS PROCESSED SUCCESSFULLY");
   console.writeln("=".repeat(80));
   console.writeln("\nGradient scales applied:");
   for (var i = 0; i < numPreviews; i++)
      console.writeln("  " + previews[i].id + ": " + WorkflowParameters.getGradientScale(i));
   console.writeln("\n");
}

// ============================================================
// STEP 4: GradientCorrection on 2 Previews (fallback or manual)
// ============================================================

function runGC(view, highThreshold, highTolerance, previewName)
{
   console.writeln("\n" + "-".repeat(80));
   console.writeln("Processing: " + previewName);
   console.writeln("highThreshold: " + highThreshold + "  highTolerance: " + highTolerance);
   console.writeln("-".repeat(80));

   var P = new GradientCorrection;
   P.reference = 0.50;
   P.lowThreshold = 0.20;
   P.lowTolerance = 0.50;
   P.highThreshold = highThreshold;
   P.highTolerance = highTolerance;
   P.iterations = 15;
   P.scale = 5.00;
   P.smoothness = 0.40;
   P.downsamplingFactor = 16;
   P.protection = true;
   P.protectionThreshold = 0.10;
   P.protectionAmount = 0.50;
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

function runGCOnPreviews()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 4: GradientCorrection on Preview0 and Preview1");
   console.writeln("=".repeat(80) + "\n");

   var win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");

   var previews = win.previews;
   console.writeln("Found " + previews.length + " preview(s) in image: " + win.mainView.id + "\n");

   if (previews.length < 2)
      throw new Error("GradientCorrection requires at least 2 previews. Found only " + previews.length);

   // Preview0: highThreshold=0.05, highTolerance=0.00
   runGC(previews[0], 0.05, 0.00, previews[0].id);

   // Preview1: highThreshold=0.02, highTolerance=0.10
   runGC(previews[1], 0.02, 0.10, previews[1].id);

   console.writeln("\n" + "=".repeat(80));
   console.writeln("GC PREVIEWS PROCESSED SUCCESSFULLY");
   console.writeln("=".repeat(80));
   console.writeln("\nSettings applied:");
   console.writeln("  " + previews[0].id + ": highThreshold=0.05, highTolerance=0.00");
   console.writeln("  " + previews[1].id + ": highThreshold=0.02, highTolerance=0.10");
   if (previews.length >= 3)
      console.writeln("  " + previews[2].id + ": untouched (for manual use)");
   if (previews.length >= 4)
      console.writeln("  " + previews[3].id + ": untouched (for manual use)");
   console.writeln("\n");
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
   dbe.modelSampleFormat = DynamicBackgroundExtraction.prototype.f32;
   dbe.targetCorrection = DynamicBackgroundExtraction.prototype.Divide;
   dbe.normalize = true;
   dbe.discardModel = false;
   dbe.replaceTarget = false;
   dbe.correctedImageId = "";
   dbe.correctedImageSampleFormat = DynamicBackgroundExtraction.prototype.SameAsTarget;
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
   var view = targetWindow.currentView;
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
      P.interaction = ScreenTransferFunction.prototype.SeparateChannels;
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

      // Step 0: Equipment & workflow selection dialog
      selectEquipment();

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
      try {
      runSPFC();
	} catch (spfcError) {
      if (spfcError.message === "Script cancelled by user.") throw spfcError;
      console.warningln("\n\u26A0  SPFC failed: " + spfcError.message);
      console.writeln("Skipping MGC - falling back to GC...\n");
      spfcFailed = true;
      mgcFailed = true;
    }
    } else {
      console.writeln("SPFC is DISABLED - skipping\n");
    }
         if (WorkflowParameters.enablePreviews) {
         let previewPrefix = (WorkflowParameters.enableSPFC && !spfcFailed) ? "BM_" :
                             (WorkflowParameters.enableGC || spfcFailed) ? "GC" : "Preview";
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
         console.writeln("MGC is DISABLED - skipping\n");
      }

      // GC: manual mode or MGC fallback
      if (WorkflowParameters.enableGC || mgcFailed) {
         if (mgcFailed) {
            console.writeln("\n" + "=".repeat(80));
            console.writeln("MGC FALLBACK: Running GradientCorrection on first 2 previews");
            console.writeln("=".repeat(80) + "\n");
         }
         let win = ImageWindow.activeWindow;
         if (win.previews.length >= 2) {
            runGCOnPreviews();

            // Apply Adaptive Auto STF to GC gradient model images
            var gcModelNames = ["GC_gradient_model", "GC_gradient_model1"];
            for (var g = 0; g < gcModelNames.length; g++) {
               var modelWin = ImageWindow.windowById(gcModelNames[g]);
               if (!modelWin.isNull) {
                  console.writeln("Applying Adaptive Auto STF to " + gcModelNames[g] + "...");
                  applyAdaptiveAutoSTF(modelWin);
                  console.writeln("\u2714 " + gcModelNames[g] + " stretched.");
               }
            }
            // Bring main image back to front
            ImageWindow.activeWindow.bringToFront();
         } else {
            console.warningln("\u26A0  Not enough previews for GC. Need at least 2.\n");
         }
      } else if (!WorkflowParameters.enableMGC) {
         // GC not enabled and MGC not enabled - nothing to report
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
         console.writeln("Opening MultiscaleGradientCorrection tool...\n");
         var mgc = new MultiscaleGradientCorrection;
         mgc.useMARSDatabase = true;
         var marsFiles = resolveMARSFiles();
         if (marsFiles) {
            mgc.marsDatabaseFiles = marsFiles;
         }
         mgc.grayMARSFilter = "L";
         mgc.redMARSFilter = "R";
         mgc.greenMARSFilter = "G";
         mgc.blueMARSFilter = "B";
         mgc.referenceImageId = "";
         mgc.gradientScale = WorkflowParameters.getGradientScale(
            WorkflowParameters.numPreviews - 1 );
         mgc.structureSeparation = 3;
         mgc.modelSmoothness = 1.00;
         mgc.minFieldRatio = 0.017;
         mgc.maxFieldRatio = 0.167;
         mgc.enforceFieldLimits = true;
         mgc.scaleFactorRK = 1.0000;
         mgc.scaleFactorG = 1.0000;
         mgc.scaleFactorB = 1.0000;
         mgc.showGradientModel = true;
         mgc.command = "";
         mgc.launch();
      }

      if (WorkflowParameters.enableGC || mgcFailed) {
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