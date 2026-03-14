#feature-id Space_Hunter > SH KillPreviews
#feature-icon  SH_KillPreviews.svg
#feature-info Space Hunter KillPreviews v1.0<br/>\
   <br/>\
   Deletes all previews from the active image window.<br/>\
   <br/>\
   Copyright &copy; 2026 Georg G Albrecht. MIT License.

//============================================================================
// KillPreviews.js
//============================================================================
//
//MIT License
//Space Hunter KillPreviews.js
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

function main()
{
   // Must run as global target to avoid crash when deleting previews
   if ( Parameters.isViewTarget ) {
      console.criticalln("ERROR: Please run this script in Global Context.");
      return;
   }

   let win = ImageWindow.activeWindow;
   if ( win.isNull ) {
      console.criticalln("ERROR: No active image window.");
      return;
   }

   let previews = win.previews;
   if ( !previews || previews.length === 0 ) {
      console.writeln("No previews found in active window.");
      return;
   }

   let count = previews.length;
   console.writeln("Found " + count + " preview(s) - deleting...");

   while ( win.previews.length > 0 )
      win.deletePreview( win.previews[0] );

   console.writeln("\u2714 All previews deleted.");
}

main();
