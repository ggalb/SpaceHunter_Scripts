#engine v8

#feature-id    SHPlusPreviews : Space_Hunter > SH +Previews
#feature-icon  SH_PlusPreviews.svg
#feature-info  Space Hunter +Previews v2.2.1<br/>\
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

CoreApplication.ensureMinimumVersion( 1, 9, 4 );

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MGC_VALUES = [ "128", "192", "256", "384", "512", "768",
                     "1024", "1536", "2048", "3072", "4096", "6144", "8192" ];

const PREFIX_OPTIONS = [ "BM_", "GC_", "Preview", "Custom TXT" ];

// Dialog.browseScriptDocumentation() takes the MENU name (last part of the
// #feature-id menu path), not the ID, and opens doc/scripts/<name>/<name>.html.
// Tested in PI 2026-10-12. Keep in sync with #feature-id and the manual folder.
const DOC_NAME = "SH +Previews";

// ---------------------------------------------------------------------------
// Settings stored in a process icon (New Instance) and restored from it
// ---------------------------------------------------------------------------

function exportParameters( dlg )
{
   Parameters.clear();
   Parameters.set( "count",        dlg.countCombo.currentItem + 1 );
   Parameters.set( "prefix",       PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ] );
   Parameters.set( "customPrefix", dlg.prefixCustomEdit.text );
   Parameters.set( "overwrite",    dlg.overwriteCheckBox.checked );
   for ( let r = 0; r < 6; ++r )
   {
      let s1 = dlg.rows[r].s1Combo.currentItem;
      Parameters.set( "scale" + r,  s1 > 0 ? MGC_VALUES[ s1 - 1 ] : "" );
      Parameters.set( "suffix" + r, dlg.rows[r].s2Edit.text );
   }
}

// Fills the dialog from a process icon's settings. Unknown values are ignored.
function importParameters( dlg )
{
   if ( Parameters.has( "count" ) )
   {
      let n = Parameters.getInteger( "count" );
      if ( n >= 1 && n <= 6 )
         dlg.countCombo.currentItem = n - 1;
   }
   if ( Parameters.has( "prefix" ) )
   {
      let i = PREFIX_OPTIONS.indexOf( Parameters.getString( "prefix" ) );
      if ( i >= 0 )
         dlg.prefixCombo.currentItem = i;
   }
   if ( Parameters.has( "customPrefix" ) )
      dlg.prefixCustomEdit.text = Parameters.getString( "customPrefix" );
   if ( Parameters.has( "overwrite" ) )
      dlg.overwriteCheckBox.checked = Parameters.getBoolean( "overwrite" );
   for ( let r = 0; r < 6; ++r )
   {
      if ( Parameters.has( "scale" + r ) )
      {
         let i = MGC_VALUES.indexOf( Parameters.getString( "scale" + r ) );
         dlg.rows[r].s1Combo.currentItem = ( i >= 0 ) ? i + 1 : 0;
      }
      if ( Parameters.has( "suffix" + r ) )
         dlg.rows[r].s2Edit.text = Parameters.getString( "suffix" + r );
   }
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

var PreviewDialog = class extends Dialog
{
   constructor()
   {
      super();

      this.windowTitle = "SPACE HUNTER - FullView Previews";

      let dlg = this;

      let labelWidth = this.font.width( "Number of Previews:" );
      let comboWidth = 168;
      let editWidth  = 255;

      // -----------------------------------------------------------------------
      // Info / help label (matches Space Hunter style)
      // -----------------------------------------------------------------------
      this.helpLabel = new Label( this );
      this.helpLabel.frameStyle   = FrameStyle.Box;
      this.helpLabel.minWidth     = 45 * this.font.width( 'M' );
      this.helpLabel.margin       = 6;
      this.helpLabel.wordWrapping = true;
      this.helpLabel.useRichText  = true;
      this.helpLabel.text =
         "<p><b>+Previews v2.2.1</b> &mdash; Space Hunter Toolset<br/>" +
         "Creates 1&ndash;6 full-image previews zoomed to fit.<br/>" +
         "Copyright &copy; 2026 Georg G Albrecht. MIT License.</p>";

      // -----------------------------------------------------------------------
      // Number of previews row
      // -----------------------------------------------------------------------
      this.countLabel = new Label( this );
      this.countLabel.text          = "Number of Previews:";
      this.countLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.countLabel.setFixedWidth( labelWidth );

      this.countCombo = new ComboBox( this );
      this.countCombo.editEnabled = false;
      for ( let n = 1; n <= 6; ++n )
         this.countCombo.addItem( "" + n );
      this.countCombo.currentItem = 0;   // default = 1
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
      this.prefixLabel.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
      this.prefixLabel.setFixedWidth( labelWidth );

      this.prefixCombo = new ComboBox( this );
      this.prefixCombo.editEnabled = false;
      for ( let i = 0; i < PREFIX_OPTIONS.length; ++i )
         this.prefixCombo.addItem( PREFIX_OPTIONS[i] );
      this.prefixCombo.currentItem = 0;
      this.prefixCombo.setFixedWidth( comboWidth );
      this.prefixCombo.toolTip =
         "<p><b>BM_</b> &rarr; BM_[scale] per row. Suffix 1 (MGC scale) required. Suffix 2 optional e.g. A &rarr; BM_128_A<br/>" +
         "<b>GC_</b> &rarr; GC_, GC_1, GC_2 &hellip; continuing after existing GC_ previews; matches GC model names GC_gradient_model, GC_gradient_model1 &hellip; (all suffix boxes disabled)<br/>" +
         "<b>Preview</b> &rarr; Preview, Preview1, Preview2 &hellip; (all suffix boxes disabled)<br/>" +
         "<b>Custom TXT</b> &rarr; enter your own prefix. Suffix 2 optional per row.</p>";

      this.prefixCustomEdit = new Edit( this );
      this.prefixCustomEdit.text     = "";
      this.prefixCustomEdit.minWidth = editWidth;
      this.prefixCustomEdit.toolTip  =
         "<p>Custom prefix text. Active only when Prefix = Custom TXT.<br/>" +
         "e.g. NGC1234 &rarr; NGC1234, NGC1234_1, NGC1234_2 &hellip; (a per-row Suffix 2 gives NGC1234_&lt;suffix&gt;)</p>";

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
      this.colS1Label.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;
      this.colS1Label.setFixedWidth( comboWidth );
      this.colS1Label.styleSheet    = "font-weight: bold;";

      this.colS2Label = new Label( this );
      this.colS2Label.text          = "Suffix 2 - Custom";
      this.colS2Label.textAlignment = TextAlignment.Left | TextAlignment.VertCenter;
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

      for ( let r = 0; r < 6; ++r )
      {
         let row = {};

         row.label = new Label( dlg );
         row.label.text          = "Preview " + (r + 1) + ":";
         row.label.textAlignment = TextAlignment.Right | TextAlignment.VertCenter;
         row.label.setFixedWidth( labelWidth );

         row.s1Combo = new ComboBox( dlg );
         row.s1Combo.editEnabled = false;
         row.s1Combo.addItem( "---" );
         for ( let v = 0; v < MGC_VALUES.length; ++v )
            row.s1Combo.addItem( MGC_VALUES[v] );
         row.s1Combo.currentItem = 0;
         row.s1Combo.setFixedWidth( comboWidth );
         row.s1Combo.toolTip = "<p>MGC gradient scale for this preview. Active in BM_ mode only.</p>";

         row.s2Edit = new Edit( dlg );
         row.s2Edit.text    = "";
         row.s2Edit.minWidth = editWidth;
         row.s2Edit.toolTip = "<p>Optional custom suffix for this preview.<br/>" +
                              "BM_ mode: adds letter/text after scale if equal scale is used<br/>" +
                              "multiple times with different subvalues e.g. A &rarr; BM_128_A<br/>" +
                              "Custom TXT mode: per-row suffix, leave empty to auto-number.</p>";

         row.sizer = new HorizontalSizer;
         row.sizer.spacing = 6;
         row.sizer.add( row.label );
         row.sizer.add( row.s1Combo );
         row.sizer.add( row.s2Edit, 100 );

         dlg.rows.push( row );
      }

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

      // -----------------------------------------------------------------------
      // Buttons
      // -----------------------------------------------------------------------
      this.okButton = new PushButton( this );
      this.okButton.text    = "OK";
      this.okButton.icon    = this.scaledResource( ":/icons/ok.png" );
      this.okButton.onClick = function() { if ( validateDialog( dlg ) ) dlg.ok(); };

      this.cancelButton = new PushButton( this );
      this.cancelButton.text    = "Cancel";
      this.cancelButton.icon    = this.scaledResource( ":/icons/cancel.png" );
      this.cancelButton.onClick = function() { dlg.cancel(); };

      this.newInstanceButton = new ToolButton( this );
      this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
      this.newInstanceButton.setScaledFixedSize( 24, 24 );
      this.newInstanceButton.toolTip = "<p>New Instance: drag this triangle onto the workspace to " +
         "save the current settings as a process icon.</p>";
      this.newInstanceButton.onMousePress = function()
      {
         this.hasFocus = true;
         exportParameters( dlg );
         this.pushed = false;
         dlg.newInstance();
      };

      this.docButton = new ToolButton( this );
      this.docButton.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
      this.docButton.setScaledFixedSize( 24, 24 );
      this.docButton.toolTip = "<p>Open the +Previews manual.</p>";
      this.docButton.onClick = function()
      {
         if ( !Dialog.browseScriptDocumentation( DOC_NAME ) )
            (new MessageBox(
               "<p>The +Previews manual is not installed.</p>" +
               "<p>It comes with the Space Hunter update package (doc/scripts/" + DOC_NAME + ").</p>",
               "+Previews", StdIcon.Information, StdButton.Ok
            )).execute();
      };

      this.buttonSizer = new HorizontalSizer;
      this.buttonSizer.spacing = 8;
      this.buttonSizer.add( this.newInstanceButton );
      this.buttonSizer.add( this.docButton );
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

      for ( let r = 0; r < 6; ++r )
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
         let count        = dlg.countCombo.currentItem + 1;
         let prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];
         let hasCustomPfx = ( dlg.prefixCustomEdit.text.trim().length > 0 );

         // Prefix custom edit: only active for Custom TXT
         dlg.prefixCustomEdit.enabled = ( prefixChoice === "Custom TXT" );

         for ( let r = 0; r < 6; ++r )
         {
            let row       = dlg.rows[r];
            let rowActive = ( r < count );

            if ( !rowActive )
            {
               row.s1Combo.enabled = false;
               row.s2Edit.enabled  = false;
            }
            else if ( prefixChoice === "Preview" || prefixChoice === "GC_" )
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
               // Custom TXT
               if ( !hasCustomPfx )
               {
                  // No custom prefix -> Preview numbering, nothing to enter
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

      if ( Parameters.isGlobalTarget || Parameters.isViewTarget )
         importParameters( this );

      this.countCombo.onItemSelected       = function() { updateState(); };
      this.prefixCombo.onItemSelected      = function() { updateState(); };
      this.prefixCustomEdit.onEditCompleted = function() { updateState(); };

      updateState();
   }
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDialog( dlg )
{
   let count        = dlg.countCombo.currentItem + 1;
   let prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];

   // Collect all user-entered text into one string and check for spaces
   let allText = dlg.prefixCustomEdit.text;
   for ( let r = 0; r < 6; ++r )
      allText += dlg.rows[r].s2Edit.text;

   if ( allText.indexOf( " " ) >= 0 )
   {
      (new MessageBox(
         "<b>Nah..nah..nah,  You know better!</b><br/><br/>PixInsight does not like empty spaces between words!!!",
         "No Spaces Allowed!", StdIcon.Error, StdButton.Ok
      )).execute();
      return false;
   }

   // Preview names may only use letters, digits and "_", and must not start
   // with a digit; anything else makes createPreview() stop with an error.
   let custom = dlg.prefixCustomEdit.text.trim();
   if ( prefixChoice === "Custom TXT" && custom.length > 0 && !/^[A-Za-z_][A-Za-z0-9_]*$/.test( custom ) )
   {
      (new MessageBox(
         "Prefix <b>" + custom + "</b> can't be used as a preview name.<br/><br/>" +
         "Use only letters, digits and _ , and start with a letter.",
         "Invalid Prefix", StdIcon.Error, StdButton.Ok
      )).execute();
      return false;
   }
   for ( let r = 0; r < count; ++r )
   {
      let s2 = dlg.rows[r].s2Edit.text.trim();
      if ( s2.length > 0 && !/^[A-Za-z0-9_]+$/.test( s2 ) )
      {
         (new MessageBox(
            "Suffix <b>" + s2 + "</b> (Preview " + (r + 1) + ") can't be used in a preview name.<br/><br/>" +
            "Use only letters, digits and _ .",
            "Invalid Suffix", StdIcon.Error, StdButton.Ok
         )).execute();
         return false;
      }
   }

   // Check for missing MGC scale in BM_ mode
   if ( prefixChoice === "BM_" )
   {
      for ( let r = 0; r < count; ++r )
      {
         if ( dlg.rows[r].s1Combo.currentItem === 0 )
         {
            (new MessageBox(
               "Preview " + (r + 1) + " has no MGC scale selected.\n" +
               "Please select a scale value for every active preview row.",
               "Missing MGC Scale", StdIcon.Error, StdButton.Ok
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

// Names for a numbered sequence: base, base<sep>1, base<sep>2, ...
// Continues after the highest one already on the active window; a bare
// "base" counts as number 0. With overwrite, starts again at base.
//   Preview -> Preview, Preview1, ...      (sep "")
//   GC_     -> GC_, GC_1, ...              (sep "", matches GC_gradient_model, ...1)
//   NGC1234 -> NGC1234, NGC1234_1, ...     (sep "_")
function sequenceNames( base, sep, count, overwrite )
{
   let start = 0;
   let win = ImageWindow.activeWindow;
   if ( !overwrite && !win.isNull )
   {
      let highest = -1;
      let existing = win.previews;
      for ( let i = 0; i < existing.length; ++i )
      {
         let id = existing[i].id;
         if ( id === base )
            highest = Math.max( highest, 0 );
         else if ( id.indexOf( base + sep ) === 0 )
         {
            let rest = id.substring( ( base + sep ).length );
            if ( /^[0-9]+$/.test( rest ) )
               highest = Math.max( highest, parseInt( rest, 10 ) );
         }
      }
      start = highest + 1;
   }

   let names = [];
   for ( let r = 0; r < count; ++r )
   {
      let idx = start + r;
      names.push( idx === 0 ? base : base + sep + idx );
   }
   return names;
}

function buildNames( dlg )
{
   let count        = dlg.countCombo.currentItem + 1;
   let prefixChoice = PREFIX_OPTIONS[ dlg.prefixCombo.currentItem ];
   let customPfx    = dlg.prefixCustomEdit.text.trim();
   let overwrite    = dlg.overwriteCheckBox.checked;

   if ( prefixChoice === "Preview" )
      return sequenceNames( "Preview", "", count, overwrite );

   if ( prefixChoice === "GC_" )
      return sequenceNames( "GC_", "", count, overwrite );

   if ( prefixChoice === "BM_" )
   {
      let names = [];
      for ( let r = 0; r < count; ++r )
      {
         let scale = MGC_VALUES[ dlg.rows[r].s1Combo.currentItem - 1 ];
         let s2    = dlg.rows[r].s2Edit.text.trim();
         names.push( s2.length > 0 ? "BM_" + scale + "_" + s2 : "BM_" + scale );
      }
      return names;
   }

   // Custom TXT: no prefix -> same as Preview; per-row suffix -> prefix_suffix
   if ( customPfx.length === 0 )
      return sequenceNames( "Preview", "", count, overwrite );

   let auto  = sequenceNames( customPfx, "_", count, overwrite );
   let names = [];
   for ( let r = 0; r < count; ++r )
   {
      let s2 = dlg.rows[r].s2Edit.text.trim();
      names.push( s2.length > 0 ? customPfx + "_" + s2 : auto[r] );
   }
   return names;
}

// Same name twice in one request (e.g. two BM_ rows with the same scale and no
// suffix): later ones get _1, _2 ... instead of PixInsight's silent BM_7681.
function uniqueNames( names )
{
   let seen = {}, out = [];
   for ( let i = 0; i < names.length; ++i )
   {
      let n = names[i];
      if ( seen[n] )
      {
         let k = 1;
         while ( seen[n + "_" + k] ) ++k;
         console.writeln( "Name '" + n + "' requested twice - using '" + n + "_" + k + "'." );
         n = n + "_" + k;
      }
      seen[n] = true;
      out.push( n );
   }
   return out;
}

// ---------------------------------------------------------------------------
// Create previews in PixInsight
// ---------------------------------------------------------------------------

function createPreviews( names, overwrite )
{
   let win = ImageWindow.activeWindow;
   if ( win.isNull )
   {
      console.criticalln( "No active image window." );
      return;
   }

   let img  = win.mainView.image;
   let rect = new Rect( 0, 0, img.width, img.height );

   if ( overwrite )
   {
      // Delete all existing previews
      let existing = win.previews;
      for ( let i = 0; i < existing.length; ++i )
         win.deletePreview( existing[i] );
      console.writeln( "Overwrite enabled: deleted all existing previews." );
   }
   else
   {
      // Build a set of existing preview IDs
      let existingIds = {};
      let existing = win.previews;
      for ( let i = 0; i < existing.length; ++i )
         existingIds[ existing[i].id ] = true;

      // Filter out names that already exist
      let filtered = [];
      for ( let i = 0; i < names.length; ++i )
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

   let previews = [];

   for ( let i = 0; i < names.length; ++i )
   {
      let pv = win.createPreview( rect, names[i] );
      previews.push( pv );
      console.writeln( "Created preview: " + names[i] );
   }

   for ( let i = 0; i < previews.length; ++i )
   {
      win.currentView = previews[i];
      win.bringToFront();
      CoreApplication.processEvents();
      CoreApplication.processEvents();
      win.zoomToOptimalFit();
      CoreApplication.processEvents();
      CoreApplication.processEvents();
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
   if ( Parameters.isViewTarget && !Parameters.targetView.isNull )
      Parameters.targetView.window.bringToFront();

   let dlg = new PreviewDialog();
   if ( dlg.execute() )
   {
      let names     = uniqueNames( buildNames( dlg ) );
      let overwrite = dlg.overwriteCheckBox.checked;
      createPreviews( names, overwrite );
   }
}

main();
