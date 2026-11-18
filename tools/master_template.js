#engine v8

#feature-id @@FEATURE_ID@@ : Space_Hunter > @@MENU_NAME@@
#feature-icon  @script_icons_dir/@@ICON@@
#feature-info Space Hunter Lazy Workflow Master@@NAME_SUFFIX@@ @@MASTER_VERSION@@ (@@BUILD_LABEL@@)<br/>\
   <br/>\
   Runs SH Lazy Workflow Part 1 (@@P1_VERSION@@) and Part 2 (@@P2_VERSION@@) as one workflow.<br/>\
   Part 2 continues right after a background model or GC result is applied<br/>\
   in Part 1's chooser panel. Stops after opening DBE, and picks up where<br/>\
   the image was left (re-run marks and History Explorer).<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.<br/>\
   AutoColor.js Copyright &copy; 2016 Hartmut V. Bornemann. Used with written permission.

// ============================================================
// Space Hunter Lazy Workflow Master@@NAME_SUFFIX@@ @@MASTER_VERSION@@ (@@BUILD_LABEL@@)
//
// GENERATED FILE - DO NOT EDIT. Built by build_master.py from:
@@BUILD_INFO@@
//
// Copyright (c) 2026 Georg G Albrecht. MIT License.
// All acknowledgments of Part 1 and Part 2 apply (see their headers,
// reproduced unchanged inside the two part sections below).
//
// How it is put together
// ----------------------
// Part 1 and Part 2 are copied in unchanged, each inside its own function
// scope (they share many global names: WorkflowParameters, filterList,
// selectEquipment, ...). Only these changes are made by the build:
//  - #engine / #feature-* lines of the parts removed;
//  - macros SCRIPT_NAME / SCRIPT_VERSION renamed P1_... / P2_...;
//  - Part 1's ImageSolver #include moved out to file level, after Part 2
//    (ImageSolver #defines VERSION, TITLE, ... - Part 2's text must not
//    come after those macros);
//  - each part's main() is replaced by the master hooks below (setup,
//    dialog and run split, so both dialogs come before any processing);
//  - each part sees its own "Parameters" with a key prefix (P1_ / P2_):
//    both parts use keys like enableNarrowband for different things.
// Saved settings (Settings, not instance parameters) are the SAME as the
// single scripts': Part 1's and Part 2's dialogs remember what you chose
// in either.
//
// Master flow
// -----------
// Step M0: State of the active image (re-run marks, History Explorer) and
//          choice: Part 1 + Part 2 / Part 1 only / Part 2 only.
// Step M1: Part 1 dialog, then Part 2 dialog (Part 2's equipment pre-set
//          from Part 1's SPFC selection when both run), then Part 2's
//          background pre-check (IFN / dust map) if the image is solved;
//          the background finder itself still runs at Part 2 Step 2.
// Step M2: Part 1 run (Steps 1-6 as in Part 1).
// Step M3: Part 2 run (Steps 1-11 as in Part 2) - only when Part 1 ended
//          with a gradient correction applied in this run (Apply in the
//          MGC model panel or the GC result panel). It stops instead when
//          ImageSolver needs the user, DBE was opened, or the panel was
//          closed / a tool opened without Apply. With DBE ticked in Part 1,
//          Part 2's dialog is skipped at M1 already (v0.2.1). Run the master again
//          afterwards: a DBE / MGC / GC / ABE step in the active history
//          (or Part 1's gradient mark) counts as "Part 1 done".
// v0.3.6:  TEST "simulate MGC failure" checkbox moved to the author's
//          internal build (Georg 2026-11-18); the release has none.
// v0.3.5:  back to Part 2 v2.4.27: v2.4.28 (MAS preview window moved to the
//          upper left) dropped - PJSR cannot place the minimised icon, only
//          the window, and the icon was what mattered (Georg 2026-11-18).
// v0.3.4:  closing lines: "MASTER ENDED - stopped before Part 2" instead of
//          "MASTER FINISHED" after a stop; a cancel says where it happened
//          (dialogs / Part 1 / Part 2) and how to go on (PI-tested OK).
// v0.3.3:  PTeam 2026-11-18 (CPD rule 5.3): no acceptable Windows sound player.
//          The release build has NO sound on any system. The sound code is
//          not in this template: build_master.py fills the [internal:<name>]
//          lines from a local file for the author's internal build only.
// v0.3.2:  no active image: information box instead of an error with alarm.
// v0.3.1:  menu item without "(TEST)": Dialog.browseScriptDocumentation() finds a
//          script only by its registered menu name (PJSR Dialog reference).
// v0.3.0:  built on Part 1 v2.7.32 / Part 2 v2.4.27 (no keyword writes);
//          [master timing] wrappers removed; Documentation button; macOS /
//          Linux sound player started directly (no /bin/sh, CPD rule 5.3).
// v0.2.9:  TEST checkbox: simulate MGC failure -> GC fallback path.
// v0.2.8:  GraXpert hint quotes the image id ("image").
// v0.2.7:  Proxy removed (it crashed on deletePreview); found: window.keywords = 136.6 s.
// v0.2.6:  TEST timing via a window Proxy (deletePreview, keywords, currentView).
// v0.2.5:  wav path fixed (was falling back to the beep); Alarm01 / Ring08 (Georg).
// v0.2.4:  deprecation fixes; TEST timing of the model-panel Apply steps.
// v0.2.3:  alarm repeats for 10 s, stopped when the model / GC panel closes.
// v0.2.2:  sound (ExternalProcess, OS player) before the model / GC panel,
//          at a stop, an error and at the end; start-dialog switch. Hint for
//          a PixelMath copy step (GraXpert) - shown, not counted.
// ============================================================

CoreApplication.ensureMinimumVersion(1, 9, 6);

#define SHM_NAME    "Space Hunter Lazy Workflow Master@@NAME_SUFFIX@@"
#define SHM_VERSION "@@MASTER_VERSION@@"
// Manual folder = MENU name (Dialog.browseScriptDocumentation), not the ID.
var SHM_DOC_NAME = "@@MENU_NAME@@";

// Instance parameters seen by one part: every key gets the part's prefix.
function shmPrefixedParameters(P, prefix)
{
   return {
      get isViewTarget()   { return P.isViewTarget; },
      get isGlobalTarget() { return P.isGlobalTarget; },
      has:        function(k)    { return P.has(prefix + k); },
      set:        function(k, v) { P.set(prefix + k, v); },
      getBoolean: function(k)    { return P.getBoolean(prefix + k); },
      getInteger: function(k)    { return P.getInteger(prefix + k); },
      getReal:    function(k)    { return P.getReal(prefix + k); },
      getString:  function(k)    { return P.getString(prefix + k); }
   };
}

// [internal:globals]

// [internal:simGlobals]

// [internal:functions]

// ############################################################
// PART 2 - SH Lazy Workflow Part 2 @@P2_VERSION@@ (unchanged copy)
// ############################################################
var SHM_Part2 = (function(PIParameters) {
var Parameters = shmPrefixedParameters(PIParameters, "P2_");

@@P2_CODE@@

// ------------------------------------------------------------
// Master hooks for Part 2 (replace Part 2's main())
// ------------------------------------------------------------

// Databases + saved settings. eq = Part 1's SPFC equipment (or null): used
// for camera, filter set, white reference and narrowband values when Part 2
// has the same entry, so SPCC starts with what SPFC used.
function shmPrepare(eq)
{
   parseFiltersXSPD();
   parseWhiteRefXSPD();
   buildDropdownLists();
   if (WorkflowParameters.selectedCameraIdx === -1) {
      var idealIdx = 0;
      for (var i = 0; i < cameraList.length; i++)
         if (cameraList[i].label.indexOf("Ideal") >= 0) { idealIdx = i; break; }
      WorkflowParameters.selectedCameraIdx = idealIdx;
   }
   WorkflowParameters.loadUserPrefs();
   if (Parameters.isViewTarget || Parameters.isGlobalTarget) {
      try {
         WorkflowParameters.load();
      } catch (e) {
         console.warningln("⚠ Some process icon values (Part 2) could not be read (" +
                           shErrorText(e) + ") - saved settings used for them.");
      }
   }
   WorkflowParameters.validate();

   if (eq) {
      var W = WorkflowParameters, taken = [], kept = [];
      if (shIndexBy(cameraList, "xspdName", eq.camera) >= 0) {
         W.selectedCameraName = eq.camera; taken.push("camera");
      } else kept.push("camera");
      if (shIndexBy(whiteRefList, "name", eq.whiteRef) >= 0) {
         W.selectedWhiteRefName = eq.whiteRef; taken.push("white reference");
      } else kept.push("white reference");
      W.enableNarrowband = eq.narrowband;
      if (eq.narrowband) {
         W.nbRedWavelength   = eq.nb[0]; W.nbRedBandwidth   = eq.nb[1];
         W.nbGreenWavelength = eq.nb[2]; W.nbGreenBandwidth = eq.nb[3];
         W.nbBlueWavelength  = eq.nb[4]; W.nbBlueBandwidth  = eq.nb[5];
         taken.push("narrowband values");
      } else if (shIndexBy(filterList, "label", eq.filterLabel) >= 0) {
         W.selectedFilterLabel = eq.filterLabel; taken.push("filter set");
      } else kept.push("filter set");
      console.writeln("Part 2 equipment from Part 1's SPFC: " + (taken.join(", ") || "none") +
                      (kept.length ? " (kept Part 2's own " + kept.join(", ") +
                                     ": not in Part 2's list)" : ""));
   }
   WorkflowParameters.resolveSelection();
}

function shmDialog()
{
   selectEquipment();   // throws "Script cancelled by user." on Cancel
}

// Background pre-check (IFN / dust map dialog) right after Part 2's dialog,
// before anything is processed. It reads only the previews and the dust
// map at the image's coordinates (astrometric solution) - no pixel values -
// so it can come first; the finder itself still runs at Step 2 (after
// Part 1's gradient correction and BXT Correct) with the choice made here
// (BG_DUST_INPUT) and the Exclude previews present at that time. Not up
// front when the image has no solution yet (Part 1 solves it): then the
// pre-check stays at its place in the run.
var shmPrecheckDone = false;
function shmPrecheck()
{
   var W = WorkflowParameters;
   if (!(W.enableBackground && W.enableBgPrecheck))
      return;
   var win = ImageWindow.activeWindow;
   if (win.isNull || shBackgroundDone(win))
      return;                            // the finder is skipped anyway
   var solved = false;
   try { solved = win.hasAstrometricSolution; } catch (e) {}
   if (!solved) {
      console.writeln("Background pre-check: no astrometric solution yet - it comes in Part 2, after Part 1's solve.\n");
      return;
   }
   console.writeln("\n" + "=".repeat(80));
   console.writeln("STEP 2 (pre-check, before processing): Background pre-check / dust map");
   console.writeln("=".repeat(80) + "\n");
   if (!runBackgroundPrecheck())
      throw new Error("Script cancelled by user.");
   shmPrecheckDone = true;
}

// Part 2's main() from the pre-flight check on, unchanged except that
// errors go to the master (it reports cancel / error once).
function shmRun()
{
      console.writeln("\n" + "=".repeat(80));
      console.writeln(P2_SCRIPT_NAME + " " + P2_SCRIPT_VERSION);
      console.writeln("BXT Correct → Background → SPCC / AutoColor → Auto Display Stretch → BXT Full → MAS preview → SXT / StarNet2 → MLDenoise / NXT");
      console.writeln("=".repeat(80) + "\n");

      // Pre-flight: astrometric solution check (required for SPCC)
      if (WorkflowParameters.enableSPCC) {
         var win = ImageWindow.activeWindow;
         var hasAstrometry = false;
         try {
            hasAstrometry = win.hasAstrometricSolution;
         } catch (e) {
            try {
               var v = win.mainView;
               hasAstrometry = v.hasProperty("AstrometricSolution:CreatorModule") ||
                               v.hasProperty("PCL:AstrometricSolution:CreatorModule");
            } catch (e2) {}
         }
         if (!hasAstrometry) {
            throw new Error("No astrometric solution found. Please run Part 1 (ImageSolver) before running SPCC.");
         }
         console.writeln("✔ Astrometric solution found - SPCC can proceed.\n");
      }

      var win = ImageWindow.activeWindow;
      var view = win.mainView;
      var done = {}, ticked = 0, applied = [];
      var allSteps = SH_STEPS.concat(SH_TOOL_STEPS);
      for (var m = 0; m < allSteps.length; m++) {
         var st = allSteps[m];
         if (!WorkflowParameters[st.enable]) continue;
         ticked++;
         done[st.enable] = shStepDone(view, st);
         if (done[st.enable]) applied.push(st.name);
      }
      var bgDone = WorkflowParameters.enableBackground && shBackgroundDone(win);

      if (ticked > 0 && applied.length === ticked && !WorkflowParameters.enableMASPreview) {
         var msg = new MessageBox(
            "<p><b>Warning: All selected steps are already applied to this image:</b></p>" +
            "<p>" + applied.join("<br/>") + "</p>" +
            "<p>Running them again may damage your image.</p>" +
            "<p>To redo steps, move back in History Explorer first.</p>" +
            "<p>Run them again anyway?</p>",
            "Warning: Script Already Applied",
            StdIcon.Warning,
            StdButton.No, StdButton.Yes   // No first = default
         );
         if (msg.execute() !== StdButton.Yes)
            throw new Error("Script cancelled by user.");
         done = {};
         bgDone = false;
      }

      if (WorkflowParameters.enableBackground && WorkflowParameters.enableBgPrecheck && !bgDone &&
          !shmPrecheckDone) {   // master: already shown after Part 2's dialog
         if (!runBackgroundPrecheck())
            throw new Error("Script cancelled by user.");
      }

      if (WorkflowParameters.enableBXTCorrect) {
         if (done.enableBXTCorrect)
            shLogSkip("BlurXTerminator (Correct Only)");
         else
            runBXT_CorrectOnly();
      } else {
         console.writeln("BXT Correct Only is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableBackground) {
         if (bgDone)
            console.writeln("✔ Background preview from the earlier run kept - finder skipped.\n");
         else {
            findDarkestBackgroundPreview();
            shMarkDone(view, "SpaceHunter:BackgroundDone");
         }
      } else {
         console.writeln("Background Finder is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableSPCC) {
         if (done.enableSPCC)
            shLogSkip("SPCC");
         else {
            runSPCC();
            shMarkDone(view, "SpaceHunter:SPCCDone");
         }
      } else {
         console.writeln("SPCC is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableAutoColor) {
         if (done.enableAutoColor)
            shLogSkip("AutoColor");
         else
            runAutoColor();
      } else {
         console.writeln("AutoColor is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableAutoSTF) {
         autoSTF();
      } else {
         console.writeln("Auto Display Stretch is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableBXTFull) {
         if (done.enableBXTFull)
            shLogSkip("BlurXTerminator (Full)");
         else if (runBXT_Full())
            shMarkDone(view, "SpaceHunter:BXTFullDone");
      } else {
         console.writeln("BXT Full is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableMASPreview) {
         runMASPreview(win);
      }

      if (WorkflowParameters.enableSXT) {
         if (done.enableSXT)
            shLogSkip("StarXTerminator");
         else if (runSXT())
            shMarkDone(view, "SpaceHunter:SXTDone");
      } else {
         console.writeln("StarXTerminator is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableStarNet2) {
         if (done.enableStarNet2)
            shLogSkip("StarNet2");
         else if (runStarNet2())
            shMarkDone(view, "SpaceHunter:StarNet2Done");
      } else {
         console.writeln("StarNet2 is DISABLED - skipping\n");
      }

      let originalWin = ImageWindow.activeWindow;
      if (!originalWin.isNull)
         originalWin.bringToFront();

      if (WorkflowParameters.enableMLDenoise && done.enableMLDenoise) {
         shLogSkip("MLDenoise");
      } else if (WorkflowParameters.enableMLDenoise) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 10: Opening MLDenoise");
         console.writeln("=".repeat(80) + "\n");
         if ( typeof MLDenoise === "undefined" ) {
            console.warningln("⚠ MLDenoise is not installed - skipping.\n");
         } else {
            var mld = new MLDenoise;
            if ( WorkflowParameters.mldModelPath )
               mld.modelPath = WorkflowParameters.mldModelPath;
            mld.launch();
            console.writeln("✔ MLDenoise opened.\n");
         }
      } else {
         console.writeln("MLDenoise is DISABLED - skipping\n");
      }

      if (WorkflowParameters.enableNXT && done.enableNXT) {
         shLogSkip("NoiseXTerminator");
      } else if (WorkflowParameters.enableNXT) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 11: Opening NoiseXTerminator");
         console.writeln("=".repeat(80) + "\n");
         if ( typeof NoiseXTerminator === "undefined" ) {
            console.warningln("⚠ NoiseXTerminator is not installed - skipping NXT.\n");
         } else {
            var nxt = new NoiseXTerminator;
            nxt.ml_version = WorkflowParameters.nxtMlVersion;
            nxt.overlap = WorkflowParameters.nxtTileOverlap;
            nxt.launch();
            console.writeln("✔ NoiseXTerminator opened.\n");
         }
      } else {
         console.writeln("NoiseXTerminator is DISABLED - skipping\n");
      }

      console.writeln("\n" + "=".repeat(80));
      console.writeln("✅ PART 2 FINISHED ✅");
      console.writeln("=".repeat(80) + "\n");
}

// Part 2 marks on the image, in run order (for the master's state check).
function shmMarks()
{
   var list = [ { name: "BlurXTerminator (Correct Only)", mark: "SpaceHunter:BXTCorrectDone" },
                { name: "Background preview",             mark: "SpaceHunter:BackgroundDone" } ];
   for (var i = 1; i < SH_STEPS.length; i++)
      list.push({ name: SH_STEPS[i].name, mark: SH_STEPS[i].mark });
   return list;
}

return {
   version:  P2_SCRIPT_VERSION,
   prepare:  shmPrepare,
   dialog:   shmDialog,
   precheck: shmPrecheck,
   run:      shmRun,
   marks:    shmMarks,
   mismatch: shSpfcSpccMismatch
};
})(Parameters);

// ############################################################
// ImageSolver library (moved here from Part 1, see header)
// ############################################################
/* beautify ignore:start */
#define USE_SOLVER_LIBRARY true
#define SETTINGS_MODULE     "SOLVER"
#include "../ImageSolver/ImageSolver.js"
/* beautify ignore:end */

// ############################################################
// PART 1 - SH Lazy Workflow Part 1 @@P1_VERSION@@ (unchanged copy)
// ############################################################
var SHM_Part1 = (function(PIParameters) {
var Parameters = shmPrefixedParameters(PIParameters, "P1_");

@@P1_CODE@@

// ------------------------------------------------------------
// Master hooks for Part 1 (replace Part 1's main())
// ------------------------------------------------------------

function shmPrepare()
{
   parseFiltersXSPD();
   parseWhiteRefXSPD();
   buildDropdownLists();
   if (WorkflowParameters.selectedCameraIdx === -1) {
      var idealIdx = 0;
      for (var i = 0; i < cameraList.length; i++)
         if (cameraList[i].label.indexOf("Ideal") >= 0) { idealIdx = i; break; }
      WorkflowParameters.selectedCameraIdx = idealIdx;
   }
   WorkflowParameters.loadUserPrefs();
   if (Parameters.isViewTarget || Parameters.isGlobalTarget) {
      try {
         WorkflowParameters.load();
      } catch (e) {
         console.warningln("⚠  Some process icon values (Part 1) could not be read (" +
                           shErrorText(e) + ") - saved settings used for them.");
      }
   }
   WorkflowParameters.validate();
   WorkflowParameters.resolveFilterSelection();
}

// Dialog + Part 1's own "gradient correction already applied" warning,
// both before anything runs (Part 2's dialog comes next).
function shmDialog()
{
   selectEquipment();   // throws "Script cancelled by user." on Cancel

   if (WorkflowParameters.enableMGC || WorkflowParameters.enableGC) {
      let rw = ImageWindow.activeWindow;
      if (!rw.isNull && shHasMark(rw.mainView, "SpaceHunter:GradientDone")) {
         let msg = new MessageBox(
            "<p><b>A gradient correction (MGC / GC) from this script is already applied to this image.</b></p>" +
            "<p>Running it again corrects the gradient twice and may damage your image.</p>" +
            "<p>To try another model, go back one step in History Explorer first.</p>" +
            "<p>Continue anyway?</p>",
            "Warning: Gradient Correction Already Applied",
            StdIcon.Warning, StdButton.No, StdButton.Yes);   // No first = default
         if (msg.execute() !== StdButton.Yes)
            throw new Error("Script cancelled by user.");
      }
   }
   // Part 1's settings in the instance parameters too, so New Instance in
   // Part 2's dialog makes an icon that holds both parts.
   WorkflowParameters.save();
}

// Part 1's main() from Step 1 on, unchanged except: returns
// { solvePending } and errors go to the master.
function shmRun()
{
      console.writeln("\n" + "=".repeat(80));
      console.writeln("SPACE HUNTER WORKFLOW SCRIPT PART 1 " + P1_SCRIPT_VERSION);
      console.writeln("Image Solve → SPFC → Previews → MGC → GC → cDBE");
      console.writeln("=".repeat(80) + "\n");

      let plateSolveComplete = smartPlateSolve();
      if (!plateSolveComplete)
         return { solvePending: true };

      console.writeln("\n" + "=".repeat(80));
      console.writeln("WORKFLOW: SPFC + Previews + Gradient correction");
      console.writeln("=".repeat(80) + "\n");

      var spfcFailed = false;
      var mgcFailed = false;
      if (WorkflowParameters.enableSPFC) {
         var sepRan = false;
         if (WorkflowParameters.enableNarrowband && WorkflowParameters.enableSeparation)
            sepRan = runSeparation();
         try {
            runSPFC(sepRan);
         } catch (spfcError) {
            if (shIsCancel(spfcError)) throw spfcError;
            console.warningln("\n⚠  SPFC failed: " + shErrorText(spfcError));
            spfcFailed = true;
            if (WorkflowParameters.enableMGC) {
               console.writeln("Skipping MGC - falling back to GC...\n");
               mgcFailed = true;
            }
         }
      } else {
         console.writeln("SPFC is DISABLED - skipping\n");
      }
      var gcInstead = WorkflowParameters.enableGC || (spfcFailed && WorkflowParameters.enableMGC);
      if (WorkflowParameters.enablePreviews && gcInstead) {
         console.writeln("Previews: skipped - GradientCorrection creates its own GC_ / GC_1\n");
      } else if (WorkflowParameters.enablePreviews) {
         let previewPrefix = (WorkflowParameters.enableSPFC && !spfcFailed) ? "BM_" : "Preview";
         createPreviews(previewPrefix);
      } else {
         console.writeln("Create Previews is DISABLED - skipping\n");
      }
      if (WorkflowParameters.enableMGC && !spfcFailed) {
         if (!WorkflowParameters.enablePreviews) {
            console.warningln("⚠  MGC requires Previews - checking for existing previews...");
            let win = ImageWindow.activeWindow;
            if (win.previews.length < WorkflowParameters.numPreviews) {
               console.warningln("⚠  Not enough previews found. Skipping MGC.\n");
            } else {
               try {
                  // [internal:simMgc1]
                  runMGCOnPreviews();
               } catch (mgcError) {
                  if (shIsCancel(mgcError)) throw mgcError;
                  console.warningln("\n⚠  MGC failed: " + shErrorText(mgcError));
                  console.writeln("Falling back to GradientCorrection...\n");
                  mgcFailed = true;
               }
            }
         } else {
            try {
               // [internal:simMgc2]
               runMGCOnPreviews();
            } catch (mgcError) {
               if (shIsCancel(mgcError)) throw mgcError;
               console.warningln("\n⚠  MGC failed: " + shErrorText(mgcError));
               console.writeln("Falling back to GradientCorrection...\n");
               mgcFailed = true;
            }
         }
      } else if (!spfcFailed) {
         console.writeln("MGC is DISABLED - skipping\n");
      }

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
            console.warningln("\n⚠  GradientCorrection failed: " + shErrorText(gcError) + "\n");
         }
         for (var g = 0; g < gcModelIds.length; g++) {
            var modelWin = ImageWindow.windowById(gcModelIds[g]);
            if (!modelWin.isNull) {
               console.writeln("Applying Auto Display Stretch to " + gcModelIds[g] + "...");
               applyDisplayStretch(modelWin);
               console.writeln("✔ " + gcModelIds[g] + " stretched.");
            }
         }
         win.bringToFront();
      }

      if (WorkflowParameters.enableDBE) {
         console.writeln("\n" + "=".repeat(80));
         console.writeln("STEP 6: DynamicBackgroundExtraction");
         console.writeln("=".repeat(80) + "\n");
      }

      console.writeln("\n" + "=".repeat(80));
      console.writeln("✅ PART 1 FINISHED ✅");
      console.writeln("=".repeat(80) + "\n");

      if (WorkflowParameters.enableMGC && !mgcFailed) {
         // [internal:p1ModelPanelStart]
         chooseBackgroundModel( ImageWindow.activeWindow );
         // [internal:p1ModelPanelEnd]
      }

      if (WorkflowParameters.enableGC || mgcFailed) {
         if (gcRan) {
            // [internal:p1GCPanelStart]
            chooseGCResult(gcWin, gcModelIds);
            // [internal:p1GCPanelEnd]
         } else
            openGCTool();
      }

      if (WorkflowParameters.enableDBE)
         openDBETool();

      return { solvePending: false };
}

// Part 1's SPFC equipment, handed to Part 2's dialog.
function shmEquipment()
{
   var W = WorkflowParameters;
   var cam = cameraList[W.selectedCameraIdx], flt = filterList[W.selectedFilterIdx],
       wr = whiteRefList[W.selectedWhiteRefIdx];
   return {
      enableSPFC: W.enableSPFC,
      camera:     cam ? cam.xspdName : "",
      filterLabel: flt ? flt.label : "",
      whiteRef:   wr ? wr.name : "",
      narrowband: W.enableNarrowband,
      nb: [ W.nbRedWavelength, W.nbRedBandwidth, W.nbGreenWavelength,
            W.nbGreenBandwidth, W.nbBlueWavelength, W.nbBlueBandwidth ]
   };
}

function shmSteps()
{
   var W = WorkflowParameters;
   return { mgc: W.enableMGC, gc: W.enableGC, dbe: W.enableDBE };
}

return {
   version:     P1_SCRIPT_VERSION,
   prepare:     shmPrepare,
   dialog:      shmDialog,
   run:         shmRun,
   equipment:   shmEquipment,
   steps:       shmSteps,
   banner:      shBanner,
   hasMark:     shHasMark,
   hasProperty: shHasProperty,
   stepState:   shStepState,
   spfcApplied: shSpfcApplied,
   errorText:   shErrorText,
   isCancel:    shIsCancel,
   html:        shHtml
};
})(Parameters);

// ############################################################
// MASTER
// ############################################################

// Steps on the main view that remove the gradient. Our own Apply (MGC model
// panel, GC result panel) is a PixelMath step, found by Part 1's mark.
var SHM_GRADIENT_TOOLS = [
   { id: "DynamicBackgroundExtraction",  name: "DBE" },
   { id: "MultiscaleGradientCorrection", name: "MGC (tool)" },
   { id: "GradientCorrection",           name: "GC (tool)" },
   { id: "AutomaticBackgroundExtractor", name: "ABE" }
];

// GraXpert (and similar scripts) leave only a PixelMath step whose single
// expression is the id of the image they load back (e.g. "image") - see
// GraXpertLib.jsh assign(). GraXpert Denoise writes the same step, so this
// is only shown as a hint and never counts as "gradient done".
function shmPixelMathCopies(view)
{
   var found = [];
   try {
      var pc = view.processing, active = view.historyIndex;
      for (var i = 0; i < pc.length && i < active; i++) {
         var p = pc[i], ex = "";
         try {
            if (p.processId() != "PixelMath" || !p.useSingleExpression || p.createNewImage)
               continue;
            ex = String(p.expression).trim();
         } catch (e) { continue; }
         if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(ex))
            found.push(ex);
      }
   } catch (e) {}
   return found;
}

// What is already done to the image. Same rules as the parts: marks count
// only while their step is active in History Explorer; a reopened file has
// no history list, so a tool step (DBE, ABE, ...) from an earlier session
// cannot be seen - only our own marks are saved with the file.
function shmDetect(win)
{
   var view = win.mainView, P1 = SHM_Part1;
   var s = { solved: false, separation: false, spfc: false,
             gradientMark: false, gradientTools: [], part2: [] };
   try { s.solved = win.hasAstrometricSolution; } catch (e) {}
   s.separation   = P1.hasMark(view, "SpaceHunter:SeparationDone");
   s.spfc         = P1.spfcApplied(view);
   s.gradientMark = P1.hasMark(view, "SpaceHunter:GradientDone");
   for (var i = 0; i < SHM_GRADIENT_TOOLS.length; i++)
      if (P1.stepState(view, SHM_GRADIENT_TOOLS[i].id) == "active")
         s.gradientTools.push(SHM_GRADIENT_TOOLS[i].name);
   s.pixelCopies = shmPixelMathCopies(view);
   var marks = SHM_Part2.marks();
   for (var j = 0; j < marks.length; j++)
      if (P1.hasMark(view, marks[j].mark))
         s.part2.push(marks[j].name);
   s.gradient   = s.gradientMark || s.gradientTools.length > 0;
   s.part1Done  = s.gradient || s.part2.length > 0;
   return s;
}

function shmStateLines(s)
{
   function line(ok, text) { return (ok ? "✔ " : "– ") + text; }
   var g = [];
   if (s.gradientMark) g.push("Part 1 model / GC result applied");
   if (s.gradientTools.length) g.push(s.gradientTools.join(", ") + " in history");
   return [
      line(s.solved, "Plate solved"),
      line(s.separation, "Ha/OIII separation"),
      line(s.spfc, "SPFC"),
      line(s.gradient, "Gradient correction" + (g.length ? " (" + g.join("; ") + ")" : "")),
      line(s.part2.length > 0, "Part 2 steps" + (s.part2.length ? ": " + s.part2.join(", ") : ""))
   ].concat(s.pixelCopies.length ?
      [ '? PixelMath copy from another image in history ("' + s.pixelCopies.join('", "') +
        '") - e.g. GraXpert. Not counted: if it was a background extraction, choose Part 2 only.' ] : []);
}

// Gradient mark as a comparable stamp (position + step), null when not
// active: Part 2 only continues when THIS run set a new mark.
function shmGradientStamp(view)
{
   if (!SHM_Part1.hasMark(view, "SpaceHunter:GradientDone"))
      return null;
   var t = "";
   try { t += String(view.propertyValue("SpaceHunter:GradientDone")); } catch (e) {}
   try { t += "|" + String(view.propertyValue("SpaceHunter:GradientDoneSession")); } catch (e) {}
   return t;
}

// ------------------------------------------------------------
// Step M0: start dialog
// ------------------------------------------------------------
// V8: Dialog is a class - "class extends Dialog" as in Part 1 / Part 2
// (the old this.__base__ = Dialog pattern throws "cannot be invoked without 'new'").
var ShmStartDialog = class extends Dialog {
constructor(win, state)
{
   super();
   var dlg = this;
   this.windowTitle = SHM_NAME + " " + SHM_VERSION;
   this.mode = state.part1Done ? "p2" : "both";

   this.title_Label = new Label(this);
   this.title_Label.useRichText = true;
   this.title_Label.text = "<b>" + SHM_NAME + " " + SHM_VERSION + "</b> (@@BUILD_LABEL_LC@@) &mdash; " +
                           "Part 1 " + SHM_Part1.version + ", Part 2 " + SHM_Part2.version;

   this.image_Label = new Label(this);
   this.image_Label.useRichText = true;
   this.image_Label.text = "Image: <b>" + SHM_Part1.html(win.mainView.id) + "</b>";

   this.state_Label = new Label(this);
   this.state_Label.useRichText = true;
   this.state_Label.wordWrapping = true;
   this.state_Label.text = shmStateLines(state).map(function(l) { return SHM_Part1.html(l); }).join("<br/>");

   this.state_Group = new GroupBox(this);
   this.state_Group.title = "Already done (re-run marks, History Explorer)";
   this.state_Group.sizer = new VerticalSizer;
   this.state_Group.sizer.margin = 8;
   this.state_Group.sizer.add(this.state_Label);

   // Radio buttons are exclusive among siblings: all three in the group box.
   this.mode_Group = new GroupBox(this);
   this.mode_Group.title = "Run";
   this.both_Radio = new RadioButton(this.mode_Group);
   this.both_Radio.text = "Part 1 + Part 2 (Part 2 starts after Apply in the model / GC panel)";
   this.p1_Radio = new RadioButton(this.mode_Group);
   this.p1_Radio.text = "Part 1 only";
   this.p2_Radio = new RadioButton(this.mode_Group);
   this.p2_Radio.text = "Part 2 only (continue after the gradient correction)";
   this.both_Radio.checked = this.mode == "both";
   this.p2_Radio.checked   = this.mode == "p2";
   this.both_Radio.onCheck = function(c) { if (c) dlg.mode = "both"; };
   this.p1_Radio.onCheck   = function(c) { if (c) dlg.mode = "p1"; };
   this.p2_Radio.onCheck   = function(c) { if (c) dlg.mode = "p2"; };

   this.mode_Group.sizer = new VerticalSizer;
   this.mode_Group.sizer.margin = 8;
   this.mode_Group.sizer.spacing = 4;
   this.mode_Group.sizer.add(this.both_Radio);
   this.mode_Group.sizer.add(this.p1_Radio);
   this.mode_Group.sizer.add(this.p2_Radio);

   // [internal:dialogCheckbox]

   // [internal:simDialog]

   this.note_Label = new Label(this);
   this.note_Label.useRichText = true;
   this.note_Label.wordWrapping = true;
   this.note_Label.text =
      "<p>Preselected: " + (state.part1Done ? "<b>Part 2 only</b> (gradient correction found)"
                                            : "<b>Part 1 + Part 2</b>") + ".</p>" +
      "<p>The run stops before Part 2 when ImageSolver needs you, when DBE is opened, or when " +
      "the model / GC panel is closed without Apply. Finish that step, then run the Master " +
      "again: it continues with Part 2. With DBE ticked in Part 1, Part 2's dialog is not " +
      "shown at all in that run.</p>" +
      "<p>A DBE / ABE / GC step from an earlier session (reopened file) leaves no trace, " +
      "and GraXpert leaves only a PixelMath step &mdash; choose <i>Part 2 only</i> yourself then.</p>" +
      "<p>The background pre-check (IFN / dust map) needs a plate solution: on an unsolved " +
      "image it comes after Part 1, right before Part 2 starts.</p>";

   this.ok_Button = new PushButton(this);
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource(":/icons/ok.png");
   this.ok_Button.onClick = function() { dlg.ok(); };
   this.cancel_Button = new PushButton(this);
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource(":/icons/cancel.png");
   this.cancel_Button.onClick = function() { dlg.cancel(); };

   // Documentation button (v0.3.0): PI looks the manual up by the MENU name,
   // doc/scripts/SH Lazy Workflow Master/SH Lazy Workflow Master.html.
   this.doc_Button = new ToolButton(this);
   this.doc_Button.icon = this.scaledResource(":/process-interface/browse-documentation.png");
   this.doc_Button.setScaledFixedSize(24, 24);
   this.doc_Button.toolTip = "<p>Open the Lazy Workflow Master manual.</p>";
   this.doc_Button.onClick = function() {
      if (!Dialog.browseScriptDocumentation(SHM_DOC_NAME))
         (new MessageBox(
            "<p>The Lazy Workflow Master manual is not installed.</p>" +
            "<p>It comes with the Space Hunter update package (doc/scripts/" + SHM_DOC_NAME + ").</p>",
            SHM_NAME, StdIcon.Information, StdButton.Ok)).execute();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.add(this.doc_Button);
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add(this.ok_Button);
   this.buttons_Sizer.add(this.cancel_Button);

   this.sizer = new VerticalSizer;
   this.sizer.margin = 10;
   this.sizer.spacing = 8;
   this.sizer.add(this.title_Label);
   this.sizer.add(this.image_Label);
   this.sizer.add(this.state_Group);
   this.sizer.add(this.mode_Group);
   // [internal:dialogSizer]
   // [internal:simSizer]
   this.sizer.add(this.note_Label);
   this.sizer.add(this.buttons_Sizer);
   this.setScaledMinWidth(480);
   this.adjustToContents();
}
};

function shmElapsed(start)
{
   var sec = Math.floor((new Date() - start) / 1000);
   console.writeln("Total execution time: " + Math.floor(sec / 60) + "m " + (sec % 60) + "s\n");
}

// v0.3.4: how the run ended, for the closing lines (Georg: "STOPPED" followed
// by "MASTER FINISHED" read as a contradiction; a cancel said only
// "Script cancelled by user.", not where or how to go on).
var shmStopped = false;    // shmStop() ran: the run ended before Part 2
var shmPhase = "setup";    // "setup" (dialogs) / "Part 1" / "Part 2"

function shmStop(lines)
{
   shmStopped = true;
   console.writeln("\n" + "=".repeat(80));
   console.warningln("MASTER STOPPED BEFORE PART 2");
   for (var i = 0; i < lines.length; i++)
      console.writeln(lines[i]);
   console.writeln("=".repeat(80) + "\n");
   // [internal:stopAlarm]
}

function shmMain()
{
   console.show();
   console.abortEnabled = true;
   var start = new Date();
   var P1 = SHM_Part1, P2 = SHM_Part2;

   P1.banner();
   console.writeln("\n" + "=".repeat(80));
   console.writeln(SHM_NAME.toUpperCase() + " " + SHM_VERSION + " (@@BUILD_LABEL@@)");
   console.writeln("Part 1 " + P1.version + " → model / GC Apply → Part 2 " + P2.version);
   console.writeln("=".repeat(80) + "\n");

   try {
      var win = ImageWindow.activeWindow;
      if (win.isNull) {
         // v0.3.2: a plain note, not an error with alarm. Unlike Part 1 / 2,
         // the start dialog is built from the image (what is already done).
         console.writeln("No image open - the Master starts from the active image.\n");
         (new MessageBox(
            "<p>Open the image you want to process (or click it to make it the active one), " +
            "then start the Master again.</p>" +
            "<p>The Master reads what is already done to that image before anything runs.</p>",
            SHM_NAME, StdIcon.Information, StdButton.Ok)).execute();
         return;
      }
      var view = win.mainView;

      // Step M0
      var state = shmDetect(win);
      console.writeln("STEP M0: State of " + view.id);
      var lines = shmStateLines(state);
      for (var i = 0; i < lines.length; i++)
         console.writeln("  " + lines[i]);
      // [internal:loadSetting]
      var sd = new ShmStartDialog(win, state);
      if (!sd.execute())
         throw new Error("Script cancelled by user.");
      // [internal:saveSetting]
      // [internal:simConsole]
      // [internal:consoleLine]
      var runP1 = sd.mode != "p2", runP2 = sd.mode != "p1";
      console.writeln("  Run: " + (sd.mode == "both" ? "Part 1 + Part 2" : sd.mode == "p1" ? "Part 1 only" : "Part 2 only") + "\n");

      // Step M1: dialogs
      var eq = null, p2SkippedForDBE = false;
      if (runP1) {
         P1.prepare();
         P1.dialog();
         var steps = P1.steps();
         if (state.gradientTools.length > 0 && (steps.mgc || steps.gc || steps.dbe)) {
            var gm = new MessageBox(
               "<p><b>" + P1.html(state.gradientTools.join(", ")) +
               " is already applied to this image (active in History Explorer).</b></p>" +
               "<p>A second gradient correction may damage your image. For Part 2 only, " +
               "Cancel and choose <i>Part 2 only</i>.</p><p>Run Part 1's gradient correction anyway?</p>",
               "Warning: Gradient Correction Already Applied",
               StdIcon.Warning, StdButton.No, StdButton.Yes);   // No first = default
            if (gm.execute() !== StdButton.Yes)
               throw new Error("Script cancelled by user.");
         }
         eq = P1.equipment();
         if (!eq.enableSPFC)
            eq = null;   // Part 1 doesn't run SPFC: Part 2 keeps its own equipment
         // DBE is applied by hand, so the run always stops after Part 1:
         // Part 2's dialog (and IFN pre-check) would be set up for nothing.
         if (runP2 && steps.dbe) {
            console.writeln("DBE selected in Part 1: Part 2 is not set up in this run.");
            console.writeln("Apply DBE, then run the Master again - it continues with Part 2.\n");
            runP2 = false;
            p2SkippedForDBE = true;
         }
      }
      var mismatchSeen = "";
      if (runP2) {
         P2.prepare(runP1 ? eq : null);
         P2.dialog();
         mismatchSeen = P2.mismatch();   // what Part 2's OK button already showed
         P2.precheck();                  // IFN / dust map dialog now; the finder runs at Step 2
      }

      // Step M2: Part 1
      if (runP1) {
         var before = shmGradientStamp(view);
         shmPhase = "Part 1";
         var r = P1.run();
         if (runP2 || p2SkippedForDBE) {
            var steps1 = P1.steps();
            var after = shmGradientStamp(view);
            var applied = after !== null && after !== before;
            if (r.solvePending) {
               shmStop([ "ImageSolver needs you: solve the image, then run the Master again." ]);
               runP2 = false;
            } else if (steps1.dbe) {
               shmStop([ "DBE is open: place samples and apply it to " + view.id + ".",
                         "Then run the Master again - DBE in the history = Part 1 done, it continues with Part 2." ]);
               runP2 = false;
            } else if (applied) {
               console.writeln("✔ Gradient correction applied - continuing with Part 2.\n");
            } else if (steps1.mgc || steps1.gc) {
               shmStop([ "No background model / GC result was applied (panel closed, tool opened, or failed).",
                         "Apply the gradient correction, then run the Master again - it continues with Part 2." ]);
               runP2 = false;
            } else {
               console.warningln("⚠  Part 1 had no gradient correction selected (MGC / GC / DBE) - continuing with Part 2.\n");
            }
         }
      }

      // Step M3: Part 2
      if (runP2) {
         shmPhase = "Part 2";   // also covers No in the filter-mismatch box: Part 1 is done
         if (runP1) {
            win.bringToFront();
            CoreApplication.processEvents();
            var aw = ImageWindow.activeWindow;
            if (aw.isNull || aw.mainView.id != view.id)
               throw new Error("Could not bring " + view.id + " back to front - run the Master again with that image active (Part 2 only).");
            // Part 2's OK button could only check SPFC/SPCC filters against
            // what was on the image then; SPFC may have run since.
            var m = P2.mismatch();
            if (m.length > 0 && m != mismatchSeen) {
               var mb = new MessageBox(
                  "<p><b>SPCC and Part 1's SPFC do not use the same filters.</b></p><p>" + m + "</p>" +
                  "<p>SPCC's color calibration should use the filters the image was taken with.</p>" +
                  "<p>Run Part 2 anyway?</p>",
                  "Warning: SPFC / SPCC filter mismatch",
                  StdIcon.Warning, StdButton.No, StdButton.Yes);   // No first = default
               if (mb.execute() !== StdButton.Yes)
                  throw new Error("Script cancelled by user.");
               console.warningln("⚠  Run despite filter mismatch: " + m.replace(/<[^>]*>/g, ""));
            }
         }
         P2.run();
      }

      console.writeln("\n" + "=".repeat(80));
      if (shmStopped)
         console.warningln("MASTER ENDED - stopped before Part 2 (see above)");
      else
         console.writeln("✅ MASTER FINISHED ✅");
      console.writeln("=".repeat(80));
      shmElapsed(start);
      // [internal:finished]
   } catch (error) {
      if (P1.isCancel(error)) {
         console.writeln("\n" + "=".repeat(80));
         if (shmPhase == "setup") {
            console.warningln("MASTER CANCELLED - nothing was processed.");
         } else {
            console.warningln("MASTER CANCELLED during " + shmPhase);
            console.writeln("The steps finished before the cancel stay on the image (History Explorer).");
            console.writeln(shmPhase == "Part 1"
               ? "Run the Master again: its start dialog shows what is already done."
               : "Run the Master again: it preselects Part 2 only, and Part 2 skips the steps already applied.");
         }
         console.writeln("=".repeat(80));
         shmElapsed(start);
      } else {
         console.criticalln("\nERROR: " + P1.errorText(error));
         // [internal:error]
         throw error;
      }
   }
}

shmMain();
