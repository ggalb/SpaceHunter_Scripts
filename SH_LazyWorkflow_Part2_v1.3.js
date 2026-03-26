#feature-id Space_Hunter > SH Lazy Workflow Part 2
#feature-icon  SH_WorkFlow2.svg
#feature-info Space Hunter Lazy Workflow Part 2 v1.3<br/>\
   <br/>\
   Automated Linear Image Processing workflow for OSC camera images.<br/>\
   <br/>\
   Includes: Equipment selection with collapsible sections, BlurXTerminator (correct only),<br/>\
   Background finder with Exclusion Zones selection, SPCC with auto-detected ROI,<br/>\
   AutoColor (Background Neutralization + Color Calibration, alternative to Background + SPCC),<br/>\
   BlurXTerminator full with adjustable parameters, Adaptive Auto STF,<br/>\
   StarXTerminator or StarNet2 for star removal, NoiseXTerminator. New Instance support.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   AutoColor.js Copyright &copy; 2016 Hartmut V. Bornemann. Used with written permission.<br/>\
   See LICENSE file for details: https://github.com/ggalb/SpaceHunter_Scripts/blob/main/LICENSE.

// Changes made to reflect all filters independent of location > Changes made to console output info showing parts enabled/disabled > 
// ============================================================
// Space Hunter Lazy Workflow Part 2 v1.3
//
// Copyright (c) 2026 Georg G Albrecht. MIT License.
// See LICENSE file for details.
//
// Acknowledgments:
// - PixInsight platform by Pleiades Astrophoto (https://pixinsight.com/)
// - Adaptive Auto STF based on PixInsight STF methodology by Juan Conejero
// - Background finder concept inspired by FindBackground by
//   Gerrit Erdt and Franklin Marek (SetiAstro), licensed under CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
// - AutoColor.js by Hartmut V. Bornemann, Copyright 2016. Used with written permission. (https://www.skypixels.at/pixinsight_scripts.html)
//   Original copyright headers and author name preserved in source code as required.
//   NOT covered by MIT License. Separate permission required for reuse.
// - Standard PixInsight processes called: SpectrophotometricColorCalibration (SPCC),
//   BackgroundNeutralization, ColorCalibration
// - BlurXTerminator, StarXTerminator and NoiseXTerminator by Russell Croman (https://www.rc-astro.com/)
// - StarNet2 by Nikita Misiura (https://www.starnetastro.com/), astrophotography use only
// - Developed with assistance from Claude AI (Anthropic)
//
// Part 0: Process & Equipment selection dialog (SectionBar UI)
// Part 1: Run BlurXTerminator correct only
// Part 2: Find darkest background using gradient descent + Exclusion Zones
// Part 3: Run SPCC with selected filter and extracted ROI
// Part 4: Run AutoColor - Background Neutralization + Color Calibration (alternative to Parts 2 & 3)
// Part 5: Run Adaptive Auto STF
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
// - PixInsight 1.9.3
// - OSC Camera Image
// - Image pre-cropped, solved and background extraction applied
// - BlurXTerminator, StarXTerminator and NoiseXTerminator needed for full process
// - AutoColor script by Hartmut V. Bornemann (optional)
// - StarNet2 script for PixInsight (optional)

#include <pjsr/DataType.jsh>
#include <pjsr/UndoFlag.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/NumericControl.jsh>

// ============================================================
// SCRIPT IDENTITY
// ============================================================

#define SCRIPT_NAME    "Space Hunter Lazy Workflow Part 2"
#define SCRIPT_VERSION "v1.3"
// PDF User Guide - same folder as this script
var SCRIPT_DIR = File.extractDrive(#__FILE__) + File.extractDirectory(#__FILE__);
var PDF_GUIDE_PATH = SCRIPT_DIR + "/SH_Workflow_Guide.pdf";
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
var filterList = [];

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

   // AutoColor
   enableAutoColor: false,

   // Background finder
   enableExclusionZones: false,

   // SPCC equipment selection
   selectedWhiteRefIdx: 0,
   selectedCameraIdx:   -1, // set to Ideal QE curve at startup
   selectedFilterIdx:   0,

   // SPCC Narrowband
   enableNarrowband:    false,
   nbRedWavelength:     656.30,
   nbRedBandwidth:      3.00,
   nbGreenWavelength:   500.70,
   nbGreenBandwidth:    3.00,
   nbBlueWavelength:    500.70,
   nbBlueBandwidth:     3.00,

   // BXT Full parameters
   bxtSharpenStars:       0.25,
   bxtAdjustHalos:        0.00,
   bxtAutoPSF:            true,
   bxtPSFDiameter:        0.00,
   bxtSharpenNonstellar:  0.90,

   // AI model files (empty string = use PixInsight default)
   bxtAiFile: "",
   sxtAiFile: "",
   nxtAiFile: "",

   // SXT parameters
   sxtGenerateStars: true,
   sxtUnscreen:      false,
   sxtLargeOverlap:  false,
   
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
      Parameters.set("enableExclusionZones", this.enableExclusionZones);

      Parameters.set("selectedWhiteRefIdx", this.selectedWhiteRefIdx);
      Parameters.set("selectedCameraIdx",   this.selectedCameraIdx);
      Parameters.set("selectedFilterIdx",   this.selectedFilterIdx);

      Parameters.set("enableNarrowband",  this.enableNarrowband);
      Parameters.set("nbRedWavelength",   this.nbRedWavelength);
      Parameters.set("nbRedBandwidth",    this.nbRedBandwidth);
      Parameters.set("nbGreenWavelength", this.nbGreenWavelength);
      Parameters.set("nbGreenBandwidth",  this.nbGreenBandwidth);
      Parameters.set("nbBlueWavelength",  this.nbBlueWavelength);
      Parameters.set("nbBlueBandwidth",   this.nbBlueBandwidth);

      Parameters.set("bxtSharpenStars",      this.bxtSharpenStars);
      Parameters.set("bxtAdjustHalos",       this.bxtAdjustHalos);
      Parameters.set("bxtAutoPSF",           this.bxtAutoPSF);
      Parameters.set("bxtPSFDiameter",       this.bxtPSFDiameter);
      Parameters.set("bxtSharpenNonstellar", this.bxtSharpenNonstellar);

      Parameters.set("bxtAiFile",        this.bxtAiFile);
      Parameters.set("sxtAiFile",        this.sxtAiFile);
      Parameters.set("nxtAiFile",        this.nxtAiFile);
      Parameters.set("sxtGenerateStars", this.sxtGenerateStars);
      Parameters.set("sxtUnscreen",      this.sxtUnscreen);
      Parameters.set("sxtLargeOverlap",  this.sxtLargeOverlap);
	  
	  Parameters.set("enableNXT",        this.enableNXT);
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
      if (Parameters.has("enableExclusionZones"))
         this.enableExclusionZones = Parameters.getBoolean("enableExclusionZones");

      if (Parameters.has("selectedWhiteRefIdx"))
         this.selectedWhiteRefIdx = Parameters.getInteger("selectedWhiteRefIdx");
      if (Parameters.has("selectedCameraIdx"))
         this.selectedCameraIdx = Parameters.getInteger("selectedCameraIdx");
      if (Parameters.has("selectedFilterIdx"))
         this.selectedFilterIdx = Parameters.getInteger("selectedFilterIdx");

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

      if (Parameters.has("bxtAiFile"))
         this.bxtAiFile = Parameters.getString("bxtAiFile");
      if (Parameters.has("sxtAiFile"))
         this.sxtAiFile = Parameters.getString("sxtAiFile");
      if (Parameters.has("nxtAiFile"))
         this.nxtAiFile = Parameters.getString("nxtAiFile");
      if (Parameters.has("sxtGenerateStars"))
         this.sxtGenerateStars = Parameters.getBoolean("sxtGenerateStars");
      if (Parameters.has("sxtUnscreen"))
         this.sxtUnscreen = Parameters.getBoolean("sxtUnscreen");
      if (Parameters.has("sxtLargeOverlap"))
         this.sxtLargeOverlap = Parameters.getBoolean("sxtLargeOverlap");
	 
	  if (Parameters.has("enableNXT"))
         this.enableNXT = Parameters.getBoolean("enableNXT");
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
      var prefs = {
         enableAutoColor:      this.enableAutoColor,
         enableBXTCorrect:     this.enableBXTCorrect,
         enableBackground:     this.enableBackground,
         enableSPCC:           this.enableSPCC,
         enableAutoSTF:        this.enableAutoSTF,
         enableBXTFull:        this.enableBXTFull,
         enableSXT:            this.enableSXT,
         enableNXT:            this.enableNXT,
         enableStarNet2:       this.enableStarNet2,        
         selectedWhiteRefIdx:  this.selectedWhiteRefIdx,
         selectedCameraIdx:    this.selectedCameraIdx,
         selectedFilterIdx:    this.selectedFilterIdx,
         enableNarrowband:     this.enableNarrowband,
         nbRedWavelength:      this.nbRedWavelength,
         nbRedBandwidth:       this.nbRedBandwidth,
         nbGreenWavelength:    this.nbGreenWavelength,
         nbGreenBandwidth:     this.nbGreenBandwidth,
         nbBlueWavelength:     this.nbBlueWavelength,
         nbBlueBandwidth:      this.nbBlueBandwidth,
         bxtSharpenStars:      this.bxtSharpenStars,
         bxtAdjustHalos:       this.bxtAdjustHalos,
         bxtAutoPSF:           this.bxtAutoPSF,
         bxtPSFDiameter:       this.bxtPSFDiameter,
         bxtSharpenNonstellar: this.bxtSharpenNonstellar,
         bxtAiFile:            this.bxtAiFile,
         sxtAiFile:            this.sxtAiFile,
         nxtAiFile:            this.nxtAiFile,
         sxtGenerateStars:     this.sxtGenerateStars,
         sxtUnscreen:          this.sxtUnscreen,
         sxtLargeOverlap:      this.sxtLargeOverlap,
         sn2Stride:            this.sn2Stride,
         sn2Mask:              this.sn2Mask,
         sn2Upsample:          this.sn2Upsample,
         sn2Linear:            this.sn2Linear
      };
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType_String, JSON.stringify(prefs));
      } catch (e) {}
   },

   loadUserPrefs: function()
   {
      try {
         var saved = Settings.read(SETTINGS_KEY_USERPREFS, DataType_String);
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
            if (prefs.enableStarNet2       !== undefined) this.enableStarNet2       = prefs.enableStarNet2;
            if (prefs.selectedWhiteRefIdx  !== undefined) this.selectedWhiteRefIdx  = prefs.selectedWhiteRefIdx;
            if (prefs.selectedCameraIdx    !== undefined) this.selectedCameraIdx    = prefs.selectedCameraIdx;
            if (prefs.selectedFilterIdx    !== undefined) this.selectedFilterIdx    = prefs.selectedFilterIdx;
            if (prefs.enableNarrowband     !== undefined) this.enableNarrowband     = prefs.enableNarrowband;
            if (prefs.nbRedWavelength      !== undefined) this.nbRedWavelength      = prefs.nbRedWavelength;
            if (prefs.nbRedBandwidth       !== undefined) this.nbRedBandwidth       = prefs.nbRedBandwidth;
            if (prefs.nbGreenWavelength    !== undefined) this.nbGreenWavelength    = prefs.nbGreenWavelength;
            if (prefs.nbGreenBandwidth     !== undefined) this.nbGreenBandwidth     = prefs.nbGreenBandwidth;
            if (prefs.nbBlueWavelength     !== undefined) this.nbBlueWavelength     = prefs.nbBlueWavelength;
            if (prefs.nbBlueBandwidth      !== undefined) this.nbBlueBandwidth      = prefs.nbBlueBandwidth;
            if (prefs.bxtSharpenStars      !== undefined) this.bxtSharpenStars      = prefs.bxtSharpenStars;
            if (prefs.bxtAdjustHalos       !== undefined) this.bxtAdjustHalos       = prefs.bxtAdjustHalos;
            if (prefs.bxtAutoPSF           !== undefined) this.bxtAutoPSF           = prefs.bxtAutoPSF;
            if (prefs.bxtPSFDiameter       !== undefined) this.bxtPSFDiameter       = prefs.bxtPSFDiameter;
            if (prefs.bxtSharpenNonstellar !== undefined) this.bxtSharpenNonstellar = prefs.bxtSharpenNonstellar;
            if (prefs.bxtAiFile            !== undefined) this.bxtAiFile            = prefs.bxtAiFile;
            if (prefs.sxtAiFile            !== undefined) this.sxtAiFile            = prefs.sxtAiFile;
            if (prefs.nxtAiFile            !== undefined) this.nxtAiFile            = prefs.nxtAiFile;
            if (prefs.sxtGenerateStars     !== undefined) this.sxtGenerateStars     = prefs.sxtGenerateStars;
            if (prefs.sxtUnscreen          !== undefined) this.sxtUnscreen          = prefs.sxtUnscreen;
            if (prefs.sxtLargeOverlap      !== undefined) this.sxtLargeOverlap      = prefs.sxtLargeOverlap;
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
      this.enableNarrowband     = false;
      this.nbRedWavelength      = 656.30;
      this.nbRedBandwidth       = 3.00;
      this.nbGreenWavelength    = 500.70;
      this.nbGreenBandwidth     = 3.00;
      this.nbBlueWavelength     = 500.70;
      this.nbBlueBandwidth      = 3.00;
      this.bxtSharpenStars      = 0.25;
      this.bxtAdjustHalos       = 0.00;
      this.bxtAutoPSF           = true;
      this.bxtPSFDiameter       = 0.00;
      this.bxtSharpenNonstellar = 0.90;      
      this.sxtGenerateStars     = true;
      this.sxtUnscreen          = false;
      this.sxtLargeOverlap      = false;
      this.sn2Stride            = 256;
      this.sn2Mask              = true;
      this.sn2Upsample          = false;
      this.sn2Linear            = true;
      try {
         Settings.write(SETTINGS_KEY_USERPREFS, DataType_String, JSON.stringify({
            enableAutoColor:      this.enableAutoColor,
            enableBXTCorrect:     this.enableBXTCorrect,
            enableBackground:     this.enableBackground,
            enableSPCC:           this.enableSPCC,
            enableAutoSTF:        this.enableAutoSTF,
            enableBXTFull:        this.enableBXTFull,
            enableSXT:            this.enableSXT,
            enableNXT:            this.enableNXT,
            enableStarNet2:       this.enableStarNet2,
            selectedWhiteRefIdx:  this.selectedWhiteRefIdx,
            selectedCameraIdx:    this.selectedCameraIdx,
            selectedFilterIdx:    this.selectedFilterIdx,
            bxtSharpenStars:      this.bxtSharpenStars,
            bxtAdjustHalos:       this.bxtAdjustHalos,
            bxtAutoPSF:           this.bxtAutoPSF,
            bxtPSFDiameter:       this.bxtPSFDiameter,
            bxtSharpenNonstellar: this.bxtSharpenNonstellar,
            bxtAiFile:            this.bxtAiFile,
            sxtAiFile:            this.sxtAiFile,
            nxtAiFile:            this.nxtAiFile,
            sxtGenerateStars:     this.sxtGenerateStars,
            sxtUnscreen:          this.sxtUnscreen,
            sxtLargeOverlap:      this.sxtLargeOverlap,
            sn2Stride:            this.sn2Stride,
            sn2Mask:              this.sn2Mask,
            sn2Upsample:          this.sn2Upsample,
            sn2Linear:            this.sn2Linear
         }));
      } catch (e) {}
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

   for (var i = 0; i < panEntries.length; i++) {
      filterList.push({ label: panEntries[i] + " (PAN)", type: "pan", panName: panEntries[i] });
   }

   for (var i = 0; i < lumEntries.length; i++) {
      filterList.push({ label: lumEntries[i] + " (L)", type: "lum", lumName: lumEntries[i] });
   }

   filterList.sort(function(a, b) {
      var typeOrder = { broadband: 0, precombined: 1, pan: 2, lum: 3 };
      var ta = typeOrder[a.type] || 99;
      var tb = typeOrder[b.type] || 99;
      if (ta !== tb) return ta - tb;
      return a.label < b.label ? -1 : (a.label > b.label ? 1 : 0);
   });

   console.writeln("  Filter sets found: " + filterList.length);
   console.writeln("");
}

// ============================================================
// DIALOG CONSTRUCTOR
// ============================================================

function SpaceHunterDialog2()
{
   this.__base__ = Dialog;
   this.__base__();

   var dlg = this;

   let labelWidth = this.font.width( "Sharpen Nonstellar:" + "MMMMM" );

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
      "BXT correct-only, Background, SPCC or AutoColor, Adaptive Auto STF, BXT Full, SXT or StarNet2, NXT for OSC camera images.<br/>" +
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

   this.bxtCorrect_Control = new Control( this );
   this.bxtCorrect_Control.sizer = new VerticalSizer;
   this.bxtCorrect_Control.sizer.margin = 6;
   this.bxtCorrect_Control.sizer.spacing = 4;

   this.bxtCorrect_Section = new SectionBar( this, "BlurXTerminator (Correct Only)" );
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
   this.exclusionZones_CheckBox.text = "Enable Exclusion Zones";
   this.exclusionZones_CheckBox.checked = WorkflowParameters.enableExclusionZones;
   this.exclusionZones_CheckBox.toolTip =
      "<p>Exclude dark structures (e.g. dark nebulae) from the background search.</p>" +
      "<p><b>Before running the script:</b> create preview(s) over the areas you want to " +
      "exclude, and rename each preview to start with <b>Exclude</b> " +
      "(e.g. Exclude1, Exclude2).</p>" +
      "<p>All other existing previews (e.g. from Part 1 MGC) will be automatically removed. " +
      "Exclusion previews are also removed after the background search completes.</p>";
   this.exclusionZones_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.enableExclusionZones = checked;
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

   this.background_Section = new SectionBar( this, "Find Darkest Background" );
   this.background_Section.setSection( this.background_Control );
   this.background_Section.enableCheckBox( true );
   this.background_Section.checkBox.checked = WorkflowParameters.enableBackground;
   this.background_Section.checkBox.toolTip = "<p>Find the darkest background region for SPCC ROI.</p>";

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
   this.whiteRef_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.camera_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.filter_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.nbRedLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.nbGreenLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.nbBlueLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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
   this.autoSTF_Section.checkBox.toolTip = "<p>Adaptive Auto STF — automatically stretches the linear image for visualization after color calibration.</p>";

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
   this.bxtAutoPSF_Sizer.addSpacing( labelWidth -10 );
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

   this.bxtAiFile_Label = new Label( this );
   this.bxtAiFile_Label.text = "AI Model:";
   this.bxtAiFile_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.bxtAiFile_Label.setFixedWidth( 80 );

   this.bxtAiFile_Edit = new Edit( this );
   this.bxtAiFile_Edit.setFixedWidth( 300 );
   this.bxtAiFile_Edit.text = WorkflowParameters.bxtAiFile;
   this.bxtAiFile_Edit.toolTip = "<p>BXT AI model filename (e.g. BlurXTerminator.4.pb).</p>" +
      "<p>Leave empty to use PixInsight's own default setting.</p>";
   this.bxtAiFile_Edit.onEditCompleted = function()
   {
      WorkflowParameters.bxtAiFile = this.text.trim();
      WorkflowParameters.saveUserPrefs();
   };

   this.bxtAiFile_Browse = new ToolButton( this );
   this.bxtAiFile_Browse.icon = this.scaledResource( ":/icons/select-file.png" );
   this.bxtAiFile_Browse.setScaledFixedSize( 20, 20 );
   this.bxtAiFile_Browse.toolTip = "<p>Browse for BXT AI model file.</p>";
   this.bxtAiFile_Browse.onClick = function()
   {
      var fd = new OpenFileDialog;
      fd.caption = "Select BXT AI Model File";
      fd.filters = [["PB Files (*.pb)", "*.pb"], ["All Files (*)", "*"]];
      if (fd.execute()) {
         var filename = File.extractName(fd.fileName) + File.extractExtension(fd.fileName);
         WorkflowParameters.bxtAiFile = filename;
         dlg.bxtAiFile_Edit.text = filename;
         WorkflowParameters.saveUserPrefs();
      }
   };

   this.bxtAiFile_Sizer = new HorizontalSizer;
   this.bxtAiFile_Sizer.spacing = 4;
   this.bxtAiFile_Sizer.addStretch();
   this.bxtAiFile_Sizer.add( this.bxtAiFile_Label );
   this.bxtAiFile_Sizer.add( this.bxtAiFile_Edit );
   this.bxtAiFile_Sizer.add( this.bxtAiFile_Browse );

   // BXT Full section content
   this.bxtFull_Control = new Control( this );
   this.bxtFull_Control.sizer = new VerticalSizer;
   this.bxtFull_Control.sizer.margin = 6;
   this.bxtFull_Control.sizer.spacing = 4;
   this.bxtFull_Control.sizer.add( this.bxtAiFile_Sizer );
   this.bxtFull_Control.sizer.add( this.bxtSharpenStars_Control );
   this.bxtFull_Control.sizer.add( this.bxtAdjustHalos_Control );
   this.bxtFull_Control.sizer.addSpacing( 4 );
   this.bxtFull_Control.sizer.add( this.bxtAutoPSF_Sizer );
   this.bxtFull_Control.sizer.add( this.bxtPSFDiameter_Control );
   this.bxtFull_Control.sizer.add( this.bxtSharpenNonstellar_Control );

   this.bxtFull_Section = new SectionBar( this, "BlurXTerminator (Full Processing)" );
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

   // Large Overlap checkbox
   this.sxtLargeOverlap_CheckBox = new CheckBox( this );
   this.sxtLargeOverlap_CheckBox.text = "Large Overlap";
   this.sxtLargeOverlap_CheckBox.checked = WorkflowParameters.sxtLargeOverlap;
   this.sxtLargeOverlap_CheckBox.toolTip = "<p>Use larger tile overlap (0.50) for better seam blending.<br/>" +
      "Disabled = standard overlap 0.25 (faster). Enabled = 0.50 overlap (higher quality).</p>";
   this.sxtLargeOverlap_CheckBox.onCheck = function( checked )
   {
      WorkflowParameters.sxtLargeOverlap = checked;
      WorkflowParameters.saveUserPrefs();
   };

   // SXT section content
   this.sxtAiFile_Label = new Label( this );
   this.sxtAiFile_Label.text = "AI Model:";
   this.sxtAiFile_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.sxtAiFile_Label.setFixedWidth( 80 );

   this.sxtAiFile_Edit = new Edit( this );
   this.sxtAiFile_Edit.setFixedWidth( 400 );
   this.sxtAiFile_Edit.text = WorkflowParameters.sxtAiFile;
   this.sxtAiFile_Edit.toolTip = "<p>SXT AI model filename (e.g. StarXTerminator.lite.11.pb).</p>" +
      "<p>Leave empty to use PixInsight's own default setting.</p>";
   this.sxtAiFile_Edit.onEditCompleted = function()
   {
      WorkflowParameters.sxtAiFile = this.text.trim();
      WorkflowParameters.saveUserPrefs();
   };

   this.sxtAiFile_Browse = new ToolButton( this );
   this.sxtAiFile_Browse.icon = this.scaledResource( ":/icons/select-file.png" );
   this.sxtAiFile_Browse.setScaledFixedSize( 20, 20 );
   this.sxtAiFile_Browse.toolTip = "<p>Browse for SXT AI model file.</p>";
   this.sxtAiFile_Browse.onClick = function()
   {
      var fd = new OpenFileDialog;
      fd.caption = "Select SXT AI Model File";
      fd.filters = [["PB Files (*.pb)", "*.pb"], ["All Files (*)", "*"]];
      if (fd.execute()) {
         var filename = File.extractName(fd.fileName) + File.extractExtension(fd.fileName);
         WorkflowParameters.sxtAiFile = filename;
         dlg.sxtAiFile_Edit.text = filename;
         WorkflowParameters.saveUserPrefs();
      }
   };

   this.sxtAiFile_Sizer = new HorizontalSizer;
   this.sxtAiFile_Sizer.spacing = 4;
   this.sxtAiFile_Sizer.addStretch();
   this.sxtAiFile_Sizer.add( this.sxtAiFile_Label );
   this.sxtAiFile_Sizer.add( this.sxtAiFile_Edit );
   this.sxtAiFile_Sizer.add( this.sxtAiFile_Browse );

   this.sxt_Control = new Control( this );
   this.sxt_Control.sizer = new VerticalSizer;
   this.sxt_Control.sizer.margin = 6;
   this.sxt_Control.sizer.spacing = 4;
   this.sxt_Control.sizer.add( this.sxtAiFile_Sizer );
   this.sxt_Control.sizer.add( this.sxtGenerateStars_CheckBox );
   this.sxt_Control.sizer.add( this.sxtUnscreen_CheckBox );
   this.sxt_Control.sizer.add( this.sxtLargeOverlap_CheckBox );

   this.sxt_Section = new SectionBar( this, "StarXTerminator" );
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
   this.sn2Stride_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
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

   this.sn2_Control = new Control( this );
   this.sn2_Control.sizer = new VerticalSizer;
   this.sn2_Control.sizer.margin = 6;
   this.sn2_Control.sizer.spacing = 4;
   this.sn2_Control.sizer.add( this.sn2Stride_Sizer );
   this.sn2_Control.sizer.add( this.sn2Mask_CheckBox );
   this.sn2_Control.sizer.add( this.sn2Upsample_CheckBox );
   this.sn2_Control.sizer.add( this.sn2Linear_CheckBox );

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

   this.nxtAiFile_Label = new Label( this );
   this.nxtAiFile_Label.text = "AI Model:";
   this.nxtAiFile_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.nxtAiFile_Label.setFixedWidth( 80 );

   this.nxtAiFile_Edit = new Edit( this );
   this.nxtAiFile_Edit.setFixedWidth( 300 );
   this.nxtAiFile_Edit.text = WorkflowParameters.nxtAiFile;
   this.nxtAiFile_Edit.toolTip = "<p>NXT AI model filename (e.g. NoiseXTerminator.3.pb).</p>" +
      "<p>Leave empty to use PixInsight's own default setting.</p>";
   this.nxtAiFile_Edit.onEditCompleted = function()
   {
      WorkflowParameters.nxtAiFile = this.text.trim();
      WorkflowParameters.saveUserPrefs();
   };

   this.nxtAiFile_Browse = new ToolButton( this );
   this.nxtAiFile_Browse.icon = this.scaledResource( ":/icons/select-file.png" );
   this.nxtAiFile_Browse.setScaledFixedSize( 20, 20 );
   this.nxtAiFile_Browse.toolTip = "<p>Browse for NXT AI model file.</p>";
   this.nxtAiFile_Browse.onClick = function()
   {
      var fd = new OpenFileDialog;
      fd.caption = "Select NXT AI Model File";
      fd.filters = [["PB Files (*.pb)", "*.pb"], ["All Files (*)", "*"]];
      if (fd.execute()) {
         var filename = File.extractName(fd.fileName) + File.extractExtension(fd.fileName);
         WorkflowParameters.nxtAiFile = filename;
         dlg.nxtAiFile_Edit.text = filename;
         WorkflowParameters.saveUserPrefs();
      }
   };

   this.nxtAiFile_Sizer = new HorizontalSizer;
   this.nxtAiFile_Sizer.spacing = 4;
   this.nxtAiFile_Sizer.addStretch();
   this.nxtAiFile_Sizer.add( this.nxtAiFile_Label );
   this.nxtAiFile_Sizer.add( this.nxtAiFile_Edit );
   this.nxtAiFile_Sizer.add( this.nxtAiFile_Browse );
   this.nxtAiFile_Sizer.addSpacing( 6 );

   this.nxt_Control = new Control( this );
   this.nxt_Control.sizer = new VerticalSizer;
   this.nxt_Control.sizer.margin = 6;
   this.nxt_Control.sizer.spacing = 4;
   this.nxt_Control.sizer.add( this.nxtAiFile_Sizer );

   this.nxt_Section = new SectionBar( this, "NoiseXTerminator (calls tool only)" );
   this.nxt_Section.setSection( this.nxt_Control );
   this.nxt_Section.enableCheckBox( true );
   this.nxt_Section.checkBox.checked = WorkflowParameters.enableNXT;
   this.nxt_Section.checkBox.toolTip = "<p>Open NoiseXTerminator with selected AI model after the workflow completes.</p>" +
      "<p>With the original image active, drag the instance triangle to apply.</p>";

   this.nxt_Section.onCheckSection = function( sectionbar )
   {
      WorkflowParameters.enableNXT = sectionbar.checkBox.checked;
      dlg.nxt_Control.enabled = WorkflowParameters.enableNXT;
      if ( sectionbar.isCollapsed() && sectionbar.checkBox.checked )
         sectionbar.toggleSection();
      WorkflowParameters.saveUserPrefs();
   };
   this.nxt_Section.onToggleSection = toggleSectionHandler;

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
      WorkflowParameters.enableAutoColor  = false;
      dlg.autoColor_Section.checkBox.checked = false;
      dlg.autoColor_Control.enabled = false;
      WorkflowParameters.enableBXTCorrect = false;
      WorkflowParameters.enableBackground = false;
      WorkflowParameters.enableSPCC = false;
      WorkflowParameters.enableAutoSTF = false;
      WorkflowParameters.enableBXTFull = false;
      WorkflowParameters.enableSXT = false;
      WorkflowParameters.enableExclusionZones = false;

      dlg.bxtCorrect_Section.checkBox.checked = false;
      dlg.bxtCorrect_Control.enabled = false;
      dlg.background_Section.checkBox.checked = false;
      dlg.background_Control.enabled = false;
      dlg.exclusionZones_CheckBox.checked = false;
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
      WorkflowParameters.enableStarNet2     = false;
      WorkflowParameters.enableExclusionZones = false;

      WorkflowParameters.enableAutoColor = false;
      dlg.autoColor_Section.checkBox.checked = false;
      dlg.autoColor_Control.enabled = false;
      dlg.background_Section.checkBox.checked = true;
      dlg.background_Control.enabled = true;
      dlg.exclusionZones_CheckBox.checked = false;
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

      WorkflowParameters.saveUserPrefs();
      dlg.updateDependencies();
   };

   // Reset Settings button (cog - clears persistent equipment and processing preferences)
   this.resetSettingsButton = new ToolButton( this );
   var cogIconPath2 = SCRIPT_DIR + "/SH_Cog.png";
   if (File.exists(cogIconPath2))
      this.resetSettingsButton.icon = new Bitmap(cogIconPath2).scaledTo(24, 24);
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
      dlg.sxtGenerateStars_CheckBox.checked = true;
      dlg.sxtUnscreen_CheckBox.checked = false;
      dlg.sxtLargeOverlap_CheckBox.checked = false;
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
   this.autoColor_Control.enabled = WorkflowParameters.enableAutoColor;

   // Collapse sections with no user-selectable parameters
   this.bxtCorrect_Control.hide();
   this.autoSTF_Control.hide();
   this.sn2_Control.hide();
   this.nxt_Control.hide();
   this.autoColor_Control.hide();

   this.updateDependencies();

   this.ensureLayoutUpdated();
   this.adjustToContents();
   this.setMinWidth( 540 );
   this.setMinHeight();
}

SpaceHunterDialog2.prototype = new Dialog;

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
   console.writeln("  BXT Correct:  " + (WorkflowParameters.enableBXTCorrect ? "Yes" : "No"));
   console.writeln("  Background:   " + (WorkflowParameters.enableBackground ? "Yes" : "No") +
      (WorkflowParameters.enableExclusionZones ? " (exclusion zones enabled)" : ""));
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
   }
      console.writeln("  SXT:          " + (WorkflowParameters.enableSXT ? "Yes" : "No"));
      if (WorkflowParameters.enableSXT) {
      console.writeln("    Generate Stars: " + (WorkflowParameters.sxtGenerateStars ? "Yes" : "No"));
      console.writeln("    Unscreen:       " + (WorkflowParameters.sxtUnscreen ? "Yes" : "No"));
      console.writeln("    Large Overlap:  " + (WorkflowParameters.sxtLargeOverlap ? "Yes" : "No"));
	  console.writeln("  NXT:          " + (WorkflowParameters.enableNXT ? "Yes" : "No"));
   }
   console.writeln("=".repeat(80) + "\n");
}

// ============================================================
// STEP 2: BlurXTerminator - Correct Only
// ============================================================

// ============================================================
// Re-run Protection: warn if tool already ran on this image
// ============================================================
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
         StdIcon_Warning,
         StdButton_Yes, StdButton_No
      );
      var result = msg.execute();
      if (result === StdButton_No)
         throw new Error("Script cancelled by user.");
   }

   return true;
}

function runBXT_CorrectOnly()
{
    let win = ImageWindow.activeWindow;
    if (win.isNull)
        throw new Error("No active image window.");

    let view = win.currentView;
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
   if (WorkflowParameters.bxtAiFile) P.ai_file = WorkflowParameters.bxtAiFile;
    P.correct_only = true;
    P.correct_first = false;
    P.nonstellar_then_stellar = false;
    P.lum_only = false;
    P.sharpen_stars = 0.25;
    P.adjust_halos = -0.08;
    P.nonstellar_psf_diameter = 0.00;
    P.auto_nonstellar_psf = true;
    P.sharpen_nonstellar = 0.90;

    if (!P.executeOn(view)) {
        if (console.abortRequested)
            throw new Error("Script cancelled by user.");
        throw new Error("BlurXTerminator execution failed.");
    }

    processEvents();
    if (console.abortRequested)
        throw new Error("Script cancelled by user.");

    console.writeln("\u2714 BlurXTerminator (Correct Only) completed successfully.\n");
}

// ============================================================
// STEP 3: Gradient Descent Background Finder
// ============================================================

function calculateWindowSize(imageHeight) {
    return Math.min(Math.round(imageHeight * 0.05), 50);
}

function calculateSpacing(windowSize) {
    return Math.ceil(windowSize * 0.5);
}

function getAverageBrightness(image, x, y, channels) {
    if (channels === 1) {
        return image.sample(x, y, 0);
    } else {
        return (image.sample(x, y, 0) + image.sample(x, y, 1) + image.sample(x, y, 2)) / 3;
    }
}

function getWindowStats(image, x, y, windowSize, channels) {
    let pixelValues = [];
    let avgBrightness = 0;
    let sumSquares = 0;

    for (let ox = 0; ox < windowSize; ox++) {
        for (let oy = 0; oy < windowSize; oy++) {
            let brightness = getAverageBrightness(image, x + ox, y + oy, channels);
            pixelValues.push(brightness);
            avgBrightness += brightness;
            sumSquares += brightness * brightness;
        }
    }

    let numPixels = windowSize * windowSize;
    avgBrightness /= numPixels;
    let variance = sumSquares / numPixels - avgBrightness * avgBrightness;
    let stdDev = Math.sqrt(variance);

    pixelValues.sort((a, b) => a - b);
    let median = pixelValues[Math.floor(numPixels / 2)];

    let madSum = 0;
    for (let i = 0; i < numPixels; i++) {
        madSum += Math.abs(pixelValues[i] - median);
    }
    let mad = madSum / numPixels;

    return { average: avgBrightness, stddev: stdDev, median: median, mad: mad };
}

function randomStartingPoint(imageWidth, imageHeight, windowSize) {
    let x = Math.floor(Math.random() * (imageWidth - windowSize));
    let y = Math.floor(Math.random() * (imageHeight - windowSize));
    return { x: x, y: y };
}

function findBestWindow(image, startX, startY, windowSize, spacing, channels, exclusionRects) {
    let bestWindow = {
        average: 1000000000, stddev: 1000000000, mad: 1000000000, median: 1000000000,
        x: startX, y: startY
    };

    let currentX = startX;
    let currentY = startY;
    let improved = true;

    while (improved) {
        improved = false;
        for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
                let newX = currentX + ox * spacing;
                let newY = currentY + oy * spacing;

                if (newX >= 0 && newX + windowSize <= image.width &&
                    newY >= 0 && newY + windowSize <= image.height &&
                    !isInsideExclusion(newX, newY, windowSize, exclusionRects)) {

                    let stats = getWindowStats(image, newX, newY, windowSize, channels);

                    if (stats.average < bestWindow.average ||
                        (stats.average === bestWindow.average && stats.stddev < bestWindow.stddev)) {
                        bestWindow = {
                            average: stats.average, stddev: stats.stddev,
                            mad: stats.mad, median: stats.median,
                            x: newX, y: newY
                        };
                        improved = true;
                    }
                }
            }
        }
        currentX = bestWindow.x;
        currentY = bestWindow.y;
    }

    return bestWindow;
}

function isInsideExclusion(x, y, windowSize, exclusionRects) {
    if (exclusionRects.length === 0) return false;
    for (let i = 0; i < exclusionRects.length; i++) {
        let r = exclusionRects[i];
        // Check if the window overlaps with the exclusion rectangle
        if (x + windowSize > r.x0 && x < r.x1 &&
            y + windowSize > r.y0 && y < r.y1) {
            return true;
        }
    }
    return false;
}

function findDarkestBackgroundPreview() {
    console.writeln("\n" + "=".repeat(80));
    console.writeln("STEP 3: Gradient Descent Background Finder");
    console.writeln("=".repeat(80) + "\n");

    let win = ImageWindow.activeWindow;
    if (win.isNull)
        throw new Error("No active image window.");

    let img = win.mainView.image;
    let channels = img.numberOfChannels;

    // Collect exclusion zones from previews named "Exclude*"
    let exclusionRects = [];
    if (WorkflowParameters.enableExclusionZones) {
        let previews = win.previews;
        for (let i = 0; i < previews.length; i++) {
            if (previews[i].id.indexOf("Exclude") === 0) {
                let r = win.previewRect(previews[i]);
                exclusionRects.push(r);
                console.writeln("Exclusion zone: " + previews[i].id +
                    " [" + r.x0 + "," + r.y0 + " - " + r.x1 + "," + r.y1 + "]");
            }
        }
        if (exclusionRects.length > 0)
            console.writeln("Total exclusion zones: " + exclusionRects.length + "\n");
        else
            console.writeln("No exclusion previews found (name must start with 'Exclude').\n");
    }

    // Delete all existing previews (exclusion previews and any leftover MGC previews)
    let existing = win.previews;
    for (let i = existing.length - 1; i >= 0; i--)
        win.deletePreview(existing[i]);

    let windowSize = calculateWindowSize(img.height);
    let spacing = calculateSpacing(windowSize);

    console.writeln("Starting gradient descent background finder...");
    console.writeln("Window size: " + windowSize + "x" + windowSize + " pixels");
    console.writeln("Spacing: " + spacing + " pixels");

    let imageMedian = img.median();
    let threshold = 2 * imageMedian;
    console.writeln("Image median: " + imageMedian.toFixed(6));
    console.writeln("Threshold: " + threshold.toFixed(6) + "\n");

    let bestOverallWindow = null;
    let totalPaths = 50;
    let progressInterval = Math.ceil(totalPaths / 10);

    console.write("Running " + totalPaths + " descent paths: ");

    for (let i = 0; i < totalPaths; i++) {
        if (console.abortRequested) {
            console.writeln("\n\u26A0 Background finder aborted by user.");
            return null;
        }
        let startPoint = randomStartingPoint(img.width, img.height, windowSize);
        let attempts = 0;
        while ((getWindowStats(img, startPoint.x, startPoint.y, windowSize, channels).average >= threshold ||
                isInsideExclusion(startPoint.x, startPoint.y, windowSize, exclusionRects)) && attempts < 100) {
            startPoint = randomStartingPoint(img.width, img.height, windowSize);
            attempts++;
        }

        let bestWindow = findBestWindow(img, startPoint.x, startPoint.y, windowSize, spacing, channels, exclusionRects);

        if (!bestOverallWindow ||
            bestWindow.average < bestOverallWindow.average ||
            (bestWindow.average === bestOverallWindow.average && bestWindow.stddev < bestOverallWindow.stddev)) {
            bestOverallWindow = {
                average: bestWindow.average, stddev: bestWindow.stddev,
                mad: bestWindow.mad, median: bestWindow.median,
                x: bestWindow.x, y: bestWindow.y
            };
        }

        if ((i + 1) % progressInterval === 0 || i === totalPaths - 1) {
            console.write(Math.ceil(((i + 1) / totalPaths) * 100) + "%... ");
        }
    }

    console.writeln("\n");

    if (bestOverallWindow === null)
        throw new Error("No suitable background region found.");

    let brightnessArray = [];
    for (let c = 0; c < channels; c++)
        brightnessArray[c] = 0;

    for (let ox = 0; ox < windowSize; ox++) {
        for (let oy = 0; oy < windowSize; oy++) {
            for (let c = 0; c < channels; c++) {
                brightnessArray[c] += img.sample(bestOverallWindow.x + ox, bestOverallWindow.y + oy, c);
            }
        }
    }

    let numPixels = windowSize * windowSize;
    for (let c = 0; c < channels; c++)
        brightnessArray[c] /= numPixels;

    let highestValue = brightnessArray[0];
    for (let c = 1; c < channels; c++) {
        if (brightnessArray[c] > highestValue)
            highestValue = brightnessArray[c];
    }

    let previewRect = new Rect(
        bestOverallWindow.x, bestOverallWindow.y,
        bestOverallWindow.x + windowSize, bestOverallWindow.y + windowSize
    );
    win.createPreview(previewRect, "Background");

    console.writeln("===== RESULTS =====");
    console.writeln("\nPreview created: Background");
    console.writeln("Size: " + windowSize + "x" + windowSize + " pixels");
    console.writeln("  X: " + bestOverallWindow.x + "  Y: " + bestOverallWindow.y);
    console.writeln("  Avg brightness: " + bestOverallWindow.average.toFixed(6));
    console.writeln("  Median: " + bestOverallWindow.median.toFixed(6));
    console.writeln("  StdDev: " + bestOverallWindow.stddev.toFixed(6));
    console.writeln("  MAD: " + bestOverallWindow.mad.toFixed(6));

    if (channels > 1) {
        console.writeln("\nChannel brightness: R=" + brightnessArray[0].toFixed(6) +
           " G=" + brightnessArray[1].toFixed(6) + " B=" + brightnessArray[2].toFixed(6));
    }

    console.writeln("\n\u2714 Background finder complete.\n");

    return true;
}

// ============================================================
// STEP 4: SPCC with Background ROI
// ============================================================

function runSPCC()
{
    let win = ImageWindow.activeWindow;
    if (win.isNull) throw new Error("No active image window.");
    let view = win.currentView;
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
        if (flt.type === "pan" || flt.type === "lum") {
            throw new Error("PAN/L filters cannot be used with SPCC. Select an RGB or pre-combined filter set.");
        }
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

    P.backgroundROI = new Rect(roiX0, roiY0, roiX1, roiY1);

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
    P.psfType = SpectrophotometricColorCalibration.prototype.PSFType_Auto;
    P.psfGrowth = 1.75;
    P.psfMaxStars = 24576;
    P.psfSearchTolerance = 4.0;
    P.psfChannelSearchTolerance = 2.0;
    P.generateGraphs = false;
    P.generateStarMaps = false;
    P.generateTextFiles = false;
    P.outputDirectory = "";

    if (!P.executeOn(view)) {
        if (console.abortRequested)
            throw new Error("Script cancelled by user.");
        throw new Error("SPCC execution failed.");
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
// ============================================================

function runAutoColor()
{
   var win = ImageWindow.activeWindow;
   if ( win.isNull ) throw new Error( "No active image window." );

   var view = win.currentView;
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
   var sky = new Array( img.width * img.height );
   img.getPixels( sky );

   var nsky  = sky.length;
   var nlast = nsky - 1;
   sky.sort( function(a, b) { return a > b; } );

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
   P.mode                      = BackgroundNeutralization.prototype.TargetBackground;
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
// STEP 5: Adaptive Auto STF
// ============================================================

function autoSTF()
{
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 5: Applying Adaptive Auto STF");
   console.writeln("=".repeat(80) + "\n");

   var view = ImageWindow.activeWindow.currentView;
   if (view.isNull)
      throw new Error("No active view found.");

   var img = view.image;

   // =========================================================================
   // Configuration constants
   // =========================================================================

   var CLIP_SIGMA = 2.8;
   var MADN_BLEND = 0.25;
   var FALLBACK_THRESHOLD_MIN = 0.000070;
   var FALLBACK_THRESHOLD_MAX = 0.000260;
   var TARGET_BRIGHT = 0.26;
   var TARGET_FAINT  = 0.30;
   var MEDIAN_FAINT  = 0.0005;
   var MEDIAN_BRIGHT = 0.008;
   var MIN_NORMALIZED_MEDIAN = 1.0e-7;

   // =========================================================================
   // Helper functions
   // =========================================================================

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

   function computeChannelSTF(img, channel) {
      img.selectedChannel = channel;

      var median = img.median();
      var mad    = img.MAD();

      var blend = brightnessBlend(median, MEDIAN_FAINT, MEDIAN_BRIGHT);
      var targetBrightness = lerp(TARGET_FAINT, TARGET_BRIGHT, blend);

      var c0;
      var madn = mad * 1.4826;

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

      return {
         c0: c0,
         m: m,
         median: median,
         mad: mad,
         normalizedMedian: normalizedMedian,
         targetBrightness: targetBrightness,
         blend: blend
      };
   }

   // =========================================================================
   // Main processing
   // =========================================================================

   console.writeln("View: " + view.id);
   console.writeln("Image: " + img.width + " x " + img.height +
                   (img.isColor ? " (Color RGB)" : " (Grayscale)"));

   if (img.isColor) {
      var channelNames = ["Red", "Green", "Blue"];
      var results = [];

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

         results[c] = {
            c0: c0,
            m: m,
            median: median,
            mad: mad,
            madn: madn,
            blendedMADN: blendedMADN,
            normalizedMedian: normalizedMedian,
            targetBrightness: targetBrightness,
            blend: blend
         };
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

      console.writeln("");
      console.writeln("Configuration:");
      console.writeln("  Clip sigma: " + CLIP_SIGMA);
      console.writeln("  MADN blend: " + MADN_BLEND + " (0=per-ch, 1=averaged)");
      console.writeln("  Avg MADN: " + avgMADN.toFixed(7));
      console.writeln("  Target range: " + TARGET_FAINT + " (faint) .. " + TARGET_BRIGHT + " (bright)");
      console.writeln("");
      for (var c = 0; c < 3; ++c) {
         var r = results[c];
         var brightnessLabel = r.blend < 0.33 ? "faint" :
                               r.blend < 0.66 ? "moderate" : "bright";
         console.writeln(channelNames[c] + ":");
         console.writeln("  median=" + r.median.toFixed(7) +
                        ", MADN=" + r.madn.toFixed(7) +
                        ", blendedMADN=" + r.blendedMADN.toFixed(7) +
                        " (" + brightnessLabel + ")");
         console.writeln("  c0=" + r.c0.toFixed(6) +
                        ", normMedian=" + r.normalizedMedian.toFixed(7) +
                        ", target=" + r.targetBrightness.toFixed(4) +
                        ", m=" + r.m.toFixed(6));
      }

      console.writeln("\n\u2714 Adaptive Auto STF Applied");

   } else {
      var r = computeChannelSTF(img, 0);

      var P = new ScreenTransferFunction;
      P.STF = [
         [r.c0, 1.0, r.m, 0.0, 1.0],
         [0.0, 1.0, 0.5, 0.0, 1.0],
         [0.0, 1.0, 0.5, 0.0, 1.0],
         [0.5, 1.0, 0.0, 0.0, 1.0]
      ];
      P.executeOn(view, false);

      console.writeln("");
      console.writeln("Grayscale channel:");
      console.writeln("  median=" + r.median.toFixed(7) +
                     ", MAD=" + r.mad.toFixed(7));
      console.writeln("  c0=" + r.c0.toFixed(6) +
                     ", normMedian=" + r.normalizedMedian.toFixed(7) +
                     ", target=" + r.targetBrightness.toFixed(4) +
                     ", m=" + r.m.toFixed(6));

      console.writeln("\n\u2714 Adaptive Auto STF Applied (Grayscale)");
   }

   img.resetChannelSelection();
   console.writeln("");
}

// ============================================================
// STEP 6: BlurXTerminator - Full Processing (with dialog params)
// ============================================================

function runBXT_Full()
{
   let win = ImageWindow.activeWindow;
   if (win.isNull) throw new Error("No active image window.");
   let view = win.currentView;
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
   if (WorkflowParameters.bxtAiFile) P.ai_file = WorkflowParameters.bxtAiFile;
   P.correct_only = false;
   P.correct_first = false;
   P.nonstellar_then_stellar = false;
   P.lum_only = false;

   P.sharpen_stars = WorkflowParameters.bxtSharpenStars;
   P.adjust_halos = WorkflowParameters.bxtAdjustHalos;

   P.auto_nonstellar_psf = WorkflowParameters.bxtAutoPSF;
   P.nonstellar_psf_diameter = WorkflowParameters.bxtPSFDiameter;
   P.sharpen_nonstellar = WorkflowParameters.bxtSharpenNonstellar;

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
   let view = win.currentView;
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
   console.writeln("  Large Overlap:  " + (WorkflowParameters.sxtLargeOverlap ? "Yes (0.50)" : "No (0.00)"));
   console.writeln("");

   if ( typeof StarXTerminator === "undefined" ) {
      console.warningln("\u26A0 StarXTerminator is not installed - skipping SXT.");
      if ( WorkflowParameters.enableStarNet2 && typeof StarNet2 !== "undefined" ) {
         console.writeln("  \u2192 Falling back to StarNet2.\n");
         runStarNet2();
      } else {
         console.warningln("  \u26A0 StarNet2 not available or not enabled - no star removal performed.\n");
      }
      return;
   }
   var P = new StarXTerminator;
   if (WorkflowParameters.sxtAiFile) P.ai_file = WorkflowParameters.sxtAiFile;
   P.stars = WorkflowParameters.sxtGenerateStars;
   P.unscreen = WorkflowParameters.sxtUnscreen;
   P.overlap = WorkflowParameters.sxtLargeOverlap ? 0.50 : 0.25;

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
   let view = win.currentView;
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

      selectEquipment();

      // Exclusion Zones pre-flight check
      if (WorkflowParameters.enableBackground && WorkflowParameters.enableExclusionZones) {
         var win = ImageWindow.activeWindow;
         var previews = win.previews;
         if (previews.length === 0) {
            throw new Error("No Exclude previews found. Please create previews named Exclude, Exclude1, etc. before running.");
         }
         var hasExclude = false;
         for (var i = 0; i < previews.length; i++) {
            if (previews[i].id.indexOf("Exclude") === 0) { hasExclude = true; break; }
         }
         if (!hasExclude) {
            throw new Error("Previews exist but none are named correctly. Please rename them to Exclude, Exclude1, etc.");
         }
      }

      // Pre-flight: astrometric solution check (required for SPCC)
      if (WorkflowParameters.enableSPCC) {
         var win = ImageWindow.activeWindow;
         var hasAstrometry = false;
         try {
            var prop = win.mainView.propertyValue("PCL:AstrometricSolution:CreatorModule");
            if (prop !== null && prop !== undefined)
               hasAstrometry = true;
         } catch (e) {}
         if (!hasAstrometry) {
            throw new Error("No astrometric solution found. Please run Part 1 (ImageSolver) before running SPCC.");
         }
         console.writeln("\u2714 Astrometric solution found - SPCC can proceed.\n");
      }

      // Re-run Protection: warn if script was previously applied to this image
      var win = ImageWindow.activeWindow;
      var view = win.mainView;
      var scriptRanBefore = false;
      try { if (view.propertyValue("SpaceHunter:ScriptRan") !== null) scriptRanBefore = true; } catch(e) {}
      try { if (view.propertyValue("PCL:SPCC:WhiteBalanceFactors") !== null) scriptRanBefore = true; } catch(e) {}

      if (scriptRanBefore) {
         var msg = new MessageBox(
            "<p><b>Warning: This script may have already been applied to this image.</b></p>" +
            "<p>Running it again may damage your image.</p>" +
            "<p>Check History Explorer before continuing.</p>" +
            "<p>Continue anyway?</p>",
            "Warning: Script Already Applied",
            StdIcon_Warning,
            StdButton_Yes, StdButton_No
         );
         if (msg.execute() === StdButton_No)
            throw new Error("Script cancelled by user.");
      }

      if (WorkflowParameters.enableBXTCorrect) {
         runBXT_CorrectOnly();
      } else {
         console.writeln("BXT Correct Only is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableBackground) {
         var bgResult = findDarkestBackgroundPreview();
         if (bgResult === null) {
            console.warningln("\u26A0 Workflow aborted during Background Finder.");
            return;
         }
      } else {
         console.writeln("Background Finder is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableSPCC) {
         runSPCC();
      } else {
         console.writeln("SPCC is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableAutoColor) {
         runAutoColor();
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
      } else {
         console.writeln("BXT Full is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableSXT) {
         runSXT();
      } else {
         console.writeln("StarXTerminator is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableStarNet2) {
         runStarNet2();
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
            if (WorkflowParameters.nxtAiFile) nxt.ai_file = WorkflowParameters.nxtAiFile;
            nxt.launch();
         }
         console.writeln("\u2714 NoiseXTerminator opened.\n");
      } else {
         console.writeln("NoiseXTerminator is DISABLED - skipping\n");
      }

      let endTime = new Date();
      let elapsedMs = endTime - startTime;
      let elapsedSec = Math.floor(elapsedMs / 1000);
      let minutes = Math.floor(elapsedSec / 60);
      let seconds = elapsedSec % 60;

      var finalWin = ImageWindow.activeWindow;
      var finalView = finalWin.mainView;
      try { finalView.setPropertyValue("SpaceHunter:ScriptRan", true); } catch(e) {}
      if (WorkflowParameters.enableBXTCorrect) try { finalView.setPropertyValue("SpaceHunter:BXTCorrectDone", true); } catch(e) {}
      if (WorkflowParameters.enableBackground)  try { finalView.setPropertyValue("SpaceHunter:BackgroundDone", true); } catch(e) {}
      if (WorkflowParameters.enableSPCC)        try { finalView.setPropertyValue("SpaceHunter:SPCCDone", true); } catch(e) {}
      if (WorkflowParameters.enableBXTFull)     try { finalView.setPropertyValue("SpaceHunter:BXTFullDone", true); } catch(e) {}
      if (WorkflowParameters.enableSXT)         try { finalView.setPropertyValue("SpaceHunter:SXTDone", true); } catch(e) {}
      if (WorkflowParameters.enableStarNet2)    try { finalView.setPropertyValue("SpaceHunter:StarNet2Done", true); } catch(e) {}

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