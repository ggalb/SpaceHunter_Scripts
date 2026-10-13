#engine v8
#feature-id SHLazyWorkflowPart2 : Space_Hunter > SH Lazy Workflow Part 2
#feature-icon  SH_WorkFlow2.svg
#feature-info Space Hunter Lazy Workflow Part 2 v2.3.2<br/>\
   <br/>\
   Automated Linear Image Processing workflow for OSC camera images.<br/>\
   <br/>\
   Includes: Equipment selection with collapsible sections, BlurXTerminator (correct only),<br/>\
   Tiled background finder (Exclude previews honoured) with pre-check and optional IFN/dust map, SPCC with auto-detected ROI,<br/>\
   AutoColor (Background Neutralization + Color Calibration, alternative to Background + SPCC),<br/>\
   BlurXTerminator full with adjustable parameters, Adaptive Auto STF (auto linked/unlinked),<br/>\
   StarXTerminator or StarNet2 for star removal, NoiseXTerminator or MLDenoise. New Instance support.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   AutoColor.js Copyright &copy; 2016 Hartmut V. Bornemann. Used with written permission.<br/>\
   See LICENSE file for details: https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE.

// ============================================================
// Space Hunter Lazy Workflow Part 2 v2.3.2
//
// Copyright (c) 2026 Georg G Albrecht. MIT License.
// See LICENSE file for details.
//
// Acknowledgments:
// - PixInsight platform by Pleiades Astrophoto (https://pixinsight.com/)
// - Adaptive Auto STF based on PixInsight's AutoSTF method by Juan Conejero (Pleiades Astrophoto);
//   own implementation with automatic linked/unlinked selection and sky-based statistics
// - Background finder concept inspired by FindBackground by
//   Gerrit Erdt and Franklin Marek (SetiAstro), licensed under CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
// - AutoColor.js by Hartmut V. Bornemann, Copyright 2016. Used with written permission. (https://www.skypixels.at/pixinsight_scripts.html)
//   Original copyright headers and author name preserved in source code as required.
//   NOT covered by MIT License. Separate permission required for reuse.
// - Standard PixInsight processes called: SpectrophotometricColorCalibration (SPCC),
//   BackgroundNeutralization, ColorCalibration
// - BlurXTerminator, StarXTerminator and NoiseXTerminator by Russell Croman (https://www.rc-astro.com/)
// - StarNet2 by Nikita Misiura (https://www.starnetastro.com/), astrophotography use only
// - IFN/dust map: IRSA Galactic Dust Reddening and Extinction service (NASA/IPAC,
//   https://irsa.ipac.caltech.edu/applications/DUST/), SFD map by Schlegel, Finkbeiner & Davis (1998)
// - Developed with assistance from Claude AI (Anthropic)
//
// v2.3.1: Documentation button opens the PixInsight manual
//       (Dialog.browseScriptDocumentation, ID-form #feature-id "SHLazyWorkflowPart2")
//       instead of SH_Workflow_Guide.pdf.
// v2.3.2: Documentation button passes the menu name "SH Lazy Workflow Part 2"
//       (PI looks up doc/scripts/SH Lazy Workflow Part 2/SH Lazy Workflow Part 2.html).
//
// Part 0: Process & Equipment selection dialog (SectionBar UI)
// Part 1: Run BlurXTerminator correct only
// Part 2: Find background: deterministic tiled robust finder (v2.3), Exclude* previews honoured,
//         preceded by a pre-check dialog (previews + optional IRSA dust map to avoid IFN)
// Part 3: Run SPCC with selected filter and extracted ROI
// Part 4: Run AutoColor - Background Neutralization + Color Calibration (alternative to Parts 2 & 3)
// Part 5: Run Adaptive Auto STF (auto linked/unlinked, Background-preview statistics)
// Part 6: Run BlurXTerminator full (adjustable parameters)
// Part 7: Run StarXTerminator (configurable options)
// Part 8: Run StarNet2 as an alternative to SXT (configurable options)
// Part 9: Open NoiseXTerminator in default settings
// ============================================================
//
// THIS SCRIPT IS FOR OSC CAMERA IMAGES ONLY
//
// Requirements:
// - Windows machine
// - PixInsight 1.9.4
// - OSC Camera Image
// - Image pre-cropped, solved and background extraction applied
// - BlurXTerminator, StarXTerminator and NoiseXTerminator needed for full process
// - AutoColor script by Hartmut V. Bornemann (optional)
// - StarNet2 script for PixInsight (optional)

CoreApplication.ensureMinimumVersion(1, 9, 5);

// ============================================================
// SCRIPT IDENTITY
// ============================================================

#define SCRIPT_NAME    "Space Hunter Lazy Workflow Part 2"
#define SCRIPT_VERSION "v2.3.2"
var SCRIPT_DIR = File.extractDrive(#__FILE__) + File.extractDirectory(#__FILE__);
// Dialog.browseScriptDocumentation() takes the MENU name (last part of the
// #feature-id menu path), not the ID, and opens doc/scripts/<name>/<name>.html.
// Tested in PI 2026-10-12. Keep in sync with #feature-id and the manual folder.
var DOC_NAME = "SH Lazy Workflow Part 2";
var SETTINGS_KEY_USERPREFS = "SpaceHunter2/UserPrefs";
// ============================================================
// FILE PATHS - Auto-detect (user-independent)
// ============================================================

var customFilterPath = File.homeDirectory + "/AppData/Roaming/Pleiades/filters-001-pxi.xspd";

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

var FILTERS_XSPD_PATH = null;
for (var i = 0; i < libraryPaths.length; i++) {
   if (File.exists(libraryPaths[i])) {
      FILTERS_XSPD_PATH = libraryPaths[i];
      break;
   }
}

var FILTERS_CUSTOM_PATH = File.exists(customFilterPath) ? customFilterPath : null;

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

var filterDB = {};
var whiteRefDB = {};

var whiteRefList = [];
var cameraList = [];
var filterList = [];   // RGB sets only (broadband / precombined); SPCC has no gray filter

// Index of the entry whose key field equals value, else -1.
function shIndexBy(list, field, value)
{
   for (var i = 0; i < list.length; i++)
      if (list[i][field] === value)
         return i;
   return -1;
}

// ============================================================
// WORKFLOW PARAMETERS (save/load for New Instance)
// ============================================================

var WorkflowParameters = {
   // Section enable states
   enableBXTCorrect: true,
   enableBackground: true,
   enableSPCC:       true,
   enableAutoSTF:    true,
   enableBXTFull:    true,
   enableSXT:        true,
   enableNXT:        true,
   enableMLDenoise:  false,
   mldModelPath:     "",

   // AutoColor
   enableAutoColor: false,

   // Background finder: Exclude* previews are always honoured (v2.3).
   // enableBgPrecheck = show the pre-check dialog before processing starts.
   enableBgPrecheck: true,

   // SPCC equipment selection
   selectedWhiteRefIdx: 0,
   selectedCameraIdx:   -1, // set to Ideal QE curve at startup
   selectedFilterIdx:   0,
   // Saved by name: the lists are rebuilt from the XSPD files each run, so a
   // saved index could point to a different entry.
   selectedWhiteRefName: "",
   selectedCameraName:   "",
   selectedFilterLabel:  "",

   // SPCC Narrowband
   enableNarrowband:    false,
   nbRedWavelength:     656.30,
   nbRedBandwidth:      3.00,
   nbGreenWavelength:   500.70,
   nbGreenBandwidth:    3.00,
   nbBlueWavelength:    500.70,
   nbBlueBandwidth:     3.00,

   // SPCC graphs
   generateSPCCGraphs:  false,

   // BXT Full parameters
   bxtSharpenStars:       0.25,
   bxtAdjustHalos:        0.00,
   bxtAutoPSF:            true,
   bxtPSFDiameter:        0.00,
   bxtSharpenNonstellar:  0.90,
   bxtTileOverlap:        0.00,
   bxtMlVersion:          0,
   // BXT Correct Only model and tile overlap (separate from BXT Full since v2.3)
   bxtCorrectMlVersion:   0,
   bxtCorrectTileOverlap: 0.00,

   // SXT parameters
   sxtGenerateStars: true,
   sxtUnscreen:      false,
   sxtTileOverlap:   0.20,
   sxtMlVersion:     0,

   // NXT parameters
   nxtTileOverlap:   0.20,
   nxtMlVersion:     0,
   
   // StarNet2 parameters
   enableStarNet2:   false,
   sn2Stride:        256,
   sn2Mask:          true,
   sn2Upsample:      false,
   sn2Linear:        true,

   save: function()
   {
      Parameters.set("enableAutoColor",  this.enableAutoColor);
      Parameters.set("enableBXTCorrect", this.enableBXTCorrect);
      Parameters.set("enableBackground", this.enableBackground);
      Parameters.set("enableSPCC",       this.enableSPCC);
      Parameters.set("enableAutoSTF",    this.enableAutoSTF);
      Parameters.set("enableBXTFull",    this.enableBXTFull);
      Parameters.set("enableSXT",        this.enableSXT);
      Parameters.set("enableBgPrecheck", this.enableBgPrecheck);

      this.syncNames();
      Parameters.set("selectedWhiteRefName", this.selectedWhiteRefName);
      Parameters.set("selectedCameraName",   this.selectedCameraName);
      Parameters.set("selectedFilterLabel",  this.selectedFilterLabel);

      Parameters.set("enableNarrowband",  this.enableNarrowband);
      Parameters.set("nbRedWavelength",   this.nbRedWavelength);
      Parameters.set("nbRedBandwidth",    this.nbRedBandwidth);
      Parameters.set("nbGreenWavelength", this.nbGreenWavelength);
      Parameters.set("nbGreenBandwidth",  this.nbGreenBandwidth);
      Parameters.set("nbBlueWavelength",  this.nbBlueWavelength);
      Parameters.set("nbBlueBandwidth",   this.nbBlueBandwidth);

      Parameters.set("generateSPCCGraphs", this.generateSPCCGraphs);

      Parameters.set("bxtSharpenStars",      this.bxtSharpenStars);
      Parameters.set("bxtAdjustHalos",       this.bxtAdjustHalos);
      Parameters.set("bxtAutoPSF",           this.bxtAutoPSF);
      Parameters.set("bxtPSFDiameter",       this.bxtPSFDiameter);
      Parameters.set("bxtSharpenNonstellar", this.bxtSharpenNonstellar);

      Parameters.set("bxtTileOverlap",    this.bxtTileOverlap);
      Parameters.set("bxtMlVersion",     this.bxtMlVersion);
      Parameters.set("bxtCorrectMlVersion", this.bxtCorrectMlVersion);
      Parameters.set("bxtCorrectTileOverlap", this.bxtCorrectTileOverlap);
      Parameters.set("sxtGenerateStars", this.sxtGenerateStars);
      Parameters.set("sxtUnscreen",      this.sxtUnscreen);
      Parameters.set("sxtTileOverlap",   this.sxtTileOverlap);
      Parameters.set("sxtMlVersion",     this.sxtMlVersion);
      Parameters.set("nxtTileOverlap",   this.nxtTileOverlap);
      Parameters.set("nxtMlVersion",     this.nxtMlVersion);
	  
	  Parameters.set("enableNXT",        this.enableNXT);
      Parameters.set("enableMLDenoise",  this.enableMLDenoise);
      Parameters.set("mldModelPath",     this.mldModelPath);
      Parameters.set("enableStarNet2",   this.enableStarNet2);
      Parameters.set("sn2Stride",      this.sn2Stride);
      Parameters.set("sn2Mask",        this.sn2Mask);
      Parameters.set("sn2Upsample",    this.sn2Upsample);
      Parameters.set("sn2Linear",      this.sn2Linear);
   },

   load: function()
   {
      if (Parameters.has("enableAutoColor"))
         this.enableAutoColor = Parameters.getBoolean("enableAutoColor");
      if (Parameters.has("enableBXTCorrect"))
         this.enableBXTCorrect = Parameters.getBoolean("enableBXTCorrect");
      if (Parameters.has("enableBackground"))
         this.enableBackground = Parameters.getBoolean("enableBackground");
      if (Parameters.has("enableSPCC"))
         this.enableSPCC = Parameters.getBoolean("enableSPCC");
      if (Parameters.has("enableAutoSTF"))
         this.enableAutoSTF = Parameters.getBoolean("enableAutoSTF");
      if (Parameters.has("enableBXTFull"))
         this.enableBXTFull = Parameters.getBoolean("enableBXTFull");
      if (Parameters.has("enableSXT"))
         this.enableSXT = Parameters.getBoolean("enableSXT");
      if (Parameters.has("enableBgPrecheck"))
         this.enableBgPrecheck = Parameters.getBoolean("enableBgPrecheck");

      if (Parameters.has("selectedWhiteRefName"))
         this.selectedWhiteRefName = Parameters.getString("selectedWhiteRefName");
      if (Parameters.has("selectedCameraName"))
         this.selectedCameraName = Parameters.getString("selectedCameraName");
      if (Parameters.has("selectedFilterLabel"))
         this.selectedFilterLabel = Parameters.getString("selectedFilterLabel");

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

      if (Parameters.has("generateSPCCGraphs"))
         this.generateSPCCGraphs = Parameters.getBoolean("generateSPCCGraphs");

      if (Parameters.has("bxtSharpenStars"))
         this.bxtSharpenStars = Parameters.getReal("bxtSharpenStars");
      if (Parameters.has("bxtAdjustHalos"))
         this.bxtAdjustHalos = Parameters.getReal("bxtAdjustHalos");
      if (Parameters.has("bxtAutoPSF"))
         this.bxtAutoPSF = Parameters.getBoolean("bxtAutoPSF");
      if (Parameters.has("bxtPSFDiameter"))
         this.bxtPSFDiameter = Parameters.getReal("bxtPSFDiameter");
      if (Parameters.has("bxtSharpenNonstellar"))
         this.bxtSharpenNonstellar = Parameters.getReal("bxtSharpenNonstellar");

      if (Parameters.has("bxtTileOverlap"))
         this.bxtTileOverlap = Parameters.getReal("bxtTileOverlap");
      if (Parameters.has("bxtMlVersion"))
         this.bxtMlVersion = Parameters.getInteger("bxtMlVersion");
      // Instances saved before v2.3 have one shared model: use it for Correct Only too
      if (Parameters.has("bxtCorrectMlVersion"))
         this.bxtCorrectMlVersion = Parameters.getInteger("bxtCorrectMlVersion");
      else if (Parameters.has("bxtMlVersion"))
         this.bxtCorrectMlVersion = this.bxtMlVersion;
      // Same for tile overlap: older instances have one shared value
      if (Parameters.has("bxtCorrectTileOverlap"))
         this.bxtCorrectTileOverlap = Parameters.getReal("bxtCorrectTileOverlap");
      else if (Parameters.has("bxtTileOverlap"))
         this.bxtCorrectTileOverlap = this.bxtTileOverlap;
      if (Parameters.has("sxtGenerateStars"))
         this.sxtGenerateStars = Parameters.getBoolean("sxtGenerateStars");
      if (Parameters.has("sxtUnscreen"))
         this.sxtUnscreen = Parameters.getBoolean("sxtUnscreen");
      if (Parameters.has("sxtTileOverlap"))
         this.sxtTileOverlap = Parameters.getReal("sxtTileOverlap");
      if (Parameters.has("sxtMlVersion"))
         this.sxtMlVersion = Parameters.getInteger("sxtMlVersion");
      if (Parameters.has("nxtTileOverlap"))
         this.nxtTileOverlap = Parameters.getReal("nxtTileOverlap");
      if (Parameters.has("nxtMlVersion"))
         this.nxtMlVersion = Parameters.getInteger("nxtMlVersion");
	 
	  if (Parameters.has("enableNXT"))
         this.enableNXT = Parameters.getBoolean("enableNXT");
      if (Parameters.has("enableMLDenoise"))
         this.enableMLDenoise = Parameters.getBoolean("enableMLDenoise");
      if (Parameters.has("mldModelPath"))
         this.mldModelPath = Parameters.getString("mldModelPath");
      if (Parameters.has("enableStarNet2"))
         this.enableStarNet2 = Parameters.getBoolean("enableStarNet2");
      if (Parameters.has("sn2Stride"))
         this.sn2Stride = Parameters.getInteger("sn2Stride");
      if (Parameters.has("sn2Mask"))
         this.sn2Mask = Parameters.getBoolean("sn2Mask");
      if (Parameters.has("sn2Upsample"))
         this.sn2Upsample = Parameters.getBoolean("sn2Upsample");
      if (Parameters.has("sn2Linear"))
         this.sn2Linear = Parameters.getBoolean("sn2Linear");
   },

   saveUserPrefs: function()
   {
      this.syncNames();
      var prefs = {
         enableAutoColor:      this.enableAutoColor,
         enableBXTCorrect:     this.enableBXTCorrect,
         enableBackground:     this.enableBackground,
         enableSPCC:           this.enableSPCC,
         enableAutoSTF:        this.enableAutoSTF,
         enableBXTFull:        this.enableBXTFull,
         enableSXT:            this.enableSXT,
         enableNXT:            this.enableNXT,
         enableMLDenoise:      this.enableMLDenoise,
         mldModelPath:         this.mldModelPath,
         enableStarNet2:       this.enableStarNet2,
         enableBgPrecheck:     this.enableBgPrecheck,
         selectedWhiteRefName: this.selectedWhiteRefName,
         selectedCameraName:   this.selectedCameraName,
         selectedFilterLabel:  this.selectedFilterLabel,
         enableNarrowband:     this.enableNarrowband,
         nbRedWavelength:      this.nbRedWavelength,
         nbRedBandwidth:       this.nbRedBandwidth,
         nbGreenWavelength:    this.nbGreenWavelength,
         nbGreenBandwidth:     this.nbGreenBandwidth,
         nbBlueWavelength:     this.nbBlueWavelength,
         nbBlueBandwidth:      this.nbBlueBandwidth,
         generateSPCCGraphs:   this.generateSPCCGraphs,
         bxtSharpenStars:      this.bxtSharpenStars,
         bxtAdjustHalos:       this.bxtAdjustHalos,
         bxtAutoPSF:           this.bxtAutoPSF,
         bxtPSFDiameter:       this.bxtPSFDiameter,
         bxtSharpenNonstellar: this.bxtSharpenNonstellar,
         bxtTileOverlap:       this.bxtTileOverlap,
         bxtMlVersion:         this.bxtMlVersion,
         bxtCorrectMlVersion:  this.bxtCorrectMlVersion,
         bxtCorrectTileOverlap: this.bxtCorrectTileOverlap,
         sxtGenerateStars:     this.sxtGenerateStars,
         sxtUnscreen:          this.sxtUnscreen,
         sxtTileOverlap:       this.sxtTileOverlap,
         sxtMlVersion:         this.sxtMlVersion,
         nxtTileOverlap:       this.nxtTileOverlap,
         nxtMlVersion:         this.nxtMlVersion,
         sn2Stride:            this.sn2Stride,
         sn2Mask:              this.sn2Mask,
         sn2Upsample:          this.sn2Upsample,
         sn2Linear:            this.sn2Linear
      };
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType.String, JSON.stringify(prefs));
      } catch (e) {}
   },

   loadUserPrefs: function()
   {
      try {
         var saved = Settings.read(SETTINGS_KEY_USERPREFS, DataType.String);
         if (saved) {
            var prefs = JSON.parse(saved);
            if (prefs.enableAutoColor      !== undefined) this.enableAutoColor      = prefs.enableAutoColor;
            if (prefs.enableBXTCorrect     !== undefined) this.enableBXTCorrect     = prefs.enableBXTCorrect;
            if (prefs.enableBackground     !== undefined) this.enableBackground     = prefs.enableBackground;
            if (prefs.enableSPCC           !== undefined) this.enableSPCC           = prefs.enableSPCC;
            if (prefs.enableAutoSTF        !== undefined) this.enableAutoSTF        = prefs.enableAutoSTF;
            if (prefs.enableBXTFull        !== undefined) this.enableBXTFull        = prefs.enableBXTFull;
            if (prefs.enableSXT            !== undefined) this.enableSXT            = prefs.enableSXT;
            if (prefs.enableNXT            !== undefined) this.enableNXT            = prefs.enableNXT;
            if (prefs.enableMLDenoise      !== undefined) this.enableMLDenoise      = prefs.enableMLDenoise;
            if (prefs.mldModelPath         !== undefined) this.mldModelPath         = prefs.mldModelPath;
            if (prefs.enableStarNet2       !== undefined) this.enableStarNet2       = prefs.enableStarNet2;
            if (prefs.enableBgPrecheck     !== undefined) this.enableBgPrecheck     = prefs.enableBgPrecheck;
            // Older prefs hold indices: white ref and camera are kept if still valid;
            // the filter index referred to the old mixed list and is ignored.
            if (prefs.selectedWhiteRefIdx  !== undefined) this.selectedWhiteRefIdx  = prefs.selectedWhiteRefIdx;
            if (prefs.selectedCameraIdx    !== undefined) this.selectedCameraIdx    = prefs.selectedCameraIdx;
            if (prefs.selectedWhiteRefName !== undefined) this.selectedWhiteRefName = prefs.selectedWhiteRefName;
            if (prefs.selectedCameraName   !== undefined) this.selectedCameraName   = prefs.selectedCameraName;
            if (prefs.selectedFilterLabel  !== undefined) this.selectedFilterLabel  = prefs.selectedFilterLabel;
            if (prefs.enableNarrowband     !== undefined) this.enableNarrowband     = prefs.enableNarrowband;
            if (prefs.nbRedWavelength      !== undefined) this.nbRedWavelength      = prefs.nbRedWavelength;
            if (prefs.nbRedBandwidth       !== undefined) this.nbRedBandwidth       = prefs.nbRedBandwidth;
            if (prefs.nbGreenWavelength    !== undefined) this.nbGreenWavelength    = prefs.nbGreenWavelength;
            if (prefs.nbGreenBandwidth     !== undefined) this.nbGreenBandwidth     = prefs.nbGreenBandwidth;
            if (prefs.nbBlueWavelength     !== undefined) this.nbBlueWavelength     = prefs.nbBlueWavelength;
            if (prefs.nbBlueBandwidth      !== undefined) this.nbBlueBandwidth      = prefs.nbBlueBandwidth;
            if (prefs.generateSPCCGraphs   !== undefined) this.generateSPCCGraphs   = prefs.generateSPCCGraphs;
            if (prefs.bxtSharpenStars      !== undefined) this.bxtSharpenStars      = prefs.bxtSharpenStars;
            if (prefs.bxtAdjustHalos       !== undefined) this.bxtAdjustHalos       = prefs.bxtAdjustHalos;
            if (prefs.bxtAutoPSF           !== undefined) this.bxtAutoPSF           = prefs.bxtAutoPSF;
            if (prefs.bxtPSFDiameter       !== undefined) this.bxtPSFDiameter       = prefs.bxtPSFDiameter;
            if (prefs.bxtSharpenNonstellar !== undefined) this.bxtSharpenNonstellar = prefs.bxtSharpenNonstellar;
            if (prefs.bxtTileOverlap       !== undefined) this.bxtTileOverlap       = prefs.bxtTileOverlap;
            if (prefs.bxtMlVersion         !== undefined) this.bxtMlVersion         = prefs.bxtMlVersion;
            // Prefs saved before v2.3 have one shared model: start Correct Only from it
            if (prefs.bxtCorrectMlVersion  !== undefined) this.bxtCorrectMlVersion  = prefs.bxtCorrectMlVersion;
            else if (prefs.bxtMlVersion    !== undefined) this.bxtCorrectMlVersion  = prefs.bxtMlVersion;
            if (prefs.bxtCorrectTileOverlap !== undefined) this.bxtCorrectTileOverlap = prefs.bxtCorrectTileOverlap;
            else if (prefs.bxtTileOverlap  !== undefined) this.bxtCorrectTileOverlap = prefs.bxtTileOverlap;
            if (prefs.sxtGenerateStars     !== undefined) this.sxtGenerateStars     = prefs.sxtGenerateStars;
            if (prefs.sxtUnscreen          !== undefined) this.sxtUnscreen          = prefs.sxtUnscreen;
            if (prefs.sxtTileOverlap       !== undefined) this.sxtTileOverlap       = prefs.sxtTileOverlap;
            if (prefs.sxtMlVersion         !== undefined) this.sxtMlVersion         = prefs.sxtMlVersion;
            if (prefs.nxtTileOverlap       !== undefined) this.nxtTileOverlap       = prefs.nxtTileOverlap;
            if (prefs.nxtMlVersion         !== undefined) this.nxtMlVersion         = prefs.nxtMlVersion;
            if (prefs.sn2Stride            !== undefined) this.sn2Stride            = prefs.sn2Stride;
            if (prefs.sn2Mask              !== undefined) this.sn2Mask              = prefs.sn2Mask;
            if (prefs.sn2Upsample          !== undefined) this.sn2Upsample          = prefs.sn2Upsample;
            if (prefs.sn2Linear            !== undefined) this.sn2Linear            = prefs.sn2Linear;
         }
      } catch (e) {}
   },

   resetUserPrefs: function()
   {
      var spiralIdx = 0;
      for (var i = 0; i < whiteRefList.length; i++) {
         if (whiteRefList[i].name === "Average Spiral Galaxy") { spiralIdx = i; break; }
      }
      this.selectedWhiteRefIdx  = spiralIdx;
      this.selectedCameraIdx    = -1;
      this.selectedFilterIdx    = 0;
      this.selectedWhiteRefName = "";
      this.selectedCameraName   = "";
      this.selectedFilterLabel  = "";
      this.resolveSelection();
      this.enableNarrowband     = false;
      this.nbRedWavelength      = 656.30;
      this.nbRedBandwidth       = 3.00;
      this.nbGreenWavelength    = 500.70;
      this.nbGreenBandwidth     = 3.00;
      this.nbBlueWavelength     = 500.70;
      this.nbBlueBandwidth      = 3.00;
      this.generateSPCCGraphs   = false;
      this.bxtSharpenStars      = 0.25;
      this.bxtAdjustHalos       = 0.00;
      this.bxtAutoPSF           = true;
      this.bxtPSFDiameter       = 0.00;
      this.bxtSharpenNonstellar = 0.90;      
      this.bxtTileOverlap       = 0.00;
      this.bxtMlVersion         = 0;
      this.bxtCorrectMlVersion  = 0;
      this.bxtCorrectTileOverlap = 0.00;
      this.sxtGenerateStars     = true;
      this.sxtUnscreen          = false;
      this.sxtTileOverlap       = 0.20;
      this.sxtMlVersion         = 0;
      this.nxtTileOverlap       = 0.20;
      this.nxtMlVersion         = 0;
      this.mldModelPath         = "";
      this.sn2Stride            = 256;
      this.sn2Mask              = true;
      this.sn2Upsample          = false;
      this.sn2Linear            = true;
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType.String, JSON.stringify({
            enableAutoColor:      this.enableAutoColor,
            enableBXTCorrect:     this.enableBXTCorrect,
            enableBackground:     this.enableBackground,
            enableSPCC:           this.enableSPCC,
            enableAutoSTF:        this.enableAutoSTF,
            enableBXTFull:        this.enableBXTFull,
            enableSXT:            this.enableSXT,
            enableNXT:            this.enableNXT,
            enableMLDenoise:      this.enableMLDenoise,
            mldModelPath:         this.mldModelPath,
            enableStarNet2:       this.enableStarNet2,
            enableBgPrecheck:     this.enableBgPrecheck,
            selectedWhiteRefName: whiteRefList[this.selectedWhiteRefIdx] ? whiteRefList[this.selectedWhiteRefIdx].name : "",
            selectedCameraName:   cameraList[this.selectedCameraIdx] ? cameraList[this.selectedCameraIdx].xspdName : "",
            selectedFilterLabel:  filterList[this.selectedFilterIdx] ? filterList[this.selectedFilterIdx].label : "",
            bxtSharpenStars:      this.bxtSharpenStars,
            bxtAdjustHalos:       this.bxtAdjustHalos,
            bxtAutoPSF:           this.bxtAutoPSF,
            bxtPSFDiameter:       this.bxtPSFDiameter,
            bxtSharpenNonstellar: this.bxtSharpenNonstellar,
            bxtTileOverlap:       this.bxtTileOverlap,
            bxtMlVersion:         this.bxtMlVersion,
            bxtCorrectMlVersion:  this.bxtCorrectMlVersion,
            bxtCorrectTileOverlap: this.bxtCorrectTileOverlap,
            sxtGenerateStars:     this.sxtGenerateStars,
            sxtUnscreen:          this.sxtUnscreen,
            sxtTileOverlap:       this.sxtTileOverlap,
            sxtMlVersion:         this.sxtMlVersion,
            nxtTileOverlap:       this.nxtTileOverlap,
            nxtMlVersion:         this.nxtMlVersion,
            sn2Stride:            this.sn2Stride,
            sn2Mask:              this.sn2Mask,
            sn2Upsample:          this.sn2Upsample,
            sn2Linear:            this.sn2Linear
         }));
      } catch (e) {}
   },

   // Indices -> names (called before saving)
   syncNames: function()
   {
      if (whiteRefList[this.selectedWhiteRefIdx]) this.selectedWhiteRefName = whiteRefList[this.selectedWhiteRefIdx].name;
      if (cameraList[this.selectedCameraIdx])     this.selectedCameraName   = cameraList[this.selectedCameraIdx].xspdName;
      if (filterList[this.selectedFilterIdx])     this.selectedFilterLabel  = filterList[this.selectedFilterIdx].label;
   },

   // Names -> indices. Call after the lists are built and prefs/instance loaded.
   resolveSelection: function()
   {
      var idx = shIndexBy(whiteRefList, "name", this.selectedWhiteRefName);
      if (idx >= 0) this.selectedWhiteRefIdx = idx;
      else if (!(this.selectedWhiteRefIdx >= 0 && this.selectedWhiteRefIdx < whiteRefList.length)) {
         idx = shIndexBy(whiteRefList, "name", "Average Spiral Galaxy");
         this.selectedWhiteRefIdx = idx >= 0 ? idx : 0;
      }
      idx = shIndexBy(cameraList, "xspdName", this.selectedCameraName);
      if (idx >= 0) this.selectedCameraIdx = idx;
      else if (!(this.selectedCameraIdx >= 0 && this.selectedCameraIdx < cameraList.length)) {
         this.selectedCameraIdx = 0;
         for (var i = 0; i < cameraList.length; i++)
            if (cameraList[i].label.indexOf("Ideal") >= 0) { this.selectedCameraIdx = i; break; }
      }
      idx = shIndexBy(filterList, "label", this.selectedFilterLabel);
      this.selectedFilterIdx = idx >= 0 ? idx : 0;
   }
};

// ============================================================
// XSPD PARSERS (identical to Part 1)
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

      if (rName.indexOf("Sony CMOS R-UVIRcut") === 0) {
         gName = rName.replace("Sony CMOS R-UVIRcut", "Sony CMOS G-UVIRcut");
         bName = rName.replace("Sony CMOS R-UVIRcut", "Sony CMOS B-UVIRcut");
         var slashIdx = rName.indexOf(" / ");
         groupLabel = slashIdx >= 0 ? "Sony CMOS / " + rName.substring(slashIdx + 3) : rName;
      }
      else if (rName.indexOf("Canon Full Spectrum R") === 0) {
         gName = rName.replace("Canon Full Spectrum R", "Canon Full Spectrum G");
         bName = rName.replace("Canon Full Spectrum R", "Canon Full Spectrum B");
         var slashIdx = rName.indexOf(" / ");
         groupLabel = slashIdx >= 0 ? "Canon FS / " + rName.substring(slashIdx + 3) : "Canon Full Spectrum";
      }
      else if (rName.indexOf("Sony Color Sensor R") === 0) {
         gName = rName.replace("Sony Color Sensor R", "Sony Color Sensor G");
         bName = rName.replace("Sony Color Sensor R", "Sony Color Sensor B");
         var suffix = rName.substring("Sony Color Sensor R".length);
         groupLabel = "Sony Color Sensor" + (suffix ? " " + suffix.replace(/^-/, "") : "");
      }
      else if (rName.match(/-R$/)) {
         gName = rName.replace(/-R$/, "-G");
         bName = rName.replace(/-R$/, "-B");
         groupLabel = rName.replace(/-R$/, "");
      }
      else if (rName.match(/ R$/)) {
         gName = rName.replace(/ R$/, " G");
         bName = rName.replace(/ R$/, " B");
         groupLabel = rName.replace(/ R$/, "");
         if (!gEntries[gName] && gEntries[rName.replace(/ R$/, " V")])
            gName = rName.replace(/ R$/, " V");
      }
      else {
         console.writeln("  WARNING: Cannot group R entry: " + rName);
         continue;
      }

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

   // PAN / L entries are single curves: SPCC needs R/G/B, so they are not listed.
   // Sort: broadband first, then precombined, alphabetical within each.
   filterList.sort(function(a, b) {
      var typeOrder = { broadband: 0, precombined: 1 };
      var ta = typeOrder[a.type], tb = typeOrder[b.type];
      if (ta !== tb) return ta - tb;
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   console.writeln("  Filter sets found: " + filterList.length);
   console.writeln("");
}

// ============================================================
// DIALOG CONSTRUCTOR
// ============================================================

var SpaceHunterDialog2 = class extends Dialog
{
   constructor()
   {
   super();

   var dlg = this;

   let labelWidth = this.font.width( "Sharpen Nonstellar:" + "MMMMM" );

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
      "BXT correct-only, Background, SPCC or AutoColor, Adaptive Auto STF, BXT Full, SXT or StarNet2, NXT or MLDenoise for OSC camera images.<br/>" +
      "Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>" +
	  "AutoColor.js script Copyright &copy; 2016 Hartmut V. Bornemann. Used with written permission.</p>"

   // -----------------------------------------------------------------
   // Toggle section handler
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
   // Dependency logic
   // -----------------------------------------------------------------

   this.updateDependencies = function()
   {
      // SPCC -> auto-enable Background + Adaptive Auto STF (only when AutoColor is off)
      if ( WorkflowParameters.enableSPCC && !WorkflowParameters.enableAutoColor )
      {
         if ( !WorkflowParameters.enableBackground )
         {
            WorkflowParameters.enableBackground = true;
            dlg.background_Section.checkBox.checked = true;
            dlg.background_Control.enabled = true;
         }
         if ( !WorkflowParameters.enableAutoSTF )
         {
            WorkflowParameters.enableAutoSTF = true;
            dlg.autoSTF_Section.checkBox.checked = true;
            dlg.autoSTF_Control.enabled = true;
         }
      }

      // BXT Full: PSF Diameter active only when Auto PSF is unchecked
      dlg.bxtPSFDiameter_Control.enabled = !WorkflowParameters.bxtAutoPSF && WorkflowParameters.enableBXTFull;
   };

   // =================================================================
   // SECTION 1: BXT Correct Only
   // =================================================================

   // ML version value arrays (shared between Correct Only and Full sections)
   var bxtMlValues = [0, 5, 4, 2];

   // BXT Correct Only ML Version dropdown (own setting, independent of BXT Full since v2.3)
   this.bxtCorrectMlVersion_Label = new Label( this );
   this.bxtCorrectMlVersion_Label.text = "ML Version:";
   this.bxtCorrectMlVersion_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.bxtCorrectMlVersion_Label.setFixedWidth( labelWidth );

   this.bxtCorrectMlVersion_ComboBox = new ComboBox( this );
   this.bxtCorrectMlVersion_ComboBox.addItem( "Latest (ML 5)" );
   this.bxtCorrectMlVersion_ComboBox.addItem( "ML 5" );
   this.bxtCorrectMlVersion_ComboBox.addItem( "ML 4" );
   this.bxtCorrectMlVersion_ComboBox.addItem( "ML 2" );
   var bxtCorrectMlIdx = bxtMlValues.indexOf( WorkflowParameters.bxtCorrectMlVersion );
   this.bxtCorrectMlVersion_ComboBox.currentItem = bxtCorrectMlIdx >= 0 ? bxtCorrectMlIdx : 0;
   this.bxtCorrectMlVersion_ComboBox.toolTip = "<p>Select BXT machine learning model version for the " +
      "Correct Only run (independent of BXT Full).<br/>" +
      "Latest uses the newest downloaded model.</p>";
   this.bxtCorrectMlVersion_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.bxtCorrectMlVersion = bxtMlValues[index];
      WorkflowParameters.saveUserPrefs();
   };

   this.bxtCorrectMlVersion_Sizer = new HorizontalSizer;
   this.bxtCorrectMlVersion_Sizer.spacing = 4;
   this.bxtCorrectMlVersion_Sizer.add( this.bxtCorrectMlVersion_Label );
   this.bxtCorrectMlVersion_Sizer.add( this.bxtCorrectMlVersion_ComboBox );
   this.bxtCorrectMlVersion_Sizer.addStretch();

   // BXT Correct Only Tile Overlap slider (own value, independent of BXT Full since v2.3)
   this.bxtCorrectTileOverlap_Control = new NumericControl( this );
   this.bxtCorrectTileOverlap_Control.label.text = "Tile Overlap:";
   this.bxtCorrectTileOverlap_Control.label.setFixedWidth( labelWidth );
   this.bxtCorrectTileOverlap_Control.setRange( 0, 0.50 );
   this.bxtCorrectTileOverlap_Control.setPrecision( 2 );
   this.bxtCorrectTileOverlap_Control.slider.setRange( 0, 500 );
   this.bxtCorrectTileOverlap_Control.setValue( WorkflowParameters.bxtCorrectTileOverlap );
   this.bxtCorrectTileOverlap_Control.toolTip = "<p>Tile overlap for BXT processing (0.00–0.50).<br/>" +
      "Higher values improve seam blending at the cost of speed.</p>";
   this.bxtCorrectTileOverlap_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtCorrectTileOverlap = value;
      WorkflowParameters.saveUserPrefs();
   };
   this.bxtCorrect_Control = new Control( this );
   this.bxtCorrect_Control.sizer = new VerticalSizer;
   this.bxtCorrect_Control.sizer.margin = 6;
   this.bxtCorrect_Control.sizer.spacing = 4;
   this.bxtCorrect_Control.sizer.add( this.bxtCorrectMlVersion_Sizer );
   this.bxtCorrect_Control.sizer.add( this.bxtCorrectTileOverlap_Control );

   this.bxtCorrect_Section = new SectionBar( this, "BlurXTerminator (Correct Only)" );
   this.bxtCorrect_Section.toolTip = "<p><b>Download ML Models</b>, <b>Compute Device</b> and <b>Find Fastest</b> " +
      "must be configured in the original BXT tool first.</p>";
   this.bxtCorrect_Section.setSection( this.bxtCorrect_Control );
   this.bxtCorrect_Section.enableCheckBox( true );
   this.bxtCorrect_Section.checkBox.checked = WorkflowParameters.enableBXTCorrect;
   this.bxtCorrect_Section.checkBox.toolTip = "<p>Run BlurXTerminator in correct-only mode to fix optical aberrations.</p>";

   this.bxtCorrect_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableBXTCorrect = sectionbar.checkBox.checked;
      dlg.bxtCorrect_Control.enabled = WorkflowParameters.enableBXTCorrect;
      WorkflowParameters.saveUserPrefs();
   };
   this.bxtCorrect_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 2: Background Finder
   // =================================================================

   this.background_Control = new Control( this );
   this.background_Control.sizer = new VerticalSizer;
   this.background_Control.sizer.margin = 6;

   this.exclusionZones_CheckBox = new CheckBox( this.background_Control );
   this.exclusionZones_CheckBox.text = "Show background pre-check before processing";
   this.exclusionZones_CheckBox.checked = WorkflowParameters.enableBgPrecheck;
   this.exclusionZones_CheckBox.toolTip =
      "<p>The background finder avoids dark nebulae on its own. Faint IFN / cirrus may still " +
      "need an exclusion zone: create a preview over that area and rename it to start with " +
      "<b>Exclude</b> (e.g. Exclude1, Exclude2). Exclude previews are always honoured.</p>" +
      "<p>When checked, a pre-check window opens before anything is processed if no Exclude " +
      "preview exists, or if other previews are left over (e.g. from Part 1 MGC). It lists the " +
      "previews and can query an online dust map (IRSA) to show where IFN is likely.</p>" +
      "<p>All previews are removed after the background search completes.</p>";
   this.exclusionZones_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableBgPrecheck = checked;
      WorkflowParameters.saveUserPrefs();
   };
   this.exclusionWarning_Icon = new ToolButton( this.background_Control );
   var warningIconPath = SCRIPT_DIR + "/SH_WarningSign.png";
   if (File.exists(warningIconPath))
      this.exclusionWarning_Icon.icon = new Bitmap(warningIconPath);
   this.exclusionWarning_Icon.setScaledFixedSize( 24, 24 );
   this.exclusionWarning_Icon.toolTip = this.exclusionZones_CheckBox.toolTip;

   this.exclusionZones_Sizer = new HorizontalSizer;
   this.exclusionZones_Sizer.spacing = 6;
   this.exclusionZones_Sizer.add( this.exclusionWarning_Icon );
   this.exclusionZones_Sizer.add( this.exclusionZones_CheckBox );
   this.exclusionZones_Sizer.addStretch();
   this.background_Control.sizer.add( this.exclusionZones_Sizer );

   this.background_Section = new SectionBar( this, "Find Background" );
   this.background_Section.setSection( this.background_Control );
   this.background_Section.enableCheckBox( true );
   this.background_Section.checkBox.checked = WorkflowParameters.enableBackground;
   this.background_Section.checkBox.toolTip = "<p>Find a clean, representative sky background region for the SPCC ROI " +
      "(star-poor, flat, at typical sky level &mdash; not simply the darkest spot).</p>";

   this.background_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableBackground = sectionbar.checkBox.checked;
      dlg.background_Control.enabled = WorkflowParameters.enableBackground;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      // mutual exclusion with AutoColor
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableAutoColor )
      {
         WorkflowParameters.enableAutoColor = false;
         dlg.autoColor_Section.checkBox.checked = false;
         dlg.autoColor_Control.enabled = false;
      }
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.background_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 3: SPCC
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
   this.camera_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.camera_Label.setFixedWidth( labelWidth );

   this.camera_ComboBox = new ComboBox( this );
   this.camera_ComboBox.editEnabled = false;
   for ( var i = 0; i < cameraList.length; i++ )
      this.camera_ComboBox.addItem( cameraList[i].label );
   this.camera_ComboBox.currentItem = WorkflowParameters.selectedCameraIdx;
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
   this.filter_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.filter_Label.setFixedWidth( labelWidth );

   this.filter_ComboBox = new ComboBox( this );
   this.filter_ComboBox.editEnabled = false;
   for ( var i = 0; i < filterList.length; i++ )
      this.filter_ComboBox.addItem( filterList[i].label );
   this.filter_ComboBox.currentItem = WorkflowParameters.selectedFilterIdx;
   this.filter_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.selectedFilterIdx = index;
      WorkflowParameters.saveUserPrefs();
   };

   this.filter_Sizer = new HorizontalSizer;
   this.filter_Sizer.spacing = 6;
   this.filter_Sizer.add( this.filter_Label );
   this.filter_Sizer.add( this.filter_ComboBox, 100 );

   // Narrowband checkbox
   this.narrowband_CheckBox = new CheckBox( this );
   this.narrowband_CheckBox.text = "Narrowband filters mode";
   this.narrowband_CheckBox.checked = WorkflowParameters.enableNarrowband;
   this.narrowband_CheckBox.toolTip = "<p>Enable narrowband mode for SPCC. " +
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
   this.spccGraphs_CheckBox = new CheckBox( this );
   this.spccGraphs_CheckBox.text = "Generate graphs";
   this.spccGraphs_CheckBox.checked = WorkflowParameters.generateSPCCGraphs;
   this.spccGraphs_CheckBox.toolTip = "<p>Show SPCC's calibration graphs after it runs.</p>";
   this.spccGraphs_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.generateSPCCGraphs = checked;
      WorkflowParameters.saveUserPrefs();
   };

   this.spccGraphs_Sizer = new HorizontalSizer;
   this.spccGraphs_Sizer.spacing = 6;
   this.spccGraphs_Sizer.addUnscaledSpacing( labelWidth + 6 );
   this.spccGraphs_Sizer.add( this.spccGraphs_CheckBox );
   this.spccGraphs_Sizer.addStretch();

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

   // Container for narrowband rows — hidden when unchecked
   this.nbRows_Control = new Control( this );
   this.nbRows_Control.sizer = new VerticalSizer;
   this.nbRows_Control.sizer.spacing = 4;
   this.nbRows_Control.sizer.add( this.nbHeader_Sizer );
   this.nbRows_Control.sizer.add( this.nbRed_Sizer );
   this.nbRows_Control.sizer.add( this.nbGreen_Sizer );
   this.nbRows_Control.sizer.add( this.nbBlue_Sizer );
   this.nbRows_Control.visible = WorkflowParameters.enableNarrowband;

   // Filter control wrapper for show/hide
   this.filter_Control = new Control( this );
   this.filter_Control.sizer = new HorizontalSizer;
   this.filter_Control.sizer.add( this.filter_Sizer );
   this.filter_Control.visible = !WorkflowParameters.enableNarrowband;

   this.spcc_Control = new Control( this );
   this.spcc_Control.sizer = new VerticalSizer;
   this.spcc_Control.sizer.margin = 6;
   this.spcc_Control.sizer.spacing = 6;
   this.spcc_Control.sizer.add( this.whiteRef_Sizer );
   this.spcc_Control.sizer.add( this.camera_Sizer );
   this.spcc_Control.sizer.add( this.filter_Control );
   this.spcc_Control.sizer.add( this.narrowband_Sizer );
   this.spcc_Control.sizer.add( this.spccGraphs_Sizer );
   this.spcc_Control.sizer.add( this.nbRows_Control );

   this.spcc_Section = new SectionBar( this, "SPCC (Spectrophotometric Color Calibration)" );
   this.spcc_Section.setSection( this.spcc_Control );
   this.spcc_Section.enableCheckBox( true );
   this.spcc_Section.checkBox.checked = WorkflowParameters.enableSPCC;
   this.spcc_Section.checkBox.toolTip = "<p>Enable/disable SPCC. Enabling auto-enables Background and Adaptive Auto STF.</p>";

   this.spcc_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableSPCC = sectionbar.checkBox.checked;
      dlg.spcc_Control.enabled = WorkflowParameters.enableSPCC;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      // mutual exclusion with AutoColor
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableAutoColor )
      {
         WorkflowParameters.enableAutoColor = false;
         dlg.autoColor_Section.checkBox.checked = false;
         dlg.autoColor_Control.enabled = false;
      }
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.spcc_Section.onToggleSection = toggleSectionHandler;

// =================================================================
   // SECTION 4: AutoColor
   // =================================================================

   this.autoColor_Control = new Control( this );
   this.autoColor_Control.sizer = new VerticalSizer;
   this.autoColor_Control.sizer.margin = 6;
   this.autoColor_Control.sizer.spacing = 4;

   this.autoColor_Section = new SectionBar( this, "AutoColor (Background Neutralization + Color Calibration)" );
   this.autoColor_Section.setSection( this.autoColor_Control );
   this.autoColor_Section.enableCheckBox( true );
   this.autoColor_Section.checkBox.checked = WorkflowParameters.enableAutoColor;
   this.autoColor_Section.checkBox.toolTip =
      "<p>Run AutoColor: automatic background neutralization and color calibration " +
      "in a single step, as an alternative to FindBackground + SPCC.</p>" +
      "<p>When enabled, FindBackground and SPCC will be disabled.</p>" +
      "<p>Based on AutoColor by Hartmut V. Bornemann. Used with permission.</p>";

   this.autoColor_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableAutoColor = sectionbar.checkBox.checked;
      dlg.autoColor_Control.enabled = WorkflowParameters.enableAutoColor;
      // mutual exclusion with Background and SPCC
      if ( sectionbar.checkBox.checked )
      {
         WorkflowParameters.enableBackground = false;
         dlg.background_Section.checkBox.checked = false;
         dlg.background_Control.enabled = false;
         WorkflowParameters.enableSPCC = false;
         dlg.spcc_Section.checkBox.checked = false;
         dlg.spcc_Control.enabled = false;
      }
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.autoColor_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 5: Adaptive Auto STF
   // =================================================================

   this.autoSTF_Control = new Control( this );
   this.autoSTF_Control.sizer = new VerticalSizer;
   this.autoSTF_Control.sizer.margin = 6;

   this.autoSTF_Section = new SectionBar( this, "Adaptive Auto STF" );
   this.autoSTF_Section.setSection( this.autoSTF_Control );
   this.autoSTF_Section.enableCheckBox( true );
   this.autoSTF_Section.checkBox.checked = WorkflowParameters.enableAutoSTF;
   this.autoSTF_Section.checkBox.toolTip = "<p>Adaptive Auto STF — automatically stretches the linear image for visualization after color calibration " +
      "(display only). Linked after SPCC to keep the calibrated colour, unlinked otherwise; " +
      "uses the Background preview's sky statistics when present.</p>";

   this.autoSTF_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableAutoSTF = sectionbar.checkBox.checked;
      dlg.autoSTF_Control.enabled = WorkflowParameters.enableAutoSTF;
      WorkflowParameters.saveUserPrefs();
   };
   this.autoSTF_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 6: BXT Full Processing
   // =================================================================

   // Sharpen Stars slider (0.00 - 1.00, default 0.25)
   this.bxtSharpenStars_Control = new NumericControl( this );
   this.bxtSharpenStars_Control.label.text = "Sharpen Stars:";
   this.bxtSharpenStars_Control.label.setFixedWidth( labelWidth );
   this.bxtSharpenStars_Control.setRange( 0, 1 );
   this.bxtSharpenStars_Control.setPrecision( 2 );
   this.bxtSharpenStars_Control.slider.setRange( 0, 100 );
   this.bxtSharpenStars_Control.setValue( WorkflowParameters.bxtSharpenStars );
   this.bxtSharpenStars_Control.toolTip = "<p>Star sharpening amount (0.00 = none, 1.00 = maximum).</p>";
   this.bxtSharpenStars_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtSharpenStars = value;
      WorkflowParameters.saveUserPrefs();
   };

   // Adjust Star Halos slider (-0.50 to +0.50, default 0.00)
   this.bxtAdjustHalos_Control = new NumericControl( this );
   this.bxtAdjustHalos_Control.label.text = "Adjust Star Halos:";
   this.bxtAdjustHalos_Control.label.setFixedWidth( labelWidth );
   this.bxtAdjustHalos_Control.setRange( -0.50, 0.50 );
   this.bxtAdjustHalos_Control.setPrecision( 2 );
   this.bxtAdjustHalos_Control.slider.setRange( 0, 100 );
   this.bxtAdjustHalos_Control.setValue( WorkflowParameters.bxtAdjustHalos );
   this.bxtAdjustHalos_Control.toolTip = "<p>Star halo adjustment (-0.50 reduce to +0.50 increase).</p>";
   this.bxtAdjustHalos_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtAdjustHalos = value;
      WorkflowParameters.saveUserPrefs();
   };

   // Automatic PSF checkbox
   this.bxtAutoPSF_CheckBox = new CheckBox( this );
   this.bxtAutoPSF_CheckBox.text = "Automatic PSF";
   this.bxtAutoPSF_CheckBox.checked = WorkflowParameters.bxtAutoPSF;
   this.bxtAutoPSF_CheckBox.toolTip = "<p>Automatically determine nonstellar PSF diameter.</p>" +
      "<p><b>If Automatic PSF is disabled, please obtain the necessary PSF values prior to running the script!</b></p>";
   this.bxtAutoPSF_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.bxtAutoPSF = checked;
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };

   this.bxtAutoPSF_Warning_Icon = new ToolButton( this );
   var psfWarningIconPath = SCRIPT_DIR + "/SH_WarningSign.png";
   if (File.exists(psfWarningIconPath))
      this.bxtAutoPSF_Warning_Icon.icon = new Bitmap(psfWarningIconPath);
   this.bxtAutoPSF_Warning_Icon.setScaledFixedSize( 24, 24 );
   this.bxtAutoPSF_Warning_Icon.toolTip = this.bxtAutoPSF_CheckBox.toolTip;

   this.bxtAutoPSF_Sizer = new HorizontalSizer;
   this.bxtAutoPSF_Sizer.addSpacing( labelWidth - 26 );
   this.bxtAutoPSF_Sizer.add( this.bxtAutoPSF_Warning_Icon );
   this.bxtAutoPSF_Sizer.addSpacing( 6 );
   this.bxtAutoPSF_Sizer.add( this.bxtAutoPSF_CheckBox );
   this.bxtAutoPSF_Sizer.addStretch();

   // PSF Diameter slider (0.00 - 8.00, default 0.00)
   this.bxtPSFDiameter_Control = new NumericControl( this );
   this.bxtPSFDiameter_Control.label.text = "PSF Diameter (px):";
   this.bxtPSFDiameter_Control.label.setFixedWidth( labelWidth );
   this.bxtPSFDiameter_Control.setRange( 0, 8 );
   this.bxtPSFDiameter_Control.setPrecision( 2 );
   this.bxtPSFDiameter_Control.slider.setRange( 0, 800 );
   this.bxtPSFDiameter_Control.setValue( WorkflowParameters.bxtPSFDiameter );
   this.bxtPSFDiameter_Control.toolTip = "<p>Nonstellar PSF diameter in pixels. Active when Automatic PSF is unchecked.</p>";
   this.bxtPSFDiameter_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtPSFDiameter = value;
      WorkflowParameters.saveUserPrefs();
   };

   // Sharpen Nonstellar slider (0.00 - 1.00, default 0.90)
   this.bxtSharpenNonstellar_Control = new NumericControl( this );
   this.bxtSharpenNonstellar_Control.label.text = "Sharpen Nonstellar:";
   this.bxtSharpenNonstellar_Control.label.setFixedWidth( labelWidth );
   this.bxtSharpenNonstellar_Control.setRange( 0, 1 );
   this.bxtSharpenNonstellar_Control.setPrecision( 2 );
   this.bxtSharpenNonstellar_Control.slider.setRange( 0, 100 );
   this.bxtSharpenNonstellar_Control.setValue( WorkflowParameters.bxtSharpenNonstellar );
   this.bxtSharpenNonstellar_Control.toolTip = "<p>Nonstellar sharpening amount (0.00 = none, 1.00 = maximum).</p>";
   this.bxtSharpenNonstellar_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtSharpenNonstellar = value;
      WorkflowParameters.saveUserPrefs();
   };

// Match all numeric edit box widths to Adjust Star Halos
   this.bxtSharpenStars_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );
   this.bxtPSFDiameter_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );
   this.bxtSharpenNonstellar_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );
   this.bxtCorrectTileOverlap_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );

   // BXT ML Version dropdown
   this.bxtMlVersion_Label = new Label( this );
   this.bxtMlVersion_Label.text = "ML Version:";
   this.bxtMlVersion_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.bxtMlVersion_Label.setFixedWidth( labelWidth );

   this.bxtMlVersion_ComboBox = new ComboBox( this );
   this.bxtMlVersion_ComboBox.addItem( "Latest (ML 5)" );
   this.bxtMlVersion_ComboBox.addItem( "ML 5" );
   this.bxtMlVersion_ComboBox.addItem( "ML 4" );
   this.bxtMlVersion_ComboBox.addItem( "ML 2" );
   var bxtMlIdx = bxtMlValues.indexOf( WorkflowParameters.bxtMlVersion );
   this.bxtMlVersion_ComboBox.currentItem = bxtMlIdx >= 0 ? bxtMlIdx : 0;
   this.bxtMlVersion_ComboBox.toolTip = "<p>Select BXT machine learning model version.<br/>" +
      "Latest uses the newest downloaded model.<br/>" +
      "ML 5 requires a paid BlurXTerminator license and the ML5 model installed.</p>";
   this.bxtMlVersion_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.bxtMlVersion = bxtMlValues[index];
      WorkflowParameters.saveUserPrefs();
   };

   this.bxtMlVersion_Sizer = new HorizontalSizer;
   this.bxtMlVersion_Sizer.spacing = 4;
   this.bxtMlVersion_Sizer.add( this.bxtMlVersion_Label );
   this.bxtMlVersion_Sizer.add( this.bxtMlVersion_ComboBox );
   this.bxtMlVersion_Sizer.addStretch();

   // BXT Tile Overlap slider (0.00 - 0.50, default 0.00)
   this.bxtTileOverlap_Control = new NumericControl( this );
   this.bxtTileOverlap_Control.label.text = "Tile Overlap:";
   this.bxtTileOverlap_Control.label.setFixedWidth( labelWidth );
   this.bxtTileOverlap_Control.setRange( 0, 0.50 );
   this.bxtTileOverlap_Control.setPrecision( 2 );
   this.bxtTileOverlap_Control.slider.setRange( 0, 500 );
   this.bxtTileOverlap_Control.setValue( WorkflowParameters.bxtTileOverlap );
   this.bxtTileOverlap_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );
   this.bxtTileOverlap_Control.toolTip = "<p>Tile overlap for BXT processing (0.00–0.50).<br/>" +
      "Higher values improve seam blending at the cost of speed.</p>";
   this.bxtTileOverlap_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.bxtTileOverlap = value;
      WorkflowParameters.saveUserPrefs();
   };

   // BXT Full section content
   this.bxtFull_Control = new Control( this );
   this.bxtFull_Control.sizer = new VerticalSizer;
   this.bxtFull_Control.sizer.margin = 6;
   this.bxtFull_Control.sizer.spacing = 4;
   this.bxtFull_Control.sizer.add( this.bxtMlVersion_Sizer );
   this.bxtFull_Control.sizer.add( this.bxtSharpenStars_Control );
   this.bxtFull_Control.sizer.add( this.bxtAdjustHalos_Control );
   this.bxtFull_Control.sizer.addSpacing( 4 );
   this.bxtFull_Control.sizer.add( this.bxtAutoPSF_Sizer );
   this.bxtFull_Control.sizer.add( this.bxtPSFDiameter_Control );
   this.bxtFull_Control.sizer.add( this.bxtSharpenNonstellar_Control );
   this.bxtFull_Control.sizer.add( this.bxtTileOverlap_Control );

   this.bxtFull_Section = new SectionBar( this, "BlurXTerminator (Full Processing)" );
   this.bxtFull_Section.toolTip = "<p><b>Download ML Models</b>, <b>Compute Device</b> and <b>Find Fastest</b> " +
      "must be configured in the original BXT tool first.</p>";
   this.bxtFull_Section.setSection( this.bxtFull_Control );
   this.bxtFull_Section.enableCheckBox( true );
   this.bxtFull_Section.checkBox.checked = WorkflowParameters.enableBXTFull;
   this.bxtFull_Section.checkBox.toolTip = "<p>Run BlurXTerminator with full sharpening.</p>";

   this.bxtFull_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableBXTFull = sectionbar.checkBox.checked;
      dlg.bxtFull_Control.enabled = WorkflowParameters.enableBXTFull;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };
   this.bxtFull_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 7: StarXTerminator
   // =================================================================

   // Generate Star Image checkbox
   this.sxtGenerateStars_CheckBox = new CheckBox( this );
   this.sxtGenerateStars_CheckBox.text = "Generate Star Image";
   this.sxtGenerateStars_CheckBox.checked = WorkflowParameters.sxtGenerateStars;
   this.sxtGenerateStars_CheckBox.toolTip = "<p>Create a separate image containing only the removed stars.</p>";
   this.sxtGenerateStars_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sxtGenerateStars = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // Unscreen Stars checkbox
   this.sxtUnscreen_CheckBox = new CheckBox( this );
   this.sxtUnscreen_CheckBox.text = "Unscreen Stars";
   this.sxtUnscreen_CheckBox.checked = WorkflowParameters.sxtUnscreen;
   this.sxtUnscreen_CheckBox.toolTip = "<p>Use unscreen blending for star removal instead of subtraction.</p>";
   this.sxtUnscreen_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sxtUnscreen = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // SXT ML Version dropdown
   this.sxtMlVersion_Label = new Label( this );
   this.sxtMlVersion_Label.text = "ML Version:";
   this.sxtMlVersion_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sxtMlVersion_Label.setFixedWidth( labelWidth );

   this.sxtMlVersion_ComboBox = new ComboBox( this );
   this.sxtMlVersion_ComboBox.addItem( "Latest (ML 11)" );
   this.sxtMlVersion_ComboBox.addItem( "ML 11" );
   // Map: combo index 0 → ml_version 0 (Latest), 1 → 11
   var sxtMlValues = [0, 11];
   var sxtMlIdx = sxtMlValues.indexOf( WorkflowParameters.sxtMlVersion );
   this.sxtMlVersion_ComboBox.currentItem = sxtMlIdx >= 0 ? sxtMlIdx : 0;
   this.sxtMlVersion_ComboBox.toolTip = "<p>Select SXT machine learning model version.<br/>" +
      "Latest uses the newest downloaded model.</p>";
   this.sxtMlVersion_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.sxtMlVersion = sxtMlValues[index];
      WorkflowParameters.saveUserPrefs();
   };

   this.sxtMlVersion_Sizer = new HorizontalSizer;
   this.sxtMlVersion_Sizer.spacing = 4;
   this.sxtMlVersion_Sizer.add( this.sxtMlVersion_Label );
   this.sxtMlVersion_Sizer.add( this.sxtMlVersion_ComboBox );
   this.sxtMlVersion_Sizer.addStretch();

   // SXT Tile Overlap slider (0.00 - 0.50, step 0.01, default 0.20)
   this.sxtTileOverlap_Control = new NumericControl( this );
   this.sxtTileOverlap_Control.label.text = "Tile Overlap:";
   this.sxtTileOverlap_Control.label.setFixedWidth( labelWidth );
   this.sxtTileOverlap_Control.setRange( 0, 0.50 );
   this.sxtTileOverlap_Control.setPrecision( 2 );
   this.sxtTileOverlap_Control.slider.setRange( 0, 500 );
   this.sxtTileOverlap_Control.setValue( WorkflowParameters.sxtTileOverlap );
   this.sxtTileOverlap_Control.edit.setFixedWidth( this.bxtAdjustHalos_Control.edit.width );
   this.sxtTileOverlap_Control.toolTip = "<p>Tile overlap for SXT processing (0.00–0.50).<br/>" +
      "Higher values improve seam blending at the cost of speed.</p>";
   this.sxtTileOverlap_Control.onValueUpdated = function( value )
   {
      WorkflowParameters.sxtTileOverlap = value;
      WorkflowParameters.saveUserPrefs();
   };

   this.sxtGenerateStars_Sizer = new HorizontalSizer;
   this.sxtGenerateStars_Sizer.addSpacing( labelWidth + 4 );
   this.sxtGenerateStars_Sizer.add( this.sxtGenerateStars_CheckBox );
   this.sxtGenerateStars_Sizer.addStretch();

   this.sxtUnscreen_Sizer = new HorizontalSizer;
   this.sxtUnscreen_Sizer.addSpacing( labelWidth + 4 );
   this.sxtUnscreen_Sizer.add( this.sxtUnscreen_CheckBox );
   this.sxtUnscreen_Sizer.addStretch();

   this.sxt_Control = new Control( this );
   this.sxt_Control.sizer = new VerticalSizer;
   this.sxt_Control.sizer.margin = 6;
   this.sxt_Control.sizer.spacing = 4;
   this.sxt_Control.sizer.add( this.sxtMlVersion_Sizer );
   this.sxt_Control.sizer.add( this.sxtGenerateStars_Sizer );
   this.sxt_Control.sizer.add( this.sxtUnscreen_Sizer );
   this.sxt_Control.sizer.add( this.sxtTileOverlap_Control );

   this.sxt_Section = new SectionBar( this, "StarXTerminator" );
   this.sxt_Section.toolTip = "<p><b>Download ML Models</b>, <b>Compute Device</b> and <b>Find Fastest</b> " +
      "must be configured in the original SXT tool first.</p>";
   this.sxt_Section.setSection( this.sxt_Control );
   this.sxt_Section.enableCheckBox( true );
   this.sxt_Section.checkBox.checked = WorkflowParameters.enableSXT;
   this.sxt_Section.checkBox.toolTip = "<p>Remove stars and optionally create a stars-only image.</p>";

   this.sxt_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableSXT = sectionbar.checkBox.checked;
      dlg.sxt_Control.enabled = WorkflowParameters.enableSXT;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      // mutual exclusion with StarNet2
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableStarNet2 )
      {
         WorkflowParameters.enableStarNet2 = false;
         dlg.sn2_Section.checkBox.checked = false;
         dlg.sn2_Control.enabled = false;
      }
      WorkflowParameters.saveUserPrefs();
   };
   this.sxt_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 8: StarNet2
   // =================================================================

   // Stride dropdown
   this.sn2Stride_Label = new Label( this );
   this.sn2Stride_Label.text = "Stride:";
   this.sn2Stride_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.sn2Stride_Label.setFixedWidth( labelWidth );

   this.sn2Stride_ComboBox = new ComboBox( this );
   this.sn2Stride_ComboBox.addItem( "384" );
   this.sn2Stride_ComboBox.addItem( "256" );
   this.sn2Stride_ComboBox.addItem( "128" );
   this.sn2Stride_ComboBox.currentItem = WorkflowParameters.sn2Stride === 384 ? 0 :
                                          WorkflowParameters.sn2Stride === 128 ? 2 : 1;
   this.sn2Stride_ComboBox.toolTip = "<p>Tile stride size. Smaller = better quality but slower.</p>";
   this.sn2Stride_ComboBox.onItemSelected = function( index )
   {
      WorkflowParameters.sn2Stride = index === 0 ? 384 : index === 2 ? 128 : 256;
      WorkflowParameters.saveUserPrefs();
   };

   this.sn2Stride_Sizer = new HorizontalSizer;
   this.sn2Stride_Sizer.spacing = 6;
   this.sn2Stride_Sizer.add( this.sn2Stride_Label );
   this.sn2Stride_Sizer.add( this.sn2Stride_ComboBox );
   this.sn2Stride_Sizer.addStretch();

   // Create starmask checkbox
   this.sn2Mask_CheckBox = new CheckBox( this );
   this.sn2Mask_CheckBox.text = "Create starmask";
   this.sn2Mask_CheckBox.checked = WorkflowParameters.sn2Mask;
   this.sn2Mask_CheckBox.toolTip = "<p>Generate a star mask image.</p>";
   this.sn2Mask_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sn2Mask = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // 2x upsample checkbox
   this.sn2Upsample_CheckBox = new CheckBox( this );
   this.sn2Upsample_CheckBox.text = "2x upsample";
   this.sn2Upsample_CheckBox.checked = WorkflowParameters.sn2Upsample;
   this.sn2Upsample_CheckBox.toolTip = "<p>Upsample image 2x before processing for better quality on small images.</p>";
   this.sn2Upsample_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sn2Upsample = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // Linear data checkbox
   this.sn2Linear_CheckBox = new CheckBox( this );
   this.sn2Linear_CheckBox.text = "Linear data";
   this.sn2Linear_CheckBox.checked = WorkflowParameters.sn2Linear;
   this.sn2Linear_CheckBox.toolTip = "<p>Check if the image is linear (not yet stretched).</p>";
   this.sn2Linear_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sn2Linear = checked;
      WorkflowParameters.saveUserPrefs();
   };

   this.sn2Mask_Sizer = new HorizontalSizer;
   this.sn2Mask_Sizer.addSpacing( labelWidth + 4 );
   this.sn2Mask_Sizer.add( this.sn2Mask_CheckBox );
   this.sn2Mask_Sizer.addStretch();

   this.sn2Upsample_Sizer = new HorizontalSizer;
   this.sn2Upsample_Sizer.addSpacing( labelWidth + 4 );
   this.sn2Upsample_Sizer.add( this.sn2Upsample_CheckBox );
   this.sn2Upsample_Sizer.addStretch();

   this.sn2Linear_Sizer = new HorizontalSizer;
   this.sn2Linear_Sizer.addSpacing( labelWidth + 4 );
   this.sn2Linear_Sizer.add( this.sn2Linear_CheckBox );
   this.sn2Linear_Sizer.addStretch();

   this.sn2_Control = new Control( this );
   this.sn2_Control.sizer = new VerticalSizer;
   this.sn2_Control.sizer.margin = 6;
   this.sn2_Control.sizer.spacing = 4;
   this.sn2_Control.sizer.add( this.sn2Stride_Sizer );
   this.sn2_Control.sizer.add( this.sn2Mask_Sizer );
   this.sn2_Control.sizer.add( this.sn2Upsample_Sizer );
   this.sn2_Control.sizer.add( this.sn2Linear_Sizer );

   this.sn2_Section = new SectionBar( this, "StarNet2" );
   this.sn2_Section.setSection( this.sn2_Control );
   this.sn2_Section.enableCheckBox( true );
   this.sn2_Section.checkBox.checked = WorkflowParameters.enableStarNet2;
   this.sn2_Section.checkBox.toolTip = "<p>Remove stars using StarNet2 (alternative to StarXTerminator).</p>" +
      "<p>StarNet2 must be installed via the PixInsight repository.</p>";

   this.sn2_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableStarNet2 = sectionbar.checkBox.checked;
      dlg.sn2_Control.enabled = WorkflowParameters.enableStarNet2;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      // mutual exclusion with SXT
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableSXT )
      {
         WorkflowParameters.enableSXT = false;
         dlg.sxt_Section.checkBox.checked = false;
         dlg.sxt_Control.enabled = false;
      }
      WorkflowParameters.saveUserPrefs();
   };
   this.sn2_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 9: NoiseXTerminator
   // =================================================================

   this.nxt_Control = new Control( this );
   this.nxt_Control.sizer = new VerticalSizer;
   this.nxt_Control.sizer.margin = 6;
   this.nxt_Control.sizer.spacing = 4;

   this.nxt_Info_Label = new Label( this );
   this.nxt_Info_Label.useRichText = true;
   this.nxt_Info_Label.wordWrapping = true;
   this.nxt_Info_Label.text = "<p>Opens NoiseXTerminator (latest ML model) after the workflow completes. " +
      "Mutually exclusive with MLDenoise.</p>";
   this.nxt_Control.sizer.add( this.nxt_Info_Label );

   this.nxt_Section = new SectionBar( this, "NoiseXTerminator (calls tool only)" );
   this.nxt_Section.setSection( this.nxt_Control );
   this.nxt_Section.enableCheckBox( true );
   this.nxt_Section.checkBox.checked = WorkflowParameters.enableNXT;
   this.nxt_Section.checkBox.toolTip = "<p>Open NoiseXTerminator (latest ML model) after the workflow completes.</p>" +
      "<p>With the original image active, drag the instance triangle to apply.</p>";

   this.nxt_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableNXT = sectionbar.checkBox.checked;
      dlg.nxt_Control.enabled = WorkflowParameters.enableNXT;
      // Ticking the box does not expand the section (launch-only tool).
      // mutual exclusion with MLDenoise
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableMLDenoise )
      {
         WorkflowParameters.enableMLDenoise = false;
         dlg.mldenoise_Section.checkBox.checked = false;
         dlg.mldenoise_Control.enabled = false;
      }
      WorkflowParameters.saveUserPrefs();
   };
   this.nxt_Section.onToggleSection = toggleSectionHandler;

   // =================================================================
   // SECTION 10: MLDenoise
   // =================================================================

   this.mldenoise_Control = new Control( this );
   this.mldenoise_Control.sizer = new VerticalSizer;
   this.mldenoise_Control.sizer.margin = 6;
   this.mldenoise_Control.sizer.spacing = 4;

   this.mldModelPath_Label = new Label( this );
   this.mldModelPath_Label.text = "Model:";
   this.mldModelPath_Label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
   this.mldModelPath_Label.setFixedWidth( labelWidth );

   this.mldModelPath_Edit = new Edit( this );
   this.mldModelPath_Edit.text = WorkflowParameters.mldModelPath;
   this.mldModelPath_Edit.toolTip = "<p>Full path to your MLDenoise model file (.xmlm).</p>" +
      "<p>This path is machine-specific and is stored only in your own preferences " +
      "(never shared or hardcoded). Leave empty to open MLDenoise without pre-selecting a model.</p>";
   this.mldModelPath_Edit.onEditCompleted = function()
   {
      WorkflowParameters.mldModelPath = this.text.trim();
      WorkflowParameters.saveUserPrefs();
   };

   this.mldModelPath_Browse = new ToolButton( this );
   this.mldModelPath_Browse.icon = this.scaledResource( ":/icons/select-file.png" );
   this.mldModelPath_Browse.setScaledFixedSize( 20, 20 );
   this.mldModelPath_Browse.toolTip = "<p>Browse for your MLDenoise model file (.xmlm).</p>";
   this.mldModelPath_Browse.onClick = function()
   {
      var fd = new OpenFileDialog;
      fd.caption = "Select MLDenoise Model File";
      fd.filters = [["MLDenoise models (*.xmlm)", "*.xmlm"], ["All Files (*)", "*"]];
      if (fd.execute()) {
         WorkflowParameters.mldModelPath = fd.fileName;   // full path (machine-specific)
         dlg.mldModelPath_Edit.text = fd.fileName;
         WorkflowParameters.saveUserPrefs();
      }
   };

   this.mldModelPath_Sizer = new HorizontalSizer;
   this.mldModelPath_Sizer.spacing = 4;
   this.mldModelPath_Sizer.add( this.mldModelPath_Label );
   this.mldModelPath_Sizer.add( this.mldModelPath_Edit, 100 );
   this.mldModelPath_Sizer.add( this.mldModelPath_Browse );

   this.mldenoise_Info_Label = new Label( this );
   this.mldenoise_Info_Label.useRichText = true;
   this.mldenoise_Info_Label.wordWrapping = true;
   this.mldenoise_Info_Label.text = "<p>Opens MLDenoise with the model above (other settings use " +
      "MLDenoise's own defaults; adjust them in the tool before applying). " +
      "Mutually exclusive with NoiseXTerminator.</p>";

   this.mldenoise_Control.sizer.add( this.mldModelPath_Sizer );
   this.mldenoise_Control.sizer.add( this.mldenoise_Info_Label );

   this.mldenoise_Section = new SectionBar( this, "MLDenoise (calls tool only)" );
   this.mldenoise_Section.setSection( this.mldenoise_Control );
   this.mldenoise_Section.enableCheckBox( true );
   this.mldenoise_Section.checkBox.checked = WorkflowParameters.enableMLDenoise;
   this.mldenoise_Section.checkBox.toolTip = "<p>Open MLDenoise after the workflow completes, using your own MLDenoise settings and model.</p>" +
      "<p>With the original image active, drag the instance triangle to apply. Mutually exclusive with NoiseXTerminator.</p>";

   this.mldenoise_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableMLDenoise = sectionbar.checkBox.checked;
      dlg.mldenoise_Control.enabled = WorkflowParameters.enableMLDenoise;
      // Ticking the box does not expand the section (launch-only tool).
      // mutual exclusion with NoiseXTerminator
      if ( sectionbar.checkBox.checked && WorkflowParameters.enableNXT )
      {
         WorkflowParameters.enableNXT = false;
         dlg.nxt_Section.checkBox.checked = false;
         dlg.nxt_Control.enabled = false;
      }
      WorkflowParameters.saveUserPrefs();
   };
   this.mldenoise_Section.onToggleSection = toggleSectionHandler;

   this.info_Label = new Label( this );
   this.info_Label.text = "Loaded: " + whiteRefList.length + " white refs, " +
      cameraList.length + " cameras, " + filterList.length + " filter sets";
   this.info_Label.styleSheet = "font-style: italic; color: #888;";

   // =================================================================
   // Bottom Button Bar: New Instance + OK + Cancel
   // =================================================================

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

   // Documentation button: opens the PixInsight manual (doc/scripts/SHLazyWorkflowPart2)
   this.pdfButton = new ToolButton( this );
   this.pdfButton.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
   this.pdfButton.setScaledFixedSize( 24, 24 );
   this.pdfButton.toolTip = "<p>Open the Lazy Workflow Part 2 manual.</p>";
   this.pdfButton.onClick = function()
   {
      if ( !Dialog.browseScriptDocumentation( DOC_NAME ) )
         (new MessageBox(
            "<p>The Lazy Workflow Part 2 manual is not installed.</p>" +
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
      WorkflowParameters.enableAutoColor  = false;
      dlg.autoColor_Section.checkBox.checked = false;
      dlg.autoColor_Control.enabled = false;
      WorkflowParameters.enableBXTCorrect = false;
      WorkflowParameters.enableBackground = false;
      WorkflowParameters.enableSPCC = false;
      WorkflowParameters.enableAutoSTF = false;
      WorkflowParameters.enableBXTFull = false;
      WorkflowParameters.enableSXT = false;

      dlg.bxtCorrect_Section.checkBox.checked = false;
      dlg.bxtCorrect_Control.enabled = false;
      dlg.background_Section.checkBox.checked = false;
      dlg.background_Control.enabled = false;
      dlg.spcc_Section.checkBox.checked = false;
      dlg.spcc_Control.enabled = false;
      dlg.autoSTF_Section.checkBox.checked = false;
      dlg.autoSTF_Control.enabled = false;
      dlg.bxtFull_Section.checkBox.checked = false;
      dlg.bxtFull_Control.enabled = false;
      dlg.sxt_Section.checkBox.checked = false;
      dlg.sxt_Control.enabled = false;
      WorkflowParameters.enableStarNet2 = false;
      dlg.sn2_Section.checkBox.checked = false;
      dlg.sn2_Control.enabled = false;
      WorkflowParameters.enableNXT = false;
      dlg.nxt_Section.checkBox.checked = false;
      dlg.nxt_Control.enabled = false;
      WorkflowParameters.enableMLDenoise = false;
      dlg.mldenoise_Section.checkBox.checked = false;
      dlg.mldenoise_Control.enabled = false;
   };

   // Reset Defaults button
   this.resetDefaultsButton = new ToolButton( this );
   this.resetDefaultsButton.icon = this.scaledResource( ":/icons/reload.png" );
   this.resetDefaultsButton.setScaledFixedSize( 24, 24 );
   this.resetDefaultsButton.toolTip = "<p>Reset all workflow steps to default values.<br/>" +
      "Default: BXTCorrect, Background, SPCC, AutoSTF, BXTFull, SXT, NXT enabled. StarNet2 disabled.<br/>" +
      "Equipment and processing settings (camera, filter, white reference, BXT, SXT, StarNet2 parameters) are not changed.</p>";
   this.resetDefaultsButton.onClick = function()
   {
      WorkflowParameters.enableBXTCorrect   = true;
      dlg.bxtCorrect_Section.checkBox.checked = true;
      dlg.bxtCorrect_Control.enabled = true;
      WorkflowParameters.enableBackground   = true;
      WorkflowParameters.enableSPCC         = true;
      WorkflowParameters.enableAutoSTF      = true;
      WorkflowParameters.enableBXTFull      = true;
      WorkflowParameters.enableSXT          = true;
      WorkflowParameters.enableNXT          = true;
      WorkflowParameters.enableMLDenoise    = false;
      WorkflowParameters.enableStarNet2     = false;
      WorkflowParameters.enableBgPrecheck   = true;

      WorkflowParameters.enableAutoColor = false;
      dlg.autoColor_Section.checkBox.checked = false;
      dlg.autoColor_Control.enabled = false;
      dlg.background_Section.checkBox.checked = true;
      dlg.background_Control.enabled = true;
      dlg.exclusionZones_CheckBox.checked = true;
      dlg.spcc_Section.checkBox.checked = true;
      dlg.spcc_Control.enabled = true;
      dlg.autoSTF_Section.checkBox.checked = true;
      dlg.autoSTF_Control.enabled = true;
      dlg.bxtFull_Section.checkBox.checked = true;
      dlg.bxtFull_Control.enabled = true;
      dlg.sxt_Section.checkBox.checked = true;
      dlg.sxt_Control.enabled = true;
      dlg.sn2_Section.checkBox.checked = false;
      dlg.sn2_Control.enabled = false;
      dlg.nxt_Section.checkBox.checked = true;
      dlg.nxt_Control.enabled = true;
      dlg.mldenoise_Section.checkBox.checked = false;
      dlg.mldenoise_Control.enabled = false;

      WorkflowParameters.saveUserPrefs();
      dlg.updateDependencies();
   };

   // Reset Settings button (cog - clears persistent equipment and processing preferences)
   this.resetSettingsButton = new ToolButton( this );
   this.resetSettingsButton.icon = this.scaledResource( ":/process/gear.png" );
   this.resetSettingsButton.setScaledFixedSize( 24, 24 );
   this.resetSettingsButton.toolTip = "<p>Reset equipment and processing settings to factory defaults.<br/>" +
      "Resets: White Reference to Average Spiral Galaxy, Camera to Ideal QE curve, Filter to default,<br/>" +
      "BXT Full parameters, SXT parameters, and StarNet2 parameters.<br/>" +
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
      dlg.narrowband_CheckBox.checked = false;
      dlg.spccGraphs_CheckBox.checked = false;
      dlg.nbRows_Control.visible = false;
      dlg.filter_Control.visible = true;
      dlg.nbRedWave_Edit.text = "656.30";
      dlg.nbRedBw_Edit.text = "3.00";
      dlg.nbGreenWave_Edit.text = "500.70";
      dlg.nbGreenBw_Edit.text = "3.00";
      dlg.nbBlueWave_Edit.text = "500.70";
      dlg.nbBlueBw_Edit.text = "3.00";
      dlg.adjustToContents();
      dlg.bxtSharpenStars_Control.setValue(0.25);
      dlg.bxtAdjustHalos_Control.setValue(0.00);
      dlg.bxtAutoPSF_CheckBox.checked = true;
      dlg.bxtPSFDiameter_Control.setValue(0.00);
      dlg.bxtSharpenNonstellar_Control.setValue(0.90);
      dlg.bxtTileOverlap_Control.setValue(0.00);
      dlg.bxtMlVersion_ComboBox.currentItem = 0;
      dlg.bxtCorrectTileOverlap_Control.setValue(0.00);
      dlg.bxtCorrectMlVersion_ComboBox.currentItem = 0;
      dlg.sxtGenerateStars_CheckBox.checked = true;
      dlg.sxtUnscreen_CheckBox.checked = false;
      dlg.sxtTileOverlap_Control.setValue(0.20);
      dlg.sxtMlVersion_ComboBox.currentItem = 0;
      dlg.sn2Stride_ComboBox.currentItem = 1;
      dlg.sn2Mask_CheckBox.checked = true;
      dlg.sn2Upsample_CheckBox.checked = false;
      dlg.sn2Linear_CheckBox.checked = true;
      dlg.updateDependencies();
      WorkflowParameters.saveUserPrefs();
   };

   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function() { dlg.ok(); };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function() { dlg.cancel(); };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.add( this.newInstanceButton );
   this.buttons_Sizer.add( this.pdfButton );
   this.buttons_Sizer.add( this.disableAllButton );
   this.buttons_Sizer.add( this.resetDefaultsButton );
   this.buttons_Sizer.add( this.resetSettingsButton );
   this.buttons_Sizer.addStretch();
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
   this.sizer.add( this.bxtCorrect_Section );
   this.sizer.add( this.bxtCorrect_Control );
   this.sizer.add( this.background_Section );
   this.sizer.add( this.background_Control );
   this.sizer.add( this.spcc_Section );
   this.sizer.add( this.spcc_Control );
   this.sizer.add( this.autoColor_Section );
   this.sizer.add( this.autoColor_Control );
   this.sizer.add( this.autoSTF_Section );
   this.sizer.add( this.autoSTF_Control );
   this.sizer.add( this.bxtFull_Section );
   this.sizer.add( this.bxtFull_Control );
   this.sizer.add( this.sxt_Section );
   this.sizer.add( this.sxt_Control );
   this.sizer.add( this.sn2_Section );
   this.sizer.add( this.sn2_Control );
   this.sizer.add( this.nxt_Section );
   this.sizer.add( this.nxt_Control );
   this.sizer.add( this.mldenoise_Section );
   this.sizer.add( this.mldenoise_Control );
   this.sizer.addSpacing( 8 );
   this.sizer.add( this.info_Label );
   this.sizer.addSpacing( 8 );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = "SPACE HUNTER - LAZY WORKFLOW PART 2";

   // Apply initial enabled states
   this.bxtCorrect_Control.enabled = WorkflowParameters.enableBXTCorrect;
   this.background_Control.enabled = WorkflowParameters.enableBackground;
   this.spcc_Control.enabled = WorkflowParameters.enableSPCC;
   this.autoSTF_Control.enabled = WorkflowParameters.enableAutoSTF;
   this.bxtFull_Control.enabled = WorkflowParameters.enableBXTFull;
   this.sxt_Control.enabled = WorkflowParameters.enableSXT;
   this.sn2_Control.enabled = WorkflowParameters.enableStarNet2;
   this.nxt_Control.enabled = WorkflowParameters.enableNXT;
   this.mldenoise_Control.enabled = WorkflowParameters.enableMLDenoise;
   this.autoColor_Control.enabled = WorkflowParameters.enableAutoColor;

   // Collapse sections with no user-selectable parameters
   this.bxtCorrect_Control.hide();
   this.autoSTF_Control.hide();
   this.sn2_Control.hide();
   this.nxt_Control.hide();
   this.mldenoise_Control.hide();
   this.autoColor_Control.hide();

   this.updateDependencies();

   this.ensureLayoutUpdated();
   this.adjustToContents();
   this.setMinWidth( 540 );
   this.setMinHeight();
   }
}; // end class SpaceHunterDialog2

// ============================================================
// STEP 0: Equipment Selection Dialog
// ============================================================

function selectEquipment()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("EQUIPMENT & WORKFLOW SELECTION");
   console.writeln("=".repeat(80) + "\n");

   let dialog = new SpaceHunterDialog2();

   if ( !dialog.execute() )
      throw new Error("Script cancelled by user.");

   var wr = whiteRefList[WorkflowParameters.selectedWhiteRefIdx];
   var cam = cameraList[WorkflowParameters.selectedCameraIdx];
   var flt = filterList[WorkflowParameters.selectedFilterIdx];

   console.writeln("\nSelected equipment:");
   console.writeln("  White reference: " + wr.label);
   console.writeln("  Camera: " + cam.label);
   console.writeln("  Filter: " + flt.label + " [" + flt.type + "]");

   console.writeln("\nWorkflow sections enabled:");
   console.writeln("  BXT Correct:  " + (WorkflowParameters.enableBXTCorrect ? "Yes" : "No") +
      (WorkflowParameters.enableBXTCorrect ? "  (ML " + (WorkflowParameters.bxtCorrectMlVersion || "latest") +
       ", overlap " + WorkflowParameters.bxtCorrectTileOverlap.toFixed(2) + ")" : ""));
   console.writeln("  Background:   " + (WorkflowParameters.enableBackground ? "Yes" : "No") +
      (WorkflowParameters.enableBackground ? (WorkflowParameters.enableBgPrecheck ? " (pre-check on)" : " (pre-check off)") : ""));
   console.writeln("  SPCC:         " + (WorkflowParameters.enableSPCC ? "Yes" : "No"));
   console.writeln("  AutoColor:    " + (WorkflowParameters.enableAutoColor ? "Yes" : "No"));
   console.writeln("  AASTF:        " + (WorkflowParameters.enableAutoSTF ? "Yes" : "No"));
   console.writeln("  BXT Full:     " + (WorkflowParameters.enableBXTFull ? "Yes" : "No"));
   if (WorkflowParameters.enableBXTFull) {
      console.writeln("    Sharpen Stars:      " + WorkflowParameters.bxtSharpenStars.toFixed(2));
      console.writeln("    Adjust Halos:       " + WorkflowParameters.bxtAdjustHalos.toFixed(2));
      console.writeln("    Auto PSF:           " + (WorkflowParameters.bxtAutoPSF ? "Yes" : "No"));
      console.writeln("    PSF Diameter:       " + WorkflowParameters.bxtPSFDiameter.toFixed(2));
      console.writeln("    Sharpen Nonstellar: " + WorkflowParameters.bxtSharpenNonstellar.toFixed(2));
      console.writeln("    ML Version:         " + (WorkflowParameters.bxtMlVersion || "latest"));
      console.writeln("    Tile Overlap:       " + WorkflowParameters.bxtTileOverlap.toFixed(2));
   }
   console.writeln("  SXT:          " + (WorkflowParameters.enableSXT ? "Yes" : "No"));
   if (WorkflowParameters.enableSXT) {
      console.writeln("    Generate Stars: " + (WorkflowParameters.sxtGenerateStars ? "Yes" : "No"));
      console.writeln("    Unscreen:       " + (WorkflowParameters.sxtUnscreen ? "Yes" : "No"));
      console.writeln("    Tile Overlap:   " + WorkflowParameters.sxtTileOverlap.toFixed(2));
   }
   console.writeln("  StarNet2:     " + (WorkflowParameters.enableStarNet2 ? "Yes" : "No"));
   console.writeln("  NXT:          " + (WorkflowParameters.enableNXT ? "Yes" : "No"));
   console.writeln("  MLDenoise:    " + (WorkflowParameters.enableMLDenoise ? "Yes" : "No"));
   console.writeln("=".repeat(80) + "\n");
}

// ============================================================
// STEP 2: BlurXTerminator - Correct Only
// ============================================================

// ============================================================
// Re-run Protection: warn if tool already ran on this image
// ============================================================
// Re-run marks. Each mark is written right after its step runs: PixInsight
// keeps view properties per history state, so undoing that step (History
// Explorer) removes its mark again, while later steps keep it. Storable: saved
// with the file, so the warning also works after reopening it.
// (view.processing is NOT usable for this: it still lists undone steps.)
function shMarkDone(view, id)
{
   try { view.setPropertyValue(id, true, PropertyType.Boolean,
                               PropertyAttribute.Storable | PropertyAttribute.Permanent); } catch(e) {}
}
function shHasMark(view, id)
{
   try { return view.hasProperty(id); } catch(e) { return false; }
}
var SH_STEP_MARKS = ["SpaceHunter:ScriptRan", "SpaceHunter:BXTCorrectDone", "SpaceHunter:SPCCDone",
                     "SpaceHunter:AutoColorDone", "SpaceHunter:BXTFullDone",
                     "SpaceHunter:SXTDone", "SpaceHunter:StarNet2Done"];

function checkPropertyAndWarn(propertyName, toolName)
{
   var win = ImageWindow.activeWindow;
   if (win.isNull) return true;

   var view = win.mainView;
   var found = false;
   try {
      var val = view.propertyValue(propertyName);
      if (val !== null && val !== undefined)
         found = true;
   } catch(e) {}

   if (found) {
      var msg = new MessageBox(
         "<p><b>" + toolName + "</b> has already been applied to this image.</p>" +
         "<p>Running it again may damage your image.</p>" +
         "<p>Continue anyway?</p>",
         "Warning: Tool Already Applied",
         StdIcon.Warning,
         StdButton.Yes, StdButton.No
      );
      var result = msg.execute();
      if (result === StdButton.No)
         throw new Error("Script cancelled by user.");
   }

   return true;
}

function runBXT_CorrectOnly()
{
    let win = ImageWindow.activeWindow;
    if (win.isNull)
        throw new Error("No active image window.");

    let view = win.mainView;   // always the whole image, never a selected preview tab
    if (view.isNull)
        throw new Error("No active view.");

    checkPropertyAndWarn("SpaceHunter:BXTCorrectDone", "BlurXTerminator (Correct Only)");

    console.writeln("\n" + "=".repeat(80));
    console.writeln("STEP 2: Running BlurXTerminator (Correct Only)");
    console.writeln("=".repeat(80) + "\n");

    console.writeln("Running BlurXTerminator on view: " + view.id);
    console.writeln("Mode: Correct Only\n");

    if ( typeof BlurXTerminator === "undefined" ) {
      console.warningln("\u26A0 BlurXTerminator is not installed - skipping BXT Correct Only.\n");
      return;
   }
   var P = new BlurXTerminator;
    P.ml_version = WorkflowParameters.bxtCorrectMlVersion;
    P.correct_only = true;
    P.sharpen_stars = 0.25;
    P.adjust_star_halos = -0.08;
    P.nonstellar_diameter = 0.00;
    P.auto_nonstellar_psf = true;
    P.sharpen_nonstellar = 0.90;
    P.overlap = WorkflowParameters.bxtCorrectTileOverlap;

    if (!P.executeOn(view)) {
        if (console.abortRequested)
            throw new Error("Script cancelled by user.");
        throw new Error("BlurXTerminator execution failed.");
    }

    CoreApplication.processEvents();
    if (console.abortRequested)
        throw new Error("Script cancelled by user.");

    console.writeln("\u2714 BlurXTerminator (Correct Only) completed successfully.\n");
}

// ============================================================
// STEP 0b: Background Pre-check (previews + optional IRSA dust map)
// ============================================================
//
// Runs before anything is processed. Shown only when it is relevant:
// no Exclude* preview exists, other (non-Exclude) previews are left over, or an
// Exclude preview covers most of the image. All decisions happen here, so the
// workflow then runs through in one pass.
//
// Dust map: NASA/IPAC IRSA Galactic Dust Reddening and Extinction service
// (https://irsa.ipac.caltech.edu/applications/DUST/), E(B-V) map of
// Schlegel, Finkbeiner & Davis 1998, ApJ 500, 525 (~6' resolution).

var IRSA_DUST_URL = "https://irsa.ipac.caltech.edu/cgi-bin/DUST/nph-dust";

// Rough E(B-V) (SFD, mag) levels for IFN visibility in deep amateur data.
// Rules of thumb, not physical limits.
var IFN_LEVELS = [
   { max: 0.02,     name: "Very low",  note: "Dust-poor field. Little or no IFN expected." },
   { max: 0.05,     name: "Low",       note: "Faint cirrus possible in very deep data." },
   { max: 0.15,     name: "Moderate",  note: "Classic IFN field. Cirrus likely visible in deep data." },
   { max: 0.50,     name: "High",      note: "Bright IFN / dust clouds likely." },
   { max: Infinity, name: "Very high", note: "Heavy dust: dense IFN / molecular clouds or dark nebulae. Little truly clean sky." }
];

function collectPreviewInfo(win)
{
   var img = win.mainView.image;
   var area = img.width * img.height;
   var info = { excludes: [], others: [] };
   var pv = win.previews;
   for (var i = 0; i < pv.length; i++) {
      var r = win.previewRect(pv[i]);
      var e = { id: pv[i].id, pct: 100 * (r.x1 - r.x0) * (r.y1 - r.y0) / area,
                // position as fractions of the image, for drawing on the dust map
                fx0: r.x0 / img.width, fy0: r.y0 / img.height, fx1: r.x1 / img.width, fy1: r.y1 / img.height };
      if (pv[i].id.indexOf("Exclude") === 0)
         info.excludes.push(e);
      else
         info.others.push(e);
   }
   return info;
}

function bgPrecheckNeeded(info)
{
   if (info.excludes.length === 0 || info.others.length > 0)
      return true;
   for (var i = 0; i < info.excludes.length; i++)
      if (info.excludes[i].pct > 50)
         return true;
   return false;
}

function previewInfoHtml(info)
{
   var h = "<p><b>Exclude previews</b> (used as exclusion zones):<br/>";
   if (info.excludes.length === 0)
      h += "&nbsp;&nbsp;none<br/>";
   for (var i = 0; i < info.excludes.length; i++) {
      var e = info.excludes[i];
      h += "&nbsp;&nbsp;" + (e.pct > 50 ? "⚠ " : "✔ ") + e.id + " &mdash; " + e.pct.toFixed(1) +
           "% of image" + (e.pct > 50 ? " <b>&mdash; covers most of the image. Leftover?</b>" : "") + "<br/>";
   }
   h += "</p>";
   if (info.others.length > 0) {
      h += "<p><b>⚠ Other previews</b> &mdash; NOT used as exclusion zones, will be deleted:<br/>";
      for (var i = 0; i < info.others.length; i++)
         h += "&nbsp;&nbsp;⚠ " + info.others[i].id + " &mdash; " + info.others[i].pct.toFixed(1) + "% of image<br/>";
      h += "If one of these was meant as an exclusion zone: <b>Cancel</b>, rename it to start with " +
           "<b>Exclude</b> (case-sensitive) and run the script again.</p>";
   }
   return h;
}

// --- coordinates -------------------------------------------------------------

function bgDeg2Rad(d) { return d * Math.PI / 180; }
function bgRad2Deg(r) { return r * 180 / Math.PI; }

// Equatorial J2000 -> Galactic latitude (deg)
function bgGalacticLatitude(raDeg, decDeg)
{
   var ra = bgDeg2Rad(raDeg), dec = bgDeg2Rad(decDeg);
   var raGP = bgDeg2Rad(192.85948), decGP = bgDeg2Rad(27.12825);
   var sinb = Math.sin(dec) * Math.sin(decGP) + Math.cos(dec) * Math.cos(decGP) * Math.cos(ra - raGP);
   return bgRad2Deg(Math.asin(Math.max(-1, Math.min(1, sinb))));
}

function bgAngularDistance(ra1, dec1, ra2, dec2)
{
   var a = bgDeg2Rad(ra1), b = bgDeg2Rad(dec1), c = bgDeg2Rad(ra2), d = bgDeg2Rad(dec2);
   var cosd = Math.sin(b) * Math.sin(d) + Math.cos(b) * Math.cos(d) * Math.cos(a - c);
   return bgRad2Deg(Math.acos(Math.max(-1, Math.min(1, cosd))));
}

// Image pixel -> {ra, dec} in degrees via the image's astrometric solution, or null
function bgPixelToSky(win, x, y)
{
   try {
      var p = win.imageToCelestial(new Point(x, y));
      if (p && isFinite(p.x) && isFinite(p.y))
         return { ra: p.x, dec: p.y };
   } catch (e) {}
   return null;
}

// --- IRSA download + FITS --------------------------------------------------------

// Seconds before a dust map download gives up: connecting, and the whole
// transfer. Without a limit a hanging server would freeze PixInsight.
var BG_CONNECT_TIMEOUT_S  = 15;
var BG_DOWNLOAD_TIMEOUT_S = 30;

function bgDownloadToFile(url, path)
{
   var f = new File;
   f.createForWriting(path);
   var transfer = new NetworkTransfer;
   transfer.setURL(url);
   transfer.setConnectionTimeout(BG_CONNECT_TIMEOUT_S);
   if (typeof transfer.setSSL === "function")
      transfer.setSSL(true);
   transfer.onDownloadDataAvailable = function(data)
   {
      f.write(data);
      return true;
   };
   // Called repeatedly during the transfer, also while no data arrives;
   // returning false aborts it.
   var t0 = Date.now(), timedOut = false;
   transfer.onTransferProgress = function(dlTotal, dlCurrent, ulTotal, ulCurrent)
   {
      if (Date.now() - t0 > BG_DOWNLOAD_TIMEOUT_S * 1000)
      {
         timedOut = true;
         return false;
      }
      return true;
   };
   var ok = transfer.download();
   f.close();
   if (timedOut)
      throw new Error("The dust map service (NASA/IPAC IRSA) did not answer within " +
                      BG_DOWNLOAD_TIMEOUT_S + " s. Try again later.");
   if (!ok)
      throw new Error("Download failed: " + transfer.errorInformation);
   if (transfer.responseCode !== undefined && transfer.responseCode >= 400)
      throw new Error("HTTP error " + transfer.responseCode);
}

// Minimal FITS reader for IRSA's 2-D float cutouts. Parsed by hand so the
// result does not depend on PixInsight's FITS orientation preferences.
function bgParseFITS(path)
{
   var ba = File.readFile(path);
   var n = ba.length;
   var u8 = new Uint8Array(n);
   for (var i = 0; i < n; i++)
      u8[i] = ba[i];

   var hdr = {}, pos = 0, done = false;
   while (pos + 80 <= n) {
      var card = "";
      for (var k = 0; k < 80; k++)
         card += String.fromCharCode(u8[pos + k]);
      pos += 80;
      var key = card.substring(0, 8).trim();
      if (key === "END") { done = true; break; }
      if (card.charAt(8) === "=") {
         var v = card.substring(10);
         if (v.indexOf("'") < 0 && v.indexOf("/") >= 0)
            v = v.substring(0, v.indexOf("/"));
         hdr[key] = v.trim().replace(/^'|'$/g, "").trim();
      }
   }
   if (!done)
      throw new Error("FITS header END not found");

   var bitpix = parseInt(hdr["BITPIX"]), nx = parseInt(hdr["NAXIS1"]), ny = parseInt(hdr["NAXIS2"]);
   if (bitpix !== -64 && bitpix !== -32)
      throw new Error("Unexpected FITS BITPIX " + bitpix);
   if (String(hdr["CTYPE1"]).indexOf("TAN") < 0 || String(hdr["CTYPE2"]).indexOf("TAN") < 0)
      throw new Error("Unexpected FITS projection " + hdr["CTYPE1"] + "/" + hdr["CTYPE2"]);
   var bytes = Math.abs(bitpix) / 8;
   var dataStart = Math.ceil(pos / 2880) * 2880;
   if (dataStart + nx * ny * bytes > n)
      throw new Error("FITS file truncated");

   var dv = new DataView(u8.buffer, dataStart, nx * ny * bytes);
   var data = new Float64Array(nx * ny);
   for (var p = 0; p < nx * ny; p++)
      data[p] = bitpix === -64 ? dv.getFloat64(p * 8, false) : dv.getFloat32(p * 4, false);

   return {
      nx: nx, ny: ny, data: data,
      crval1: parseFloat(hdr["CRVAL1"]), crval2: parseFloat(hdr["CRVAL2"]),
      crpix1: parseFloat(hdr["CRPIX1"]), crpix2: parseFloat(hdr["CRPIX2"]),
      cdelt1: parseFloat(hdr["CDELT1"]), cdelt2: parseFloat(hdr["CDELT2"])
   };
}

// Map value at (ra, dec) via the gnomonic (TAN) projection, bilinear. NaN if outside.
function bgFitsValueAt(fits, raDeg, decDeg)
{
   var ra = bgDeg2Rad(raDeg), dec = bgDeg2Rad(decDeg);
   var ra0 = bgDeg2Rad(fits.crval1), dec0 = bgDeg2Rad(fits.crval2);
   var cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(ra - ra0);
   if (cosc <= 0)
      return NaN;
   var xi  = bgRad2Deg(Math.cos(dec) * Math.sin(ra - ra0) / cosc);
   var eta = bgRad2Deg((Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(ra - ra0)) / cosc);
   // FITS 1-based pixel -> 0-based array index
   var px = fits.crpix1 + xi / fits.cdelt1 - 1;
   var py = fits.crpix2 + eta / fits.cdelt2 - 1;
   var x0 = Math.floor(px), y0 = Math.floor(py);
   if (x0 < 0 || y0 < 0 || x0 + 1 >= fits.nx || y0 + 1 >= fits.ny)
      return NaN;
   var fx = px - x0, fy = py - y0, d = fits.data, w = fits.nx;
   return (1 - fx) * (1 - fy) * d[y0 * w + x0] + fx * (1 - fy) * d[y0 * w + x0 + 1] +
          (1 - fx) * fy * d[(y0 + 1) * w + x0] + fx * fy * d[(y0 + 1) * w + x0 + 1];
}

// Queries IRSA and samples the E(B-V) map over a 3x3 grid of the image.
// Returns report text. Throws on failure.
function bgDustReport(win)
{
   var img = win.mainView.image, W = img.width, H = img.height;

   var c = bgPixelToSky(win, W / 2, H / 2);
   var c00 = bgPixelToSky(win, 0, 0), c11 = bgPixelToSky(win, W, H);
   var c10 = bgPixelToSky(win, W, 0), c01 = bgPixelToSky(win, 0, H);
   if (!c || !c00 || !c11 || !c10 || !c01)
      throw new Error("Image coordinates could not be computed from the astrometric solution.");
   var diag = Math.max(bgAngularDistance(c00.ra, c00.dec, c11.ra, c11.dec),
                       bgAngularDistance(c10.ra, c10.dec, c01.ra, c01.dec));
   // IRSA accepts region sizes of 2..37.5 deg; the cutout must cover the whole frame
   var regSize = Math.min(37.5, Math.max(2.0, diag * 1.15));

   var stamp = (new Date()).getTime();
   var tmp = File.systemTempDirectory + "/SH_dust_" + stamp;
   var url = IRSA_DUST_URL + "?locstr=" + c.ra.toFixed(5) + "+" + c.dec.toFixed(5) +
             "+equ+j2000&regSize=" + regSize.toFixed(2);
   // the console treats '&' as markup, so escape it for display only
   console.writeln("Querying IRSA dust service: " + url.replace(/&/g, "&amp;"));
   bgDownloadToFile(url, tmp + ".xml");
   var xml = File.readTextFile(tmp + ".xml");
   try { File.remove(tmp + ".xml"); } catch (e) {}

   var status = /<results\s+status\s*=\s*"([^"]*)"/i.exec(xml);
   if (!status || status[1].toLowerCase() !== "ok") {
      console.warningln("IRSA response (first 500 chars): " + xml.substring(0, 500));
      throw new Error("IRSA did not return a valid result.");
   }
   var fitsUrl = null, refSFD = NaN;
   var blocks = xml.split(/<result>/i);
   for (var i = 1; i < blocks.length; i++) {
      var desc = /<desc>([\s\S]*?)<\/desc>/i.exec(blocks[i]);
      if (desc && desc[1].toLowerCase().indexOf("reddening") >= 0) {
         var im = /<image>\s*(\S+?)\s*<\/image>/i.exec(blocks[i]);
         if (im) fitsUrl = im[1];
         var rv = /<refPixelValueSFD>\s*([-+0-9.eE]+)/i.exec(blocks[i]);
         if (rv) refSFD = parseFloat(rv[1]);
      }
   }
   if (!fitsUrl)
      throw new Error("IRSA response contained no E(B-V) map.");

   console.writeln("Downloading dust map: " + fitsUrl);
   bgDownloadToFile(fitsUrl, tmp + ".fits");
   var fits;
   try {
      fits = bgParseFITS(tmp + ".fits");
   } finally {
      try { File.remove(tmp + ".fits"); } catch (e) {}
   }

   // 3x3 grid, 5x5 samples per cell, as the image is displayed (row 0 = top)
   var grid = [], gmin = Infinity, gmax = -Infinity, minName = "", maxName = "";
   var rowNames = ["top", "middle", "bottom"], colNames = ["left", "centre", "right"];
   for (var gy = 0; gy < 3; gy++) {
      grid[gy] = [];
      for (var gx = 0; gx < 3; gx++) {
         var sum = 0, cnt = 0;
         for (var sy = 0; sy < 5; sy++)
            for (var sx = 0; sx < 5; sx++) {
               var s = bgPixelToSky(win, (gx + (sx + 0.5) / 5) / 3 * W, (gy + (sy + 0.5) / 5) / 3 * H);
               if (!s) continue;
               var v = bgFitsValueAt(fits, s.ra, s.dec);
               if (isFinite(v)) { sum += v; cnt++; }
            }
         var m = cnt > 0 ? sum / cnt : NaN;
         grid[gy][gx] = m;
         var name = (gy === 1 && gx === 1) ? "centre" : rowNames[gy] + " " + colNames[gx];
         if (isFinite(m) && m < gmin) { gmin = m; minName = name; }
         if (isFinite(m) && m > gmax) { gmax = m; maxName = name; }
      }
   }
   if (!isFinite(gmin))
      throw new Error("Dust map does not cover the image.");

   var centre = isFinite(grid[1][1]) ? grid[1][1] : refSFD;
   var level = IFN_LEVELS[IFN_LEVELS.length - 1];
   for (var i = 0; i < IFN_LEVELS.length; i++)
      if (centre < IFN_LEVELS[i].max) { level = IFN_LEVELS[i]; break; }
   var b = bgGalacticLatitude(c.ra, c.dec);
   var ratio = gmin > 0 ? gmax / gmin : Infinity;

   // Finer map for the picture in the pre-check dialog, same orientation as the image
   var mapCols = 60, mapRows = Math.max(8, Math.min(90, Math.round(60 * H / W)));
   var mapVals = new Float64Array(mapCols * mapRows), mmin = Infinity, mmax = -Infinity;
   for (var my = 0; my < mapRows; my++)
      for (var mx = 0; mx < mapCols; mx++) {
         var s = bgPixelToSky(win, (mx + 0.5) / mapCols * W, (my + 0.5) / mapRows * H);
         var v = s ? bgFitsValueAt(fits, s.ra, s.dec) : NaN;
         mapVals[my * mapCols + mx] = v;
         if (isFinite(v)) { if (v < mmin) mmin = v; if (v > mmax) mmax = v; }
      }

   var G = [];
   G.push("Dust map E(B-V), SFD 1998 (~6' resolution)");
   G.push("3x3 areas as the image is displayed:");
   G.push("");
   for (var gy = 0; gy < 3; gy++) {
      var row = "   ";
      for (var gx = 0; gx < 3; gx++) {
         var v = grid[gy][gx];
         var t = (isFinite(v) ? v.toFixed(3) : "n/a") + (isFinite(v) && v === gmax ? "*" : " ");
         row += ("          " + t).slice(-10);
      }
      G.push(row);
   }
   G.push("   (* = dustiest)");
   G.push("");

   var L = [];
   L.push("IFN expectation : " + level.name.toUpperCase() + "  (centre " + centre.toFixed(3) + " mag)");
   L.push("                  " + level.note);
   L.push("Dustiest area   : " + maxName + " (" + gmax.toFixed(3) + ")");
   L.push("Clearest area   : " + minName + " (" + gmin.toFixed(3) + ")");
   L.push("Contrast        : " + (isFinite(ratio) ? ratio.toFixed(2) + "x" : "n/a"));
   if (gmax < BG_FINDER.dustMinPeak)
      L.push("  Very little dust anywhere in the frame; an exclusion zone is unlikely to help.");
   else if (ratio >= 1.4)
      L.push("  Clear difference across the frame. If faint cirrus is visible in the " + maxName + ",");
   else if (ratio >= 1.15)
      L.push("  Moderate difference across the frame. If faint cirrus is visible in the " + maxName + ",");
   if (gmax >= BG_FINDER.dustMinPeak) {
      if (ratio >= 1.15)
         L.push("  consider Cancel, an Exclude preview over it, and run again.");
      else
         L.push("  Dust is fairly even across the frame; an exclusion zone is unlikely to help.");
   }
   if (Math.abs(b) < 10)
      L.push("Galactic latitude " + b.toFixed(1) + " deg: near the Milky Way plane the map is less reliable.");
   L.push("");
   L.push("Source: NASA/IPAC IRSA Dust service; Schlegel, Finkbeiner and Davis 1998.");
   L.push("Thresholds are rules of thumb, not hard limits.");
   return {
      text: L.join("\n"),                        // dialog (the picture replaces the 3x3 table)
      consoleText: G.join("\n") + "\n" + L.join("\n"),
      // lo/hi = 2nd/98th percentile: robust stretch, so a few hot spots (common near the
      // Milky Way plane) don't flatten the rest of the map
      map: { cols: mapCols, rows: mapRows, vals: mapVals, min: mmin, max: mmax,
             lo: bgPercentile(mapVals, 0.02), hi: bgPercentile(mapVals, 0.98) },
      contrast: ratio,                           // 3x3 dustiest / clearest
      peak: gmax,                                // dustiest 3x3 area, E(B-V) mag
      galLat: b
   };
}

// p-quantile (0..1) of the finite values in an array
function bgPercentile(vals, p)
{
   var a = [];
   for (var i = 0; i < vals.length; i++) if (isFinite(vals[i])) a.push(vals[i]);
   if (a.length === 0) return NaN;
   a.sort(function (x, y) { return x - y; });
   return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
}

// Relative dust 0..1 of a map value, using the robust lo/hi stretch
function bgRelDust(m, v)
{
   var span = m.hi - m.lo;
   if (!isFinite(v) || !(span > 0)) return NaN;
   return Math.max(0, Math.min(1, (v - m.lo) / span));
}

// Colour ramp for the dust picture (dark = least dust, bright = most), inferno-like
var BG_DUST_RAMP = [[0, 0, 4], [87, 16, 110], [188, 55, 84], [249, 142, 9], [252, 255, 164]];

function bgDustColor(t)
{
   if (!isFinite(t)) return 0xff808080;
   t = Math.max(0, Math.min(1, t)) * (BG_DUST_RAMP.length - 1);
   var k = Math.min(Math.floor(t), BG_DUST_RAMP.length - 2), f = t - k;
   var a = BG_DUST_RAMP[k], b = BG_DUST_RAMP[k + 1];
   var r = Math.round(a[0] + f * (b[0] - a[0])), g = Math.round(a[1] + f * (b[1] - a[1])),
       bl = Math.round(a[2] + f * (b[2] - a[2]));
   return (0xff000000 | (r << 16) | (g << 8) | bl) >>> 0;
}

// --- dialog -----------------------------------------------------------------------

var BgPrecheckDialog = class extends Dialog
{
   constructor(win, info)
   {
      super();
      var dlg = this;
      this.win = win;

      this.windowTitle = "SPACE HUNTER - Background Pre-check";

      this.intro_Label = new Label(this);
      this.intro_Label.useRichText = true;
      this.intro_Label.wordWrapping = true;
      this.intro_Label.minWidth = 60 * this.font.width('M');
      this.intro_Label.text =
         "<p><b>Before processing starts:</b> the background finder avoids dark nebulae on its own. " +
         "Faint IFN / cirrus can still pull the background pick &mdash; if your image shows it, add a " +
         "preview over it named <b>Exclude</b> (Exclude1, Exclude2, ...).</p>";

      this.previews_Label = new Label(this);
      this.previews_Label.useRichText = true;
      this.previews_Label.wordWrapping = true;
      this.previews_Label.frameStyle = FrameStyle.Box;
      this.previews_Label.margin = 6;
      this.previews_Label.text = previewInfoHtml(info);

      this.dust_Box = new TextBox(this);
      this.dust_Box.readOnly = true;
      this.dust_Box.styleSheet = "* { font-family: monospace; }";
      this.dust_Box.setMinSize(56 * this.font.width('M'), 13 * this.font.lineSpacing);

      // Dust map picture, same orientation and aspect ratio as the image.
      // Exclude previews are outlined in green, other previews in orange.
      this.info = info;
      this.dustMap = null;
      var img = win.mainView.image;
      var mapW = 300, mapH = Math.round(300 * img.height / img.width);
      if (mapH > 240) { mapW = Math.round(mapW * 240 / mapH); mapH = 240; }
      this.dustMap_Control = new Control(this);
      this.dustMap_Control.setScaledFixedSize(mapW, mapH);
      this.dustMap_Control.toolTip = "<p>Dust map over your frame as displayed. Dark = least dust, " +
         "bright = most dust (relative to this frame). Green = Exclude previews, orange = other previews.</p>";
      this.dustMap_Control.onPaint = function()
      {
         var g = new Graphics(this);
         var w = this.width, h = this.height, m = dlg.dustMap;
         if (!m) {
            g.fillRect(0, 0, w, h, new Brush(0xff303030));
            g.pen = new Pen(0xffa0a0a0);
            g.drawText(8, h / 2, "No dust map yet");
         } else {
            for (var j = 0; j < m.rows; j++)
               for (var i = 0; i < m.cols; i++) {
                  var t = bgRelDust(m, m.vals[j * m.cols + i]);
                  g.fillRect(Math.floor(i * w / m.cols), Math.floor(j * h / m.rows),
                             Math.floor((i + 1) * w / m.cols), Math.floor((j + 1) * h / m.rows),
                             new Brush(bgDustColor(t)));
               }
            // 3x3 areas used in the text
            g.pen = new Pen(0x60ffffff);
            for (var k = 1; k < 3; k++) {
               g.drawLine(Math.round(k * w / 3), 0, Math.round(k * w / 3), h);
               g.drawLine(0, Math.round(k * h / 3), w, Math.round(k * h / 3));
            }
            var drawPreviews = function(list, color)
            {
               g.pen = new Pen(color, 2);
               for (var p = 0; p < list.length; p++) {
                  var e = list[p];
                  g.drawRect(Math.round(e.fx0 * w), Math.round(e.fy0 * h),
                             Math.round(e.fx1 * w), Math.round(e.fy1 * h));
               }
            };
            drawPreviews(dlg.info.excludes, 0xff40ff40);
            drawPreviews(dlg.info.others, 0xffffa020);
         }
         g.end();
      };

      this.dustLegend_Label = new Label(this);
      this.dustLegend_Label.wordWrapping = true;
      // reserve two lines now; the label is sized before the legend text is known
      this.dustLegend_Label.setFixedHeight(2 * this.font.lineSpacing + 4);
      this.dustLegend_Label.text = "";

      this.dustMap_Sizer = new VerticalSizer;
      this.dustMap_Sizer.spacing = 4;
      this.dustMap_Sizer.add(this.dustMap_Control);
      this.dustMap_Sizer.add(this.dustLegend_Label);
      this.dustMap_Sizer.addStretch();

      this.dust_Sizer = new HorizontalSizer;
      this.dust_Sizer.spacing = 8;
      this.dust_Sizer.add(this.dustMap_Sizer);
      this.dust_Sizer.add(this.dust_Box, 100);

      this.hasSolution = false;
      try { this.hasSolution = win.hasAstrometricSolution; } catch (e) {}
      this.dust_Box.text = this.hasSolution ?
         "Optional: 'Check dust map' queries an online dust map (NASA/IPAC IRSA, internet\n" +
         "required) and shows where in the frame dust / IFN is expected." :
         "Dust map not available: this image has no astrometric solution.";

      this.dontShow_CheckBox = new CheckBox(this);
      this.dontShow_CheckBox.text = "Don't show this pre-check again (re-enable under Find Background)";

      // Let the background finder avoid the dustier part of the frame.
      // Available after a successful dust check; default on only when the map is meaningful.
      this.dustResult = null;
      this.useDust_CheckBox = new CheckBox(this);
      this.useDust_CheckBox.text = "Use dust map in the background pick";
      this.useDust_CheckBox.enabled = false;
      this.useDust_CheckBox.checked = false;
      this.useDust_CheckBox.toolTip = "<p>The background finder sets aside tiles in the dustier half of the " +
         "frame (per the dust map) and slightly penalises dust in the rest &mdash; like an automatic Exclude " +
         "preview. Ticked by default when the dustiest area reaches E(B-V) &ge; " + BG_FINDER.dustMinPeak +
         ", the map shows real contrast (&ge; " + BG_FINDER.dustMinContrast +
         "x) and the field is away from the Milky Way plane (|b| &ge; " + BG_FINDER.dustMinAbsLat + "&deg;).</p>";

      this.cancel_Button = new PushButton(this);
      this.cancel_Button.text = "Cancel";
      this.cancel_Button.icon = this.scaledResource(":/icons/cancel.png");
      this.cancel_Button.toolTip = "<p>Stop here. Nothing has been processed yet.</p>";
      this.cancel_Button.onClick = function() { dlg.cancel(); };

      this.dust_Button = new PushButton(this);
      this.dust_Button.text = "Check dust map";
      this.dust_Button.enabled = this.hasSolution;
      this.dust_Button.toolTip = "<p>Query the IRSA dust map (internet required) for this image's field. " +
         "The result appears below; you then choose Cancel or Continue.</p>";
      this.dust_Button.onClick = function() { dlg.checkDust(); };

      this.continue_Button = new PushButton(this);
      this.continue_Button.text = "Continue";
      this.continue_Button.icon = this.scaledResource(":/icons/ok.png");
      this.continue_Button.toolTip = "<p>Start the workflow. It then runs through without further questions.</p>";
      this.continue_Button.onClick = function() { dlg.ok(); };

      this.buttons_Sizer = new HorizontalSizer;
      this.buttons_Sizer.spacing = 6;
      this.buttons_Sizer.add(this.dontShow_CheckBox);
      this.buttons_Sizer.addStretch();
      this.buttons_Sizer.add(this.cancel_Button);
      this.buttons_Sizer.add(this.dust_Button);
      this.buttons_Sizer.add(this.continue_Button);

      this.sizer = new VerticalSizer;
      this.sizer.margin = 8;
      this.sizer.spacing = 6;
      this.sizer.add(this.intro_Label);
      this.sizer.add(this.previews_Label);
      this.sizer.add(this.dust_Sizer, 100);
      this.sizer.add(this.useDust_CheckBox);
      this.sizer.add(this.buttons_Sizer);

      this.adjustToContents();
   }

   checkDust()
   {
      this.dust_Button.enabled = false;
      this.dust_Box.text = "Querying IRSA dust service...";
      CoreApplication.processEvents();
      var text;
      try {
         var r = bgDustReport(this.win);
         console.writeln("\n" + r.consoleText + "\n");
         text = r.text;
         this.dustMap = r.map;
         this.dustResult = r;
         this.dustLegend_Label.text = "Dark = least dust (≤ " + r.map.lo.toFixed(3) + ")\n" +
                                      "Bright = most dust (≥ " + r.map.hi.toFixed(3) +
                                      "; peak " + r.map.max.toFixed(2) + ")";
         this.dustMap_Control.update();
         var reason = "";
         if (Math.abs(r.galLat) < BG_FINDER.dustMinAbsLat)
            reason = "near the Milky Way plane, |b| = " + Math.abs(r.galLat).toFixed(1) + "°";
         else if (r.peak < BG_FINDER.dustMinPeak)
            reason = "very little dust anywhere in the frame (max " + r.peak.toFixed(3) + ")";
         else if (r.contrast < BG_FINDER.dustMinContrast)
            reason = "dust is fairly even";
         this.useDust_CheckBox.enabled = true;
         this.useDust_CheckBox.checked = (reason === "");
         this.useDust_CheckBox.text = "Use dust map in the background pick" +
            (reason === "" ? "" : "  (off by default: " + reason + ")");
         this.adjustToContents();
      } catch (e) {
         text = "Dust map query failed: " + e.message +
                "\n\nYou can still Continue; the background finder does not need it.";
         console.warningln("Dust map query failed: " + e.message);
         this.dust_Button.enabled = true;
      }
      this.dust_Box.text = text;
   }
};

// Returns false if the user cancelled.
function runBackgroundPrecheck()
{
   var win = ImageWindow.activeWindow;
   var info = collectPreviewInfo(win);
   if (!bgPrecheckNeeded(info)) {
      console.writeln("Background pre-check: " + info.excludes.length +
                      " Exclude preview(s), no leftover previews - dialog skipped.\n");
      return true;
   }
   var dialog = new BgPrecheckDialog(win, info);
   var accepted = dialog.execute();
   if (accepted && dialog.dustResult && dialog.useDust_CheckBox.checked) {
      BG_DUST_INPUT = dialog.dustResult;
      console.writeln("Dust map will be used in the background pick (contrast " +
                      dialog.dustResult.contrast.toFixed(2) + "x, |b| = " +
                      Math.abs(dialog.dustResult.galLat).toFixed(1) + " deg).");
   }
   if (dialog.dontShow_CheckBox.checked) {
      WorkflowParameters.enableBgPrecheck = false;
      WorkflowParameters.saveUserPrefs();
      console.writeln("Background pre-check disabled for future runs (re-enable under Find Background).");
   }
   return accepted;
}

// ============================================================
// STEP 3: Background Finder (v2.3 - deterministic tiled finder)
// ============================================================
//
// Replaces the v2.2 random gradient-descent finder, which ranked by mean
// brightness and often ended on frame edges or in dark nebulae. Developed with
// the R&D harness Test_DarkestBackground.js (v0.3, "target" mode).
//
// 1. The frame minus a 3% border is cut into non-overlapping tiles
//    (same size as v2.2: min(5% of height, 50) px).
// 2. Every tile, per channel, with native statistics: median, noise
//    (1.4826 x MAD) and skew = (mean - median) / noise, a star/galaxy proxy.
//    Tiles above an adaptive skew limit are rejected.
// 3. Target level = 10th percentile of the clean tiles' medians. The tiles
//    nearest that level (not the darkest: those are usually dark nebulae or
//    over-corrected holes) get a flatness check, a "differs from its
//    surroundings" check and an edge penalty.
// 4. The lowest score becomes the "Background" preview.

var BG_FINDER = {
   edgeMarginFrac: 0.03,  // skip this fraction of width/height at each border
   candidateFrac:  0.20,  // stage 2 for the 20% of clean tiles closest to the target level
   maxSkew:        0.30,  // skew limit = max(maxSkew, skewKeepFrac percentile of this image)
   skewKeepFrac:   0.50,
   maxGrad:        1.00,  // reject: quadrant-median spread / noise, worst channel
   targetPct:      0.10,  // target level percentile of clean tiles
   wDark:          1.0,   // distance from target level, in typical-noise units
   wSkew:          1.5,
   wGrad:          5.0,
   wDip:           2.0,   // tile differs from the surrounding ring of tiles
   wEdge:          1.0,   // radial distance beyond 70% of half-diagonal
   // Dust map (only when chosen in the pre-check). Tile dust d = 0..1 relative to
   // the frame's least/most dusty spot. Tiles above the dustKeepFrac percentile of d are
   // set aside; the rest get wDust * d added to their score.
   dustMinContrast: 1.15, // default-on only if 3x3 dustiest/clearest >= this ...
   dustMinAbsLat:   10,   // ... and |Galactic latitude| >= this (SFD less reliable in the plane)
   dustMinPeak:     0.05, // ... and the dustiest 3x3 area reaches "Moderate" E(B-V) (a ratio alone
                          //     can't tell 0.045 vs 0.025 - nearly no dust - from real contrast)
   dustKeepFrac:    0.50,
   wDust:           2.0
};

// Set by the pre-check when the user chose to use the dust map
var BG_DUST_INPUT = null;

function calculateWindowSize(imageHeight) {
    return Math.min(Math.round(imageHeight * 0.05), 50);
}

function bgMedianOf(a) {
    if (a.length === 0) return NaN;
    var s = a.slice().sort(function (p, q) { return p - q; });
    var n = s.length;
    return n % 2 ? s[(n - 1) >> 1] : 0.5 * (s[n / 2 - 1] + s[n / 2]);
}

function bgOverlapsAny(x0, y0, x1, y1, rects) {
    for (var i = 0; i < rects.length; i++) {
        var r = rects[i];
        if (x1 > r.x0 && x0 < r.x1 && y1 > r.y0 && y0 < r.y1) return true;
    }
    return false;
}

function bgRectMedian(img, rect, c) {
    img.selectedRect = rect;
    img.selectedChannel = c;
    return img.median();
}

// dust = result of bgDustReport() to avoid dusty areas, or null
function findBackgroundTile(img, rects, dust) {
    var P = BG_FINDER;
    var W = img.width, H = img.height, nc = Math.min(img.numberOfChannels, 3);
    var ts = calculateWindowSize(H), half = ts >> 1;
    var mx = Math.round(W * P.edgeMarginFrac), my = Math.round(H * P.edgeMarginFrac);
    var nx = Math.floor((W - 2 * mx) / ts), ny = Math.floor((H - 2 * my) / ts);
    var cxImg = W / 2, cyImg = H / 2, halfDiag = Math.sqrt(cxImg * cxImg + cyImg * cyImg);

    // ---- stage 1: statistics for every tile ----
    var grid = [], tiles = [];
    for (var j = 0; j < ny; j++) {
        grid[j] = [];
        if (console.abortRequested) { img.resetSelections(); throw new Error("Script cancelled by user."); }
        for (var i = 0; i < nx; i++) {
            var x0 = mx + i * ts, y0 = my + j * ts;
            var t = { i: i, j: j, x: x0, y: y0, med: [], noise: [], reject: "",
                      L: NaN, N: NaN, skew: NaN, grad: NaN, dip: NaN, edge: NaN, dDark: NaN, score: NaN,
                      dust: NaN };
            if (bgOverlapsAny(x0, y0, x0 + ts, y0 + ts, rects)) {
                t.reject = "exclude";
            } else {
                img.selectedRect = new Rect(x0, y0, x0 + ts, y0 + ts);
                var L = 0, N = 0, skew = -1e9;
                for (var c = 0; c < nc; c++) {
                    img.selectedChannel = c;
                    var med = img.median();
                    var noise = 1.4826 * img.MAD(med);
                    var mean = img.mean();
                    t.med.push(med); t.noise.push(noise);
                    var sk = noise > 0 ? (mean - med) / noise : 1e9;
                    L += med; N += noise; if (sk > skew) skew = sk;
                }
                t.L = L / nc; t.N = N / nc; t.skew = skew;
                if (!(t.N > 0)) t.reject = "blank";
            }
            grid[j][i] = t; tiles.push(t);
        }
    }

    // adaptive skew limit, so dense Milky Way fields don't leave only dust-dimmed tiles
    var skews = [];
    for (var k = 0; k < tiles.length; k++) if (tiles[k].reject === "") skews.push(tiles[k].skew);
    skews.sort(function (a, b) { return a - b; });
    var skewLimit = Math.max(P.maxSkew, skews.length ? skews[Math.floor((skews.length - 1) * P.skewKeepFrac)] : 0);
    for (var k = 0; k < tiles.length; k++)
        if (tiles[k].reject === "" && tiles[k].skew > skewLimit) tiles[k].reject = "skew";

    // dust map: set aside the dustier part of the frame, before the target level is taken
    var dustLimit = NaN, nDust = 0;
    if (dust) {
        var m = dust.map, ds = [];
        for (var k = 0; k < tiles.length; k++) {
            var t = tiles[k];
            if (t.reject !== "") continue;
            var ci = Math.min(m.cols - 1, Math.floor((t.x + half) / W * m.cols));
            var cj = Math.min(m.rows - 1, Math.floor((t.y + half) / H * m.rows));
            var v = m.vals[cj * m.cols + ci];
            t.dust = bgRelDust(m, v);
            if (isFinite(t.dust)) ds.push(t.dust);
        }
        ds.sort(function (a, b) { return a - b; });
        if (ds.length > 0) {
            dustLimit = ds[Math.floor((ds.length - 1) * P.dustKeepFrac)];
            for (var k = 0; k < tiles.length; k++)
                if (tiles[k].reject === "" && tiles[k].dust > dustLimit) { tiles[k].reject = "dust"; nDust++; }
        }
    }

    var noises = [];
    for (var k = 0; k < tiles.length; k++) if (tiles[k].N > 0) noises.push(tiles[k].N);
    var Ntyp = bgMedianOf(noises);

    var surv = tiles.filter(function (t) { return t.reject === ""; });
    if (surv.length === 0) {
        img.resetSelections();
        throw new Error("Background finder: no usable tile found. Tiles=" + tiles.length +
                        " (all covered by Exclude previews, blank, or star-filled). Check your Exclude previews.");
    }

    // ---- stage 2: candidates closest to the target level ----
    surv.sort(function (a, b) { return a.L - b.L; });
    var Ltarget = surv[Math.floor((surv.length - 1) * P.targetPct)].L;
    surv.sort(function (a, b) { return Math.abs(a.L - Ltarget) - Math.abs(b.L - Ltarget); });
    var nCand = Math.max(15, Math.ceil(surv.length * P.candidateFrac));
    var cand = surv.slice(0, Math.min(nCand, surv.length));

    for (var q = 0; q < cand.length; q++) {
        var t = cand[q];
        // flatness: spread of quadrant medians, worst channel, in noise units
        var g = 0;
        for (var c = 0; c < nc; c++) {
            var qm = [
                bgRectMedian(img, new Rect(t.x, t.y, t.x + half, t.y + half), c),
                bgRectMedian(img, new Rect(t.x + half, t.y, t.x + ts, t.y + half), c),
                bgRectMedian(img, new Rect(t.x, t.y + half, t.x + half, t.y + ts), c),
                bgRectMedian(img, new Rect(t.x + half, t.y + half, t.x + ts, t.y + ts), c)
            ];
            var gc = (Math.max.apply(null, qm) - Math.min.apply(null, qm)) / t.noise[c];
            if (gc > g) g = gc;
        }
        t.grad = g;
        // dip: differs from the ring of clean tiles at distance 2..3
        var ring = [];
        for (var dj = -3; dj <= 3; dj++)
            for (var di = -3; di <= 3; di++) {
                if (Math.max(Math.abs(di), Math.abs(dj)) < 2) continue;
                var jj = t.j + dj, ii = t.i + di;
                if (jj < 0 || jj >= ny || ii < 0 || ii >= nx) continue;
                var u = grid[jj][ii];
                if (u.reject === "") ring.push(u.L);
            }
        var ringMed = ring.length >= 4 ? bgMedianOf(ring) : NaN;
        t.dip = isNaN(ringMed) ? 0 : Math.abs(ringMed - t.L) / t.N;
        // edge: radial position beyond 70% of half-diagonal
        var rx = t.x + half - cxImg, ry = t.y + half - cyImg;
        t.edge = Math.max(0, Math.sqrt(rx * rx + ry * ry) / halfDiag - 0.7) / 0.3;
        if (t.grad > P.maxGrad) t.reject = "grad";
    }
    img.resetSelections();

    var ok = cand.filter(function (t) { return t.reject === ""; });
    var relaxed = false;
    if (ok.length === 0) {
        // nothing flat enough: fall back to the candidates, flatness still in the score
        ok = cand; relaxed = true;
    }
    for (var q = 0; q < ok.length; q++) {
        var t = ok[q];
        t.dDark = Math.abs(t.L - Ltarget) / Ntyp;
        t.score = P.wDark * t.dDark + P.wSkew * Math.max(0, t.skew) / skewLimit +
                  P.wGrad * t.grad + P.wDip * t.dip + P.wEdge * t.edge +
                  (isFinite(t.dust) ? P.wDust * t.dust : 0);
    }
    ok.sort(function (a, b) { return a.score - b.score; });

    return { best: ok[0], size: ts, nx: nx, ny: ny, nTiles: tiles.length, nSurv: surv.length,
             nCand: cand.length, nOk: relaxed ? 0 : ok.length, relaxed: relaxed,
             Ntyp: Ntyp, skewLimit: skewLimit, Ltarget: Ltarget,
             dustUsed: !!dust, dustLimit: dustLimit, nDust: nDust };
}

function findDarkestBackgroundPreview() {
    console.writeln("\n" + "=".repeat(80));
    console.writeln("STEP 3: Background Finder (tiled)");
    console.writeln("=".repeat(80) + "\n");

    var bgStartTime = Date.now();

    let win = ImageWindow.activeWindow;
    if (win.isNull)
        throw new Error("No active image window.");

    let img = win.mainView.image;

    // Exclude* previews are always honoured
    let exclusionRects = [];
    let previews = win.previews;
    for (let i = 0; i < previews.length; i++) {
        if (previews[i].id.indexOf("Exclude") === 0) {
            let r = win.previewRect(previews[i]);
            exclusionRects.push(r);
            console.writeln("Exclusion zone: " + previews[i].id +
                " [" + r.x0 + "," + r.y0 + " - " + r.x1 + "," + r.y1 + "]");
        }
    }
    console.writeln(exclusionRects.length > 0 ?
        "Total exclusion zones: " + exclusionRects.length + "\n" :
        "No exclusion previews (name must start with 'Exclude').\n");

    // Search first: if it fails, the user's Exclude previews are still there.
    let r = findBackgroundTile(img, exclusionRects, BG_DUST_INPUT);
    let t = r.best;

    // Then delete all existing previews (exclusion previews and any leftover MGC previews)
    let existing = win.previews;
    for (let i = existing.length - 1; i >= 0; i--)
        win.deletePreview(existing[i]);

    win.createPreview(new Rect(t.x, t.y, t.x + r.size, t.y + r.size), "Background");

    if (r.dustUsed)
        console.writeln("Dust map used: " + r.nDust + " tiles in the dustier part set aside " +
                        "(relative dust > " + r.dustLimit.toFixed(2) + "); pick dust = " +
                        (isFinite(t.dust) ? t.dust.toFixed(2) : "n/a") + "\n");

    console.writeln("Grid: " + r.nx + "x" + r.ny + " tiles of " + r.size + "x" + r.size + " px, " +
                    r.nSurv + " clean, " + r.nCand + " candidates, " + r.nOk + " passed flatness");
    console.writeln("Skew limit: " + r.skewLimit.toFixed(3) + "   Target level: " + r.Ltarget.toFixed(6) +
                    "   Typical noise: " + r.Ntyp.toFixed(6));
    if (r.relaxed)
        console.warningln("⚠ No candidate tile was flat enough; best available tile used.");
    console.writeln("\n===== RESULTS =====");
    console.writeln("\nPreview created: Background");
    console.writeln("Size: " + r.size + "x" + r.size + " pixels");
    console.writeln("  X: " + t.x + "  Y: " + t.y);
    console.writeln("  Level (median): " + t.L.toFixed(6) + "   Noise: " + t.N.toFixed(6));
    console.writeln("  Score: " + t.score.toFixed(3) + "  (level " + t.dDark.toFixed(3) + ", skew " + t.skew.toFixed(3) +
                    ", flatness " + t.grad.toFixed(3) + ", dip " + t.dip.toFixed(3) + ", edge " + t.edge.toFixed(3) +
                    (isFinite(t.dust) ? ", dust " + t.dust.toFixed(3) : "") + ")");
    if (t.med.length > 1)
        console.writeln("  Channel medians: R=" + t.med[0].toFixed(6) + " G=" + t.med[1].toFixed(6) +
                        " B=" + t.med[2].toFixed(6));

    var bgElapsed = (Date.now() - bgStartTime) / 1000;
    var bgMin = Math.floor(bgElapsed / 60);
    var bgSec = (bgElapsed % 60).toFixed(2);
    console.writeln(bgMin > 0 ? (bgMin + "m " + bgSec + "s") : (bgSec + "s"));
    console.writeln("✔ Background finder complete.\n");

    return true;
}

// ============================================================
// STEP 4: SPCC with Background ROI
// ============================================================

function runSPCC()
{
    let win = ImageWindow.activeWindow;
    if (win.isNull) throw new Error("No active image window.");
    let view = win.mainView;
    if (view.isNull) throw new Error("No active view.");

    console.writeln("\n" + "=".repeat(80));
    console.writeln("STEP 4: SPCC with Background ROI");
    console.writeln("=".repeat(80) + "\n");

    let backgroundPreview = null;
    let previews = win.previews;
    for (let i = 0; i < previews.length; i++) {
        if (previews[i].id === "Background") {
            backgroundPreview = previews[i];
            break;
        }
    }

    if (backgroundPreview === null)
        throw new Error("'Background' preview not found.");

    let rect = backgroundPreview.window.previewRect(backgroundPreview);
    let roiX0 = rect.x0, roiY0 = rect.y0, roiX1 = rect.x1, roiY1 = rect.y1;

    console.writeln("Background ROI: [" + roiX0 + "," + roiY0 + "]-[" + roiX1 + "," + roiY1 + "]\n");

    var wr = whiteRefList[WorkflowParameters.selectedWhiteRefIdx];
    var cam = cameraList[WorkflowParameters.selectedCameraIdx];
    var flt = filterList[WorkflowParameters.selectedFilterIdx];

    var whiteRefData = whiteRefDB[wr.name];
    if (!whiteRefData) throw new Error("White reference data not found: " + wr.name);

    var qeCurve = getFilterData(cam.xspdName, "Q");
    if (!qeCurve) throw new Error("Camera QE curve not found: " + cam.xspdName);

    var redData = null, greenData = null, blueData = null;

    if ( !WorkflowParameters.enableNarrowband ) {
        // Broadband mode — validate and load filter curves
        redData   = getFilterData(flt.redName, "R");
        greenData = getFilterData(flt.greenName, "G");
        blueData  = getFilterData(flt.blueName, "B");
        if (!redData)   throw new Error("Red filter not found: " + flt.redName);
        if (!greenData) throw new Error("Green filter not found: " + flt.greenName);
        if (!blueData)  throw new Error("Blue filter not found: " + flt.blueName);
        console.writeln("Equipment: " + wr.name + " | " + cam.xspdName + " | " + flt.label);
    } else {
        console.writeln("Equipment: " + wr.name + " | " + cam.xspdName + " | Narrowband mode");
        console.writeln("  Red:   " + WorkflowParameters.nbRedWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbRedBandwidth.toFixed(2) + " nm BW");
        console.writeln("  Green: " + WorkflowParameters.nbGreenWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbGreenBandwidth.toFixed(2) + " nm BW");
        console.writeln("  Blue:  " + WorkflowParameters.nbBlueWavelength.toFixed(2) + " nm / " + WorkflowParameters.nbBlueBandwidth.toFixed(2) + " nm BW");
    }
    console.writeln("Running SPCC on view: " + view.id + "\n");

    var flatCurve = "300,0,350,0,400,1,500,1,600,1,700,1,750,0,800,0";

    var P = new SpectrophotometricColorCalibration;
    P.applyCalibration = true;
    P.narrowbandMode = WorkflowParameters.enableNarrowband;
    P.narrowbandOptimizeStars = false;

    P.whiteReferenceSpectrum = whiteRefData;
    P.whiteReferenceName = wr.name;

    if ( WorkflowParameters.enableNarrowband ) {
        // Narrowband mode — flat placeholder curves, wavelength/bandwidth drives calibration
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
    } else {
        // Broadband mode — use filter curves from XSPD
        P.redFilterTrCurve   = redData;
        P.redFilterName      = flt.redName;
        P.greenFilterTrCurve = greenData;
        P.greenFilterName    = flt.greenName;
        P.blueFilterTrCurve  = blueData;
        P.blueFilterName     = flt.blueName;
    }

    P.deviceQECurve = qeCurve;
    P.deviceQECurveName = cam.xspdName;

    // Background neutralization reference = the "Background" preview.
    // v1.2-v2.2 set "P.backgroundROI", which is not an SPCC parameter: PJSR silently ignored
    // it, so SPCC neutralized against the whole image. The real parameters are below
    // (same names as SPCC's "Region of Interest" fields: left/top/right/bottom).
    P.neutralizeBackground = true;
    P.backgroundUseROI = true;
    P.backgroundROIX0 = roiX0;
    P.backgroundROIY0 = roiY0;
    P.backgroundROIX1 = roiX1;
    P.backgroundROIY1 = roiY1;

    P.broadbandIntegrationStepSize = 0.50;
    P.narrowbandIntegrationSteps = 10;
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
    P.psfType = SpectrophotometricColorCalibration.PSFType_Auto;
    P.psfGrowth = 1.75;
    P.psfMaxStars = 24576;
    P.psfSearchTolerance = 4.0;
    P.psfChannelSearchTolerance = 2.0;
    P.generateGraphs = WorkflowParameters.generateSPCCGraphs;
    P.generateStarMaps = false;
    P.generateTextFiles = false;
    P.outputDirectory = "";

    if (!P.executeOn(view)) {
        if (console.abortRequested)
            throw new Error("Script cancelled by user.");
        throw new Error("SPCC execution failed.");
    }

    // The graph window can't be minimized from a script; put the image back in
    // front of it instead so it is out of the way but still available.
    if (WorkflowParameters.generateSPCCGraphs) {
        win.bringToFront();
        CoreApplication.processEvents();
    }

    console.writeln("\u2714 SPCC completed successfully.\n");
}

// ============================================================
// STEP 4b: AutoColor - Background Neutralization + Color Calibration
//
// Based on AutoColor.js
// Copyright Hartmut V. Bornemann, 2016
// Image calibration by background evaluation and calculation of
// mean intensities over background of each channel, using
// BackgroundNeutralization and ColorCalibration processes.
// Integrated into Space Hunter Lazy Workflow with permission.
// Original copyright headers and author name preserved as required.
// ----------------------------------------------------------------------------
// V8 PORT NOTICE
// ----------------------------------------------------------------------------
// Ported to PixInsight 1.9.4 V8 JavaScript engine by Georg Albrecht
// (ggalbch@gmail.com) with additional packaging by Peter Proulx
// (peterproulx@gmail.com), Masters of PixInsight (www.mastersofpixinsight.com)
// July 2026. Original script copyright remains with Hartmut V. Bornemann.
// No rights to the original work are claimed or implied.
//
// V8 changes: added #engine v8 directive and version guard; replaced the
// single .prototype. enum reference (BackgroundNeutralization.prototype.
// TargetBackground -> BackgroundNeutralization.TargetBackground). Performance
// optimization by Georg Albrecht: uses Float64Array instead of a plain JS
// array for sky samples, giving faster sort and numeric operations on large
// images. No dialogs, with() statements, or legacy prototype patterns present.
// ----------------------------------------------------------------------------
// ============================================================

function runAutoColor()
{
   var win = ImageWindow.activeWindow;
   if ( win.isNull ) throw new Error( "No active image window." );

   var view = win.mainView;
   if ( view.isNull ) throw new Error( "No active view." );

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 4b: AutoColor - Background Neutralization + Color Calibration");
   console.writeln("=".repeat(80) + "\n");

   var img = view.image;
   if ( img.numberOfChannels !== 3 )
      throw new Error( "AutoColor requires a 3-channel RGB image." );

   var AC_ITERATIONS = 100;
   var strRGB = "RGB";

   console.writeln( format("Image size: %i x %i", img.width, img.height) );

   var subImage = new Image(img);
   var w = subImage.width;
   var h = subImage.height;

   if ( w > 256 && h > 255 )
   {
      subImage.cropTo( w * 0.1, h * 0.1, w * 0.9, h * 0.9 );
      console.writeln( format("Measure subframe: %i x %i", subImage.width, subImage.height) );
   }

   console.writeln( "Channel intensities over background:" );

   var S = [0, 0, 0];
   var I = [0, 0, 0];

   for ( var channel = 0; channel < 3; channel++ )
   {
      subImage.selectedChannel = channel;
      S[channel] = ac_ImageBackgroundMean( subImage, AC_ITERATIONS, 1 );
      I[channel] = subImage.mean() - S[channel];
      console.writeln( format("  %c  Intensity: %.8f   Background: %.8f",
         strRGB[channel], I[channel], S[channel]) );
   }

   var m = Math.min( I[0], I[1], I[2] );
   var channelR = m / I[0];
   var channelG = m / I[1];
   var channelB = m / I[2];

   var target = Math.max( S[0], S[1], S[2] );
   var index = S.indexOf(target);

   subImage.selectedChannel = index;
   var sigma  = subImage.stdDev();
   var nSigma = 3 * sigma;

   console.writeln( format("Target channel: %c", strRGB[index]) );
   console.writeln( format("Target value:   %.8f", target) );
   console.writeln( format("Sigma:          %.8f", sigma) );

   ac_bgNeutralization( view, target, nSigma );
   ac_calibration( view, channelR, channelG, channelB, target + nSigma );

   console.writeln( format("White balance correction factors:") );
   console.writeln( format("  Red:   %.6f", channelR) );
   console.writeln( format("  Green: %.6f", channelG) );
   console.writeln( format("  Blue:  %.6f", channelB) );
   console.writeln( "\u2714 AutoColor completed successfully.\n" );
}

function ac_ImageBackgroundMean( img, mxiter, readnoise )
{
   if ( mxiter == 0 ) mxiter = 50;
   var minsky = 20;
   var sky = new Float64Array( img.width * img.height );
   img.getSamples( sky );

   var nsky  = sky.length;
   var nlast = nsky - 1;
   sky.sort();

   var skymid  = 0.5 * sky[ac_Int((nsky-1)/2)] + 0.5 * sky[ac_Int(nsky/2)];
   var defSky  = skymid;
   var cut     = Math.min( skymid - sky[0], sky[nsky-1] - skymid );
   var cut2    = skymid + cut;
   var cut1    = skymid - cut;

   var j1 = -1;
   var j2 = 0;

   for ( var i = 0; i < nsky; i++ )
   {
      if ( sky[i] >= cut1 )
      {
         j1 = i;
         j2 = i;
         for ( var j = 0; j < nsky; j++ )
         {
            if ( sky[j] <= cut2 )
               j2 = j;
            else
               break;
         }
         break;
      }
   }

   if ( j1 < 0 )
   {
      console.writeln( "ERROR - No sky values fall within " +
         cut1.toFixed(2) + " and " + cut2.toFixed(3) );
      return -1;
   }

   var good  = j2 - j1 + 1;
   var delta = new Array(good);
   for ( var i = 0; i < good; i++ )
      delta[i] = sky[j1 + i] - skymid;

   var sum    = ac_total(delta);
   var sumsq  = ac_totalSqrd(delta);
   var maximm = j2;
   var minimm = j1 - 1;

   var skymed = 0.5 * sky[ac_Int((minimm+maximm+1)/2)] +
                0.5 * sky[ac_Int((minimm+maximm)/2) + 1];
   var skymn  = sum / (maximm - minimm);
   var sigma  = Math.sqrt( sumsq/(maximm-minimm) - Math.pow(skymn, 2) );
   skymn      = skymn + skymid;
   var skymod = (skymed < skymn) ? 3.0*skymed - 2.0*skymn : skymn;

   var clamp = 1;
   var old   = 0;
   var niter = 0;

   while ( true )
   {
      niter += 1;
      if ( niter > mxiter )
      {
         console.writeln( "ERROR - Too many (" + mxiter + ") iterations, " +
            "unable to compute sky, default returned" );
         return defSky;
      }
      if ( (maximm - minimm) < minsky )
      {
         console.writeln( "ERROR - Too few (" + (maximm-minimm).toString() +
            ") valid sky elements, unable to compute sky" );
         return -1;
      }

      var r  = Math.log10( maximm - minimm );
      r      = Math.max( 2.0, (-0.1042*r + 1.1695)*r + 0.8895 );
      var cut = r * sigma + 0.5 * Math.abs(skymn - skymod);
      cut1   = skymod - cut;
      cut2   = skymod + cut;

      var redo   = false;
      var newmin = minimm;
      var tst_min = sky[newmin+1] >= cut1;
      var done    = (newmin == -1) & tst_min;
      if ( !done ) done = (sky[Math.max(newmin, 0)] < cut1) & tst_min;
      if ( !done )
      {
         var istep = 1 - 2 * ac_boolToInt(tst_min);
         while ( !done )
         {
            newmin = newmin + istep;
            done = (newmin == -1) || (newmin == nlast);
            if ( !done ) done = (sky[newmin] <= cut1) && (sky[newmin+1] >= cut1);
         }
         if ( tst_min )
            delta = ac_SkySub( sky, newmin+1, minimm, skymid );
         else
            delta = ac_SkySub( sky, minimm+1, newmin, skymid );
         sum   -= istep * ac_total(delta);
         sumsq -= istep * ac_totalSqrd(delta);
         redo   = true;
         minimm = newmin;
      }

      var newmax  = maximm;
      var tst_max = sky[maximm] <= cut2;
      done = (maximm == nlast) && tst_max;
      if ( !done ) done = tst_max && (sky[Math.min((maximm+1), nlast)] > cut2);
      if ( !done )
      {
         istep = -1 + 2 * ac_boolToInt(tst_max);
         while ( !done )
         {
            newmax = newmax + istep;
            done = (newmax == nlast) || (newmax == -1);
            if ( !done ) done = (sky[newmax] <= cut2) && (sky[newmax+1] >= cut2);
         }
         if ( tst_max )
            delta = ac_SkySub( sky, maximm+1, newmax, skymid );
         else
            delta = ac_SkySub( sky, newmax+1, maximm, skymid );
         sum   += istep * ac_total(delta);
         sumsq += istep * ac_totalSqrd(delta);
         redo   = true;
         maximm = newmax;
      }

      nsky = maximm - minimm;
      if ( nsky < minsky )
      {
         console.writeln( "ERROR - Outlier rejection left too few sky elements" );
         return -1;
      }

      skymn  = sum / nsky;
      sigma  = Math.sqrt( Math.max(sumsq/nsky - Math.pow(skymn, 2), 0) );
      skymn  = skymn + skymid;

      var center = (minimm + 1 + maximm) / 2.0;
      var side   = Math.round( 0.2 * (maximm - minimm) ) / 2.0 + 0.25;
      var J      = Math.round( center - side );
      var K      = Math.round( center + side );

      if ( readnoise > 0 )
      {
         var L = Math.round( center - 0.25 );
         var M = Math.round( center + 0.25 );
         while ( (J > K) & (K < nsky-1) &
                 (((sky[L] - sky[J]) < r) | ((sky[K] - sky[M]) < r)) )
         {
            J -= 1;
            K += 1;
         }
      }

      skymed = ac_total( ac_SkySub(sky, J, K, 0) ) / (K - J + 1);

      var dmod;
      if ( skymed < skymn )
         dmod = 3.0*skymed - 2.0*skymn - skymod;
      else
         dmod = skymn - skymod;

      if ( dmod * old < 0 ) clamp = 0.5 * clamp;
      skymod = skymod + clamp * dmod;
      old    = dmod;

      if ( !redo ) break;
   }

   return skymod;
}

function ac_SkySub( values, startIndex, endIndex, reduction )
{
   var v = new Array( endIndex - startIndex + 1 );
   for ( var i = 0; i <= v.length - 1; i++ )
      v[i] = values[i + startIndex] - reduction;
   return v;
}

function ac_boolToInt( b )
{
   return b ? 1 : 0;
}

function ac_Int( f )
{
   return (f < 0) ? Math.ceil(f) : Math.floor(f);
}

function ac_total( array )
{
   var sum = 0;
   for ( var i = 0; i < array.length; i++ )
      sum += array[i];
   return sum;
}

function ac_totalSqrd( array )
{
   var sum = 0;
   for ( var i = 0; i < array.length; i++ )
      sum += Math.pow( array[i], 2 );
   return sum;
}

function ac_bgNeutralization( view, target, nSigma )
{
   var P = new BackgroundNeutralization;
   P.backgroundReferenceViewId = "";
   P.backgroundLow             = 0.0000000;
   P.backgroundHigh            = target + nSigma;
   P.useROI                    = false;
   P.roiX0                     = 0;
   P.roiY0                     = 0;
   P.roiX1                     = 0;
   P.roiY1                     = 0;
   P.mode                      = BackgroundNeutralization.TargetBackground;
   P.targetBackground          = target;
   P.executeOn( view );
}

function ac_calibration( view, r, g, b, target )
{
   var P = new ColorCalibration;
   P.whiteReferenceViewId          = "";
   P.whiteLow                      = 0.0000000;
   P.whiteHigh                     = 0.9000000;
   P.whiteUseROI                   = false;
   P.whiteROIX0                    = 0;
   P.whiteROIY0                    = 0;
   P.whiteROIX1                    = 0;
   P.whiteROIY1                    = 0;
   P.structureDetection            = false;
   P.structureLayers               = 5;
   P.noiseLayers                   = 1;
   P.manualWhiteBalance            = true;
   P.manualRedFactor               = r;
   P.manualGreenFactor             = g;
   P.manualBlueFactor              = b;
   P.backgroundReferenceViewId     = "";
   P.backgroundLow                 = 0.0000000;
   P.backgroundHigh                = target;
   P.backgroundUseROI              = false;
   P.backgroundROIX0               = 0;
   P.backgroundROIY0               = 0;
   P.backgroundROIX1               = 0;
   P.backgroundROIY1               = 0;
   P.outputWhiteReferenceMask      = false;
   P.outputBackgroundReferenceMask = false;
   P.executeOn( view );
}

// ============================================================
// STEP 5: Adaptive Auto STF (ASTF)
//
// Since v2.3 (developed with the R&D harness Test_AdaptiveAutoSTF.js, "BGP020"):
// - Stretch method: PixInsight's AutoSTF by Juan Conejero (Pleiades Astrophoto),
//   own implementation. Black point c0 = median - ASTF.clipSigma x MADN,
//   midtones m so the median lands on ASTF.targetBackground.
//   Ref: https://pixinsight.com/forum/index.php?threads/programmatic-way-to-do-an-stf-autostretch.6659/
// - Linked / unlinked chosen automatically:
//     SPCC white balance present on the view   -> linked (keeps SPCC colour)
//     else background medians within ASTF.linkSpreadMADN x avg MADN
//                                               -> linked, otherwise unlinked
// - Statistics from the "Background" preview (the sky tile found in STEP 3)
//   when present, else the whole image. Sky-only noise puts the black point
//   close to the sky, which gives the nebula more depth.
// - Target background 0.225: halfway between PI default 0.25 and the
//   tested 0.20 (Georg, 2026-10-07).
// ============================================================

var ASTF = {
   targetBackground: 0.225,  // PI default 0.25; lower = darker background
   clipSigma:        2.8,    // PI default 2.8
   linkSpreadMADN:   1.0,    // auto: linked if median spread <= this x avg MADN
   bgPreviewId:      "Background"
};

function autoSTF()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 5: Applying Adaptive Auto STF");
   console.writeln("=".repeat(80) + "\n");

   var stfStartTime = Date.now();

   var win = ImageWindow.activeWindow;
   if (win.isNull)
      throw new Error("No active image window.");
   var view = win.mainView;
   var img = view.image;
   var n = img.isColor ? 3 : 1;

   // Statistics region: the Background preview if there is one, else the whole image
   var rect = new Rect();   // empty rect = whole image
   var region = "whole image";
   var pv = win.previewById(ASTF.bgPreviewId);   // null if not found
   if (pv && !pv.isNull) {
      rect = win.previewRect(pv);
      region = "preview '" + ASTF.bgPreviewId + "' (" + rect.width + "x" + rect.height + ")";
   }

   var medians = [], madns = [];
   for (var c = 0; c < n; ++c) {
      medians[c] = img.median(rect, c, c);
      madns[c]   = img.MAD(medians[c], rect, c, c) * 1.4826;
   }

   function mean(a) { var s = 0; for (var i = 0; i < a.length; ++i) s += a[i]; return s / a.length; }
   function stretch(median, c0) {
      c0 = Math.max(0.0, Math.min(c0, median));   // never clip above the background
      var x = (1.0 - c0) > 0 ? (median - c0) / (1.0 - c0) : 0;
      x = Math.max(x, 1.0e-7);
      var m = Math.max(0.0001, Math.min(Math.mtf(ASTF.targetBackground, x), 0.9999));
      return { c0: c0, m: m };
   }

   // ---- Linked / unlinked decision ----
   var linked = true, why = "grayscale image";
   if (n == 3) {
      var spcc = null;
      try { spcc = view.propertyValue("PCL:SPCC:WhiteBalanceFactors"); } catch (e) {}
      var spread = Math.max(medians[0], medians[1], medians[2]) -
                   Math.min(medians[0], medians[1], medians[2]);
      var spreadMADN = spread / Math.max(mean(madns), 1.0e-10);
      if (spcc != null && spcc != undefined) {
         linked = true;
         why = "SPCC white balance present";
      } else {
         linked = spreadMADN <= ASTF.linkSpreadMADN;
         why = "no SPCC; background spread " + spreadMADN.toFixed(2) +
               " x noise (limit " + ASTF.linkSpreadMADN.toFixed(1) + ")";
      }
   }

   // ---- Compute STF ----
   var rows = [];
   if (n == 1) {
      var g = stretch(medians[0], medians[0] - ASTF.clipSigma * madns[0]);
      rows = [[g.c0, 1, g.m, 0, 1], [0, 1, 0.5, 0, 1], [0, 1, 0.5, 0, 1], [0, 1, 0.5, 0, 1]];
   } else if (linked) {
      var c0s = [];
      for (var c = 0; c < 3; ++c) c0s[c] = medians[c] - ASTF.clipSigma * madns[c];
      var L = stretch(mean(medians), mean(c0s));
      for (var c = 0; c < 3; ++c) rows[c] = [L.c0, 1, L.m, 0, 1];
      rows[3] = [0, 1, 0.5, 0, 1];
   } else {
      for (var c = 0; c < 3; ++c) {
         var u = stretch(medians[c], medians[c] - ASTF.clipSigma * madns[c]);
         rows[c] = [u.c0, 1, u.m, 0, 1];
      }
      rows[3] = [0, 1, 0.5, 0, 1];
   }

   var P = new ScreenTransferFunction;
   P.STF = rows;
   P.interaction = ScreenTransferFunction.SeparateChannels;
   P.executeOn(view, false);

   // ---- Console ----
   console.writeln("View: " + view.id);
   console.writeln("Image: " + img.width + " x " + img.height +
                   (img.isColor ? " (Color RGB)" : " (Grayscale)"));
   console.writeln("Statistics from: " + region);
   console.writeln("Target background: " + ASTF.targetBackground.toFixed(3) +
                   ", clip sigma: " + ASTF.clipSigma);
   if (n == 3)
      console.writeln("Mode: " + (linked ? "LINKED" : "UNLINKED") + " (" + why + ")");
   console.writeln("");
   var names = n == 3 ? ["Red", "Green", "Blue"] : ["Gray"];
   for (var c = 0; c < n; ++c)
      console.writeln("  " + names[c] + ": median=" + medians[c].toFixed(7) +
                      ", MADN=" + madns[c].toFixed(7) +
                      "  ->  c0=" + rows[c][0].toFixed(7) + ", m=" + rows[c][2].toFixed(6));

   console.writeln("\n\u2714 Adaptive Auto STF Applied");
   var stfElapsed = (Date.now() - stfStartTime) / 1000;
   var stfMin = Math.floor(stfElapsed / 60);
   var stfSec = (stfElapsed % 60).toFixed(2);
   console.writeln(stfMin > 0 ? (stfMin + "m " + stfSec + "s") : (stfSec + "s"));
   console.writeln("");
}

// ============================================================
// STEP 6: BlurXTerminator - Full Processing (with dialog params)
// ============================================================

function runBXT_Full()
{
   let win = ImageWindow.activeWindow;
   if (win.isNull) throw new Error("No active image window.");
   let view = win.mainView;
   if (view.isNull) throw new Error("No active view.");

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 6: Running BlurXTerminator (Full Processing)");
   console.writeln("=".repeat(80) + "\n");

   console.writeln("Running BlurXTerminator on view: " + view.id);
   console.writeln("  Sharpen Stars:      " + WorkflowParameters.bxtSharpenStars.toFixed(2));
   console.writeln("  Adjust Halos:       " + WorkflowParameters.bxtAdjustHalos.toFixed(2));
   console.writeln("  Auto PSF:           " + (WorkflowParameters.bxtAutoPSF ? "Yes" : "No"));
   console.writeln("  PSF Diameter:       " + WorkflowParameters.bxtPSFDiameter.toFixed(2));
   console.writeln("  Sharpen Nonstellar: " + WorkflowParameters.bxtSharpenNonstellar.toFixed(2));
   console.writeln("");

   if ( typeof BlurXTerminator === "undefined" ) {
      console.warningln("\u26A0 BlurXTerminator is not installed - skipping BXT Full.\n");
      return;
   }
   var P = new BlurXTerminator;
   P.ml_version = WorkflowParameters.bxtMlVersion;
   P.correct_only = false;

   P.sharpen_stars = WorkflowParameters.bxtSharpenStars;
   P.adjust_star_halos = WorkflowParameters.bxtAdjustHalos;

   P.auto_nonstellar_psf = WorkflowParameters.bxtAutoPSF;
   P.nonstellar_diameter = WorkflowParameters.bxtPSFDiameter;
   P.sharpen_nonstellar = WorkflowParameters.bxtSharpenNonstellar;
   P.overlap = WorkflowParameters.bxtTileOverlap;

   if (!P.executeOn(view)) {
      if (console.abortRequested)
         throw new Error("Script cancelled by user.");
      throw new Error("BlurXTerminator execution failed.");
   }

   console.writeln("\u2714 BlurXTerminator (Full Processing) completed successfully.\n");
}

// ============================================================
// STEP 7: StarXTerminator (with dialog params)
// ============================================================

function runSXT()
{
   let win = ImageWindow.activeWindow;
   if (win.isNull) throw new Error("No active image window.");
   let view = win.mainView;
   if (view.isNull) throw new Error("No active view.");

   let originalWin = win;
   let originalName = view.id;
   let expectedStarsName = originalName + "_stars";

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 7: Running StarXTerminator");
   console.writeln("=".repeat(80) + "\n");

   console.writeln("Target view: " + view.id);
   console.writeln("  Generate Stars: " + (WorkflowParameters.sxtGenerateStars ? "Yes" : "No"));
   console.writeln("  Unscreen:       " + (WorkflowParameters.sxtUnscreen ? "Yes" : "No"));
   console.writeln("  Tile Overlap:   " + WorkflowParameters.sxtTileOverlap.toFixed(2));
   console.writeln("");

   if ( typeof StarXTerminator === "undefined" ) {
      // (SXT and StarNet2 are mutually exclusive in the dialog, so there is no
      // automatic fallback; enable StarNet2 instead.)
      console.warningln("\u26A0 StarXTerminator is not installed - skipping SXT. " +
                        "Enable StarNet2 instead to remove stars.\n");
      return;
   }
   var P = new StarXTerminator;
   P.ml_version = WorkflowParameters.sxtMlVersion;
   P.output_stars = WorkflowParameters.sxtGenerateStars;
   P.unscreen_stars = WorkflowParameters.sxtUnscreen;
   P.overlap = WorkflowParameters.sxtTileOverlap;

   if (!P.executeOn(view)) {
      if (console.abortRequested)
         throw new Error("Script cancelled by user.");
      throw new Error("StarXTerminator execution failed.");
   }

   // Rename the stars image if generated
   if (WorkflowParameters.sxtGenerateStars) {
      let starsWindow = ImageWindow.windowById(expectedStarsName);
      if (!starsWindow.isNull) {
         starsWindow.mainView.id = "stars";
         console.writeln("\u2714 Stars image renamed to: stars");
      } else {
         console.warningln("\u26A0 Could not find stars image to rename");
      }
   }

   // Bring original image back to front
   originalWin.bringToFront();
   console.writeln("\u2714 StarXTerminator completed successfully.\n");
}

// ============================================================
// MAIN EXECUTION
// ============================================================

function runStarNet2()
{
   let win = ImageWindow.activeWindow;
   if (win.isNull) throw new Error("No active image window.");
   let view = win.mainView;
   if (view.isNull) throw new Error("No active view.");

   let originalWin = win;
   let originalName = view.id;
   let expectedMaskName = "star_mask";

   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 8: Running StarNet2");
   console.writeln("=".repeat(80) + "\n");

   console.writeln("Target view: " + view.id);
   console.writeln("  Stride:        " + WorkflowParameters.sn2Stride);
   console.writeln("  Create mask:   " + (WorkflowParameters.sn2Mask ? "Yes" : "No"));
   console.writeln("  2x upsample:   " + (WorkflowParameters.sn2Upsample ? "Yes" : "No"));
   console.writeln("  Linear data:   " + (WorkflowParameters.sn2Linear ? "Yes" : "No"));
   console.writeln("");

  if ( typeof StarNet2 === "undefined" ) {
      console.warningln("\u26A0 StarNet2 is not installed - skipping StarNet2.\n");
      return;
   }
   var P = new StarNet2;
   P.stride = WorkflowParameters.sn2Stride === 384 ? 0 :
              WorkflowParameters.sn2Stride === 128 ? 2 : 1;
   P.mask = WorkflowParameters.sn2Mask;
   P.upsample = WorkflowParameters.sn2Upsample;
   P.linear = WorkflowParameters.sn2Linear;

   if (!P.executeOn(view)) {
      if (console.abortRequested)
         throw new Error("Script cancelled by user.");
      throw new Error("StarNet2 execution failed.");
   }

   // Rename star mask image to "stars" to match SXT behaviour
   if (WorkflowParameters.sn2Mask) {
      let maskWindow = ImageWindow.windowById(expectedMaskName);
      if (!maskWindow.isNull) {
         maskWindow.mainView.id = "stars";
         console.writeln("\u2714 Star mask image renamed to: stars");
      } else {
         console.warningln("\u26A0 Could not find star mask image to rename");
      }
   }

   // Bring original image back to front
   originalWin.bringToFront();
   console.writeln("\u2714 StarNet2 completed successfully.\n");
}

function main()
{
   console.show();

   let startTime = new Date();

   console.writeln("\n" + "=".repeat(80));
   console.writeln(SCRIPT_NAME + " " + SCRIPT_VERSION);
   console.writeln("BXT Correct \u2192 Background \u2192 SPCC \u2192 Adaptive Auto STF \u2192 BXT Full \u2192 SXT");
   console.writeln("=".repeat(80) + "\n");

   try {
      parseFiltersXSPD();
      parseWhiteRefXSPD();
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

      // Load saved parameters if running from instance
      if (Parameters.isViewTarget || Parameters.isGlobalTarget) {
         WorkflowParameters.load();
      }
      WorkflowParameters.resolveSelection();

      selectEquipment();

      // Pre-flight: astrometric solution check (required for SPCC)
      if (WorkflowParameters.enableSPCC) {
         var win = ImageWindow.activeWindow;
         var hasAstrometry = false;
         try {
            // The modern ImageSolver engine (used by Part 1 and standalone
            // ImageSolver 6.5.0) writes the STANDARD "AstrometricSolution:*"
            // property namespace; older solutions used legacy
            // "PCL:AstrometricSolution:*". Accept either.
            var v = win.mainView;
            if (v.hasProperty("AstrometricSolution:CreatorModule") ||
                v.hasProperty("PCL:AstrometricSolution:CreatorModule"))
               hasAstrometry = true;
         } catch (e) {}
         // v2.3: also accept PixInsight's own check, in case the solution is valid but the
         // CreatorModule property is missing (e.g. after some processes or cloning)
         if (!hasAstrometry) {
            try { if (win.hasAstrometricSolution) hasAstrometry = true; } catch (e) {}
         }
         if (!hasAstrometry) {
            throw new Error("No astrometric solution found. Please run Part 1 (ImageSolver) before running SPCC.");
         }
         console.writeln("\u2714 Astrometric solution found - SPCC can proceed.\n");
      }

      // Re-run Protection: warn if script was previously applied to this image
      var win = ImageWindow.activeWindow;
      var view = win.mainView;
      // Marks and SPCC's own property follow History Explorer rollbacks.
      var scriptRanBefore = shHasMark(view, "PCL:SPCC:WhiteBalanceFactors");
      for (var m = 0; m < SH_STEP_MARKS.length; m++)
         if (shHasMark(view, SH_STEP_MARKS[m])) scriptRanBefore = true;

      if (scriptRanBefore) {
         var msg = new MessageBox(
            "<p><b>Warning: This script may have already been applied to this image.</b></p>" +
            "<p>Running it again may damage your image.</p>" +
            "<p>Check History Explorer before continuing.</p>" +
            "<p>Continue anyway?</p>",
            "Warning: Script Already Applied",
            StdIcon.Warning,
            StdButton.Yes, StdButton.No
         );
         if (msg.execute() === StdButton.No)
            throw new Error("Script cancelled by user.");
      }

      // Background pre-check: previews + optional dust map, before anything is processed
      if (WorkflowParameters.enableBackground && WorkflowParameters.enableBgPrecheck) {
         if (!runBackgroundPrecheck())
            throw new Error("Script cancelled by user.");
      }

      if (WorkflowParameters.enableBXTCorrect) {
         runBXT_CorrectOnly();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:BXTCorrectDone");
      } else {
         console.writeln("BXT Correct Only is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableBackground) {
         findDarkestBackgroundPreview();   // throws on failure
         shMarkDone(view, "SpaceHunter:BackgroundDone");
      } else {
         console.writeln("Background Finder is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableSPCC) {
         runSPCC();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:SPCCDone");
      } else {
         console.writeln("SPCC is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableAutoColor) {
         runAutoColor();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:AutoColorDone");
      } else {
         console.writeln("AutoColor is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableAutoSTF) {
         autoSTF();
      } else {
         console.writeln("Adaptive Auto STF is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableBXTFull) {
         runBXT_Full();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:BXTFullDone");
      } else {
         console.writeln("BXT Full is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableSXT) {
         runSXT();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:SXTDone");
      } else {
         console.writeln("StarXTerminator is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableStarNet2) {
         runStarNet2();
         shMarkDone(view, "SpaceHunter:ScriptRan");
         shMarkDone(view, "SpaceHunter:StarNet2Done");
      } else {
         console.writeln("StarNet2 is DISABLED - skipping\n");
      }

      // Bring original image back to front
      let originalWin = ImageWindow.activeWindow;
      if (!originalWin.isNull)
         originalWin.bringToFront();

      if (WorkflowParameters.enableNXT) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 9: Opening NoiseXTerminator");
         console.writeln("=".repeat(80) + "\n");
         if ( typeof NoiseXTerminator === "undefined" ) {
            console.warningln("\u26A0 NoiseXTerminator is not installed - skipping NXT.\n");
         } else {
            var nxt = new NoiseXTerminator;
            nxt.ml_version = WorkflowParameters.nxtMlVersion;
            nxt.overlap = WorkflowParameters.nxtTileOverlap;
            nxt.launch();
         }
         console.writeln("\u2714 NoiseXTerminator opened.\n");
      } else {
         console.writeln("NoiseXTerminator is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableMLDenoise) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 10: Opening MLDenoise");
         console.writeln("=".repeat(80) + "\n");
         if ( typeof MLDenoise === "undefined" ) {
            console.warningln("\u26a0 MLDenoise is not installed - skipping.\n");
         } else {
            // Launch only, pre-selecting the user's own model. The path is
            // machine-specific and comes from the user's prefs (set via the
            // Model field / browse), never hardcoded. If left empty, MLDenoise
            // opens with no model pre-selected.
            var mld = new MLDenoise;
            if ( WorkflowParameters.mldModelPath )
               mld.modelPath = WorkflowParameters.mldModelPath;
            mld.launch();
         }
         console.writeln("\u2714 MLDenoise opened.\n");
      } else {
         console.writeln("MLDenoise is DISABLED - skipping\n");
      }

      let endTime = new Date();
      let elapsedMs = endTime - startTime;
      let elapsedSec = Math.floor(elapsedMs / 1000);
      let minutes = Math.floor(elapsedSec / 60);
      let seconds = elapsedSec % 60;

      console.writeln("\n" + "=".repeat(80));
      console.writeln("\u2705 WORKFLOW COMPLETE \u2705");
      console.writeln("=".repeat(80));
      console.writeln("\nTotal execution time: " + minutes + "m " + seconds + "s\n");

   } catch (error) {
      if (error.message === "Script cancelled by user." ||
          error.message === "Process aborted") {
         console.writeln("\n\u26A0 Script aborted by user.\n");
      } else {
         console.criticalln("\nERROR: " + error.message);
         throw error;
      }
   }
}

main();
