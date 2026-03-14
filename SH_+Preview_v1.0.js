#feature-id    Space_Hunter > SH +Previews
#feature-icon  SH_PlusPreviews.svg
#feature-info  Space Hunter +Previews v1.0<br/>\
   <br/>\
   Creates 1-6 full-view previews with preset or custom naming<br/>\
   and zooms each to optimal fit.<br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.

//============================================================================
// +Previews.js
//============================================================================
//
//MIT License
//Space Hunter +Previews.js
//
//Copyright (c) 2026 Georg G Albrecht
//
//Permission is hereby granted, free of charge, to any person obtaining a
//copy of this software and associated documentation files (the "Software"),
//to deal in the Software without restriction, including without limitation
//the rights to use, copy, modify, merge, publish, distribute, sublicense,
//and/or sell copies of the Software, and to permit persons to whom the
//Software is furnished to do so, subject to the following conditions:
//
//The above copyright notice and this permission notice shall be included in
//all copies or substantial portions of the Software.
//
//THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
//THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
//FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
//IN THE SOFTWARE.
// ===========================================================================
//
// Acknowledgments:
// - PixInsight platform by Pleiades Astrophoto (https://pixinsight.com/)
// - Developed with assistance from Claude AI (Anthropic)
// ===========================================================================

#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

var MGC_VALUES = [ "128", "192", "256", "384", "512", "768",
                   "1024", "1538", "2048", "3072", "4096", "6144", "8192" ];

var PREFIX_OPTIONS = [ "BM_", "GC", "Preview", "Custom TXT" ];

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function PreviewDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   this.windowTitle = "SPACE HUNTER - FullView Previews";

   var dlg = this;

   var labelWidth = this.font.width( "Number of Previews:" );
   var comboWidth = 168;
   var editWidth  = 255;

   // -----------------------------------------------------------------------
   // Info / help label (matches Space Hunter style)
   // -----------------------------------------------------------------------
   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle   = FrameStyle_Box;
   this.helpLabel.minWidth     = 45 * this.font.width( 'M' );
   this.helpLabel.margin       = 6;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText  = true;
   this.helpLabel.text =
      "<p><b>+Previews v1.0</b> &mdash; Space Hunter Toolset<br/>" +
      "Creates 1&ndash;6 full-image previews zoomed to fit.<br/>" +
      "Copyright &copy; 2026 Georg G Albrecht. MIT License.</p>";

   // -----------------------------------------------------------------------
   // Number of previews row
   // -----------------------------------------------------------------------
   this.countLabel = new Label( this );
   this.countLabel.text          = "Number of Previews:";
   this.countLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.countLabel.setFixedWidth( labelWidth );

   this.countCombo = new ComboBox( this );
   this.countCombo.editEnabled = false;
   for ( var n = 1; n <= 6; ++n )
      this.countCombo.addItem( "" + n );
   this.countCombo.currentItem = 0;   // default = 4
   this.countCombo.setFixedWidth( comboWidth );

   this.countSizer = new HorizontalSizer;
   this.countSizer.spacing = 6;
   this.countSizer.add( this.countLabel );
   this.countSizer.add( this.countCombo );
   this.countSizer.addStretch();

   // -----------------------------------------------------------------------
   // Prefix row:  [label]  [Prefix1 combo]  [Prefix2 custom edit]
   // -----------------------------------------------------------------------
   this.prefixLabel = new Label( this );
   this.prefixLabel.text          = "Preview Prefix:";
   this.prefixLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.prefixLabel.setFixedWidth( labelWidth );

   this.prefixCombo = new ComboBox( this );
   this.prefixCombo.editEnabled = false;
   for ( var i = 0; i < PREFIX_OPTIONS.length; ++i )
      this.prefixCombo.addItem( PREFIX_OPTIONS[i] );
   this.prefixCombo.currentItem = 0;
   this.prefixCombo.setFixedWidth( comboWidth );
   this.prefixCombo.toolTip =
      "<p><b>BM_</b> &rarr; BM_[scale] per row. Suffix 1 (MGC scale) required. Suffix 2 optional e.g. A &rarr; BM_128_A<br/>" +
      "<b>GC</b> &rarr; GC, GC1, GC2 &hellip; (all suffix boxes disabled)<br/>" +
      "<b>Preview</b> &rarr; Preview, Preview1, Preview2 &hellip; (all suffix boxes disabled)<br/>" +
      "<b>Custom TXT</b> &rarr; enter your own prefix. Suffix 2 optional per row.</p>";

   this.prefixCustomEdit = new Edit( this );
   this.prefixCustomEdit.text     = "";
   this.prefixCustomEdit.minWidth = editWidth;
   this.prefixCustomEdit.toolTip  =
      "<p>Custom prefix text. Active only when Prefix = Custom TXT.<br/>" +
      "e.g. NGC1234 &rarr; NGC1234, NGC1234_1, NGC1234_2 &hellip;</p>";

   this.prefixSizer = new HorizontalSizer;
   this.prefixSizer.spacing = 6;
   this.prefixSizer.add( this.prefixLabel );
   this.prefixSizer.add( this.prefixCombo );
   this.prefixSizer.add( this.prefixCustomEdit, 100 );

   // -----------------------------------------------------------------------
   // Column header row for the 6 suffix rows
   // -----------------------------------------------------------------------
   this.colSpacerLabel = new Label( this );
   this.colSpacerLabel.setFixedWidth( labelWidth );

   this.colS1Label = new Label( this );
   this.colS1Label.text          = "Suffix 1";
   this.colS1Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.colS1Label.setFixedWidth( comboWidth );
   this.colS1Label.styleSheet    = "font-weight: bold;";

   this.colS2Label = new Label( this );
   this.colS2Label.text          = "Suffix 2 - Custom";
   this.colS2Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.colS2Label.minWidth = editWidth;
   this.colS2Label.styleSheet    = "font-weight: bold;";

   this.colHeaderSizer = new HorizontalSizer;
   this.colHeaderSizer.spacing = 6;
   this.colHeaderSizer.add( this.colSpacerLabel );
   this.colHeaderSizer.add( this.colS1Label );
   this.colHeaderSizer.add( this.colS2Label, 100 );

   // -----------------------------------------------------------------------
   // 6 suffix rows
   // -----------------------------------------------------------------------
   this.rows = [];

   for ( var r = 0; r < 6; ++r )
   {
      var row = {};

      row.label = new Label( dlg );
      row.label.text          = "Preview " + (r + 1) + ":";
      row.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      row.label.setFixedWidth( labelWidth );

      row.s1Combo = new ComboBox( dlg );
      row.s1Combo.editEnabled = false;
      row.s1Combo.addItem( "---" );
      for ( var v = 0; v < MGC_VALUES.length; ++v )
         row.s1Combo.addItem( MGC_VALUES[v] );
      row.s1Combo.currentItem = 0;
      row.s1Combo.setFixedWidth( comboWidth );
      row.s1Combo.toolTip = "<p>MGC gradient scale for this preview. Active in BM_ mode only.</p>";

      row.s2Edit = new Edit( dlg );
      row.s2Edit.text    = "";
      row.s2Edit.minWidth = editWidth;
      row.s2Edit.toolTip = "<p>Optional custom suffix for this preview.<br/>" +
                           "BM_ mode: adds letter/text after scale if equal scale is used<br/>" +
						   "multiple times with differnt subvalues e.g. A &rarr; BM_128_A<br/>" +
                           "Custom TXT mode: per-row suffix, leave empty to auto-number.</p>";

      row.sizer = new HorizontalSizer;
      row.sizer.spacing = 6;
      row.sizer.add( row.label );
      row.sizer.add( row.s1Combo );
      row.sizer.add( row.s2Edit, 100 );

      dlg.rows.push( row );
   }

   // -----------------------------------------------------------------------
   // Buttons
   // -----------------------------------------------------------------------
   // -----------------------------------------------------------------------
   // Overwrite checkbox
   // -----------------------------------------------------------------------
   this.overwriteCheckBox = new CheckBox( this );
   this.overwriteCheckBox.text    = "Preview Overwrite  (delete all existing previews and recreate)";
   this.overwriteCheckBox.checked = false;
   this.overwriteCheckBox.toolTip =
      "<p><b>Disabled (default):</b> Existing previews with the same name are kept. Only new names are created.<br/>" +
      "<b>Enabled:</b> All existing previews are deleted and replaced with the new selection.</p>";

   this.overwriteSizer = new HorizontalSizer;
   this.overwriteSizer.spacing = 8;
   this.overwriteSizer.add( this.overwriteCheckBox );
   this.overwriteSizer.addStretch();

   this.okButton = new PushButton( this );
   this.okButton.text    = "OK";
   this.okButton.icon    = this.scaledResource( ":/icons/ok.png" );
   this.okButton.onClick = function() { if ( validateDialog( dlg ) ) dlg.ok(); };

   this.cancelButton = new PushButton( this );
   this.cancelButton.text    = "Cancel";
   this.cancelButton.icon    = this.scaledResource( ":/icons/cancel.png" );
   this.cancelButton.onClick = function() { dlg.cancel(); };

   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 8;
   this.buttonSizer.addStretch();
   this.buttonSizer.add( this.okButton );
   this.buttonSizer.add( this.cancelButton );

   // -----------------------------------------------------------------------
   // Main vertical layout
   // -----------------------------------------------------------------------
   this.sizer = new VerticalSizer;
   this.sizer.margin  = 8;
   this.sizer.spacing = 6;
   this.sizer.add( this.helpLabel );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.countSizer );
   this.sizer.add( this.prefixSizer );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.colHeaderSizer );

   for ( var r = 0; r < 6; ++r )
      this.sizer.add( this.rows[r].sizer );

   this.sizer.addSpacing( 8 );
   this.sizer.add( this.overwriteSizer );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.buttonSizer );

   // -----------------------------------------------------------------------
   // State update — drives all enable/disable logic
   // -----------------------------------------------------------------------
   function updateState()
   {
      var count        = dlg.countCombo.currentItem + 1;
      var prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];
      var hasCustomPfx = ( dlg.prefixCustomEdit.text.trim().length > 0 );

      // Prefix custom edit: only active when Prefix1 = Empty
      dlg.prefixCustomEdit.enabled = ( prefixChoice === "Custom TXT" );

      for ( var r = 0; r < 6; ++r )
      {
         var row       = dlg.rows[r];
         var rowActive = ( r < count );

         if ( !rowActive )
         {
            row.s1Combo.enabled = false;
            row.s2Edit.enabled  = false;
         }
         else if ( prefixChoice === "Preview" || prefixChoice === "GC" )
         {
            row.s1Combo.enabled = false;
            row.s2Edit.enabled  = false;
         }
         else if ( prefixChoice === "BM_" )
         {
            row.s1Combo.enabled = true;
            row.s2Edit.enabled  = true;
         }
         else
         {
            // Empty prefix
            if ( !hasCustomPfx )
            {
               // Both empty -> default Preview numbering, nothing to enter
               row.s1Combo.enabled = false;
               row.s2Edit.enabled  = false;
            }
            else
            {
               // Custom prefix entered -> per-row custom suffix optional
               row.s1Combo.enabled = false;
               row.s2Edit.enabled  = true;
            }
         }
      }
   }

   this.countCombo.onItemSelected       = function() { updateState(); };
   this.prefixCombo.onItemSelected      = function() { updateState(); };
   this.prefixCustomEdit.onEditCompleted = function() { updateState(); };

   updateState();
}

PreviewDialog.prototype = new Dialog;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDialog( dlg )
{
   var count        = dlg.countCombo.currentItem + 1;
   var prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];

   // Collect all user-entered text into one string and check for spaces
   var allText = dlg.prefixCustomEdit.text;
   for ( var r = 0; r < 6; ++r )
      allText += dlg.rows[r].s2Edit.text;

   console.writeln( "validateDialog: allText = [" + allText + "]" );

   if ( allText.indexOf( " " ) >= 0 )
   {
      (new MessageBox(
         "<b>Nah..nah..nah,  You know better!</b><br/><br/>PixInsight does not like empty spaces between words!!!",
         "No Spaces Allowed!", 4, 1
      )).execute();
      return false;
   }

   // Check for missing MGC scale in BG_ mode
   if ( prefixChoice === "BM_" )
   {
      for ( var r = 0; r < count; ++r )
      {
         if ( dlg.rows[r].s1Combo.currentItem === 0 )
         {
            (new MessageBox(
               "Preview " + (r + 1) + " has no MGC scale selected.\n" +
               "Please select a scale value for every active preview row.",
               "Missing MGC Scale", 4, 1
            )).execute();
            return false;
         }
      }
   }
   return true;
}

// ---------------------------------------------------------------------------
// Build preview names
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Find the highest existing number suffix for a given prefix on the active window
// e.g. if GC_0, GC_1 exist, returns 2 (next available)
// ---------------------------------------------------------------------------

function nextAvailableIndex( prefix )
{
   var win = ImageWindow.activeWindow;
   if ( win.isNull ) return 0;

   var highest = -1;
   var existing = win.previews;

   for ( var i = 0; i < existing.length; ++i )
   {
      var id = existing[i].id;
      if ( id.indexOf( prefix ) === 0 )
      {
         var suffix = id.substring( prefix.length );
         var num    = parseInt( suffix, 10 );
         if ( !isNaN( num ) && num > highest )
            highest = num;
      }
   }

   return highest + 1;   // returns 0 if none found, or next number after highest
}

function buildNames( dlg )
{
   var count        = dlg.countCombo.currentItem + 1;
   var prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];
   var customPfx    = dlg.prefixCustomEdit.text.trim();
   var overwrite    = dlg.overwriteCheckBox.checked;
   var names        = [];

   if ( prefixChoice === "Preview" )
   {
      var startIdx = overwrite ? 0 : nextAvailableIndex( "Preview" );
      for ( var r = 0; r < count; ++r )
      {
         var idx = startIdx + r;
         names.push( idx === 0 ? "Preview" : "Preview" + idx );
      }
   }
   else if ( prefixChoice === "GC" )
   {
      var startIdx = overwrite ? 0 : nextAvailableIndex( "GC" );
      for ( var r = 0; r < count; ++r )
      {
         var idx = startIdx + r;
         names.push( idx === 0 ? "GC" : "GC" + idx );
      }
   }
   else if ( prefixChoice === "BM_" )
   {
      for ( var r = 0; r < count; ++r )
      {
         var scale = MGC_VALUES[ dlg.rows[r].s1Combo.currentItem - 1 ];
         var s2    = dlg.rows[r].s2Edit.text.trim();
         names.push( s2.length > 0 ? "BM_" + scale + "_" + s2 : "BM_" + scale );
      }
   }
   else
   {
      // Custom TXT prefix
      if ( customPfx.length === 0 )
      {
         var startIdx = overwrite ? 0 : nextAvailableIndex( "Preview" );
         for ( var r = 0; r < count; ++r )
            names.push( "Preview" + ( startIdx + r ) );
      }
      else
      {
         var startIdx = overwrite ? 0 : nextAvailableIndex( customPfx );
         for ( var r = 0; r < count; ++r )
         {
            var s2 = dlg.rows[r].s2Edit.text.trim();
            names.push( s2.length > 0 ? customPfx + s2 : customPfx + ( startIdx + r ) );
         }
      }
   }

   return names;
}

// ---------------------------------------------------------------------------
// Create previews in PixInsight
// ---------------------------------------------------------------------------

function createPreviews( names, overwrite )
{
   var win = ImageWindow.activeWindow;
   if ( win.isNull )
   {
      console.criticalln( "No active image window." );
      return;
   }

   var img  = win.mainView.image;
   var rect = new Rect( 0, 0, img.width, img.height );

   if ( overwrite )
   {
      // Delete all existing previews
      var existing = win.previews;
      for ( var i = 0; i < existing.length; ++i )
         win.deletePreview( existing[i] );
      console.writeln( "Overwrite enabled: deleted all existing previews." );
   }
   else
   {
      // Build a set of existing preview IDs
      var existingIds = {};
      var existing = win.previews;
      for ( var i = 0; i < existing.length; ++i )
         existingIds[ existing[i].id ] = true;

      // Filter out names that already exist
      var filtered = [];
      for ( var i = 0; i < names.length; ++i )
      {
         if ( existingIds[ names[i] ] )
            console.writeln( "Preview '" + names[i] + "' already exists — skipping." );
         else
            filtered.push( names[i] );
      }
      names = filtered;

      if ( names.length === 0 )
      {
         console.writeln( "All requested previews already exist. Nothing to do." );
         return;
      }
   }

   var previews = [];

   for ( var i = 0; i < names.length; ++i )
   {
      var pv = win.createPreview( rect, names[i] );
      previews.push( pv );
      console.writeln( "Created preview: " + names[i] );
   }

   for ( var i = 0; i < previews.length; ++i )
   {
      win.currentView = previews[i];
      win.bringToFront();
      processEvents();
      processEvents();
      win.zoomToOptimalFit();
      processEvents();
      processEvents();
      console.writeln( "Zoomed: " + previews[i].id );
   }

   win.currentView = previews[0];
   win.bringToFront();
   win.zoomToOptimalFit();
   console.writeln( "Done. Active: " + previews[0].id );
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main()
{
   var dlg = new PreviewDialog();
   if ( dlg.execute() )
   {
      var names     = buildNames( dlg );
      var overwrite = dlg.overwriteCheckBox.checked;
      createPreviews( names, overwrite );
   }
}

main();
