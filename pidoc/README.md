# PIDoc draft — SH Lazy Workflow Part 1 / Part 2

Draft manuals in PixInsight's own documentation format (see `../FINDINGS.md`).
Written 2026-10-05 against script **v2.2**, from `SH_Workflow_Guide_03272026` (v1.3).

| File | What it is |
|---|---|
| `SHLazyWorkflowPart1.pidoc` | Script doc, `\script SHLazyWorkflowPart1` |
| `SHLazyWorkflowPart2.pidoc` | Script doc, `\script SHLazyWorkflowPart2` |
| `SH_Common.pidoc` | Shared include (Requirements, Button Bar, License, Bonus Scripts). Starts with `!<` so it can't be compiled alone |
| `images/` | Taken from the PDF (dialogs are **v1.3** screenshots) |

## Compile (don't target Program Files)

1. Script > Development > DocumentationCompiler. Check **Generate new PIDoc
   system** and pick a writable folder, e.g. `Code/PixInsight_Scripts/SpaceHunter/pidoc_build`.
2. Add `SHLazyWorkflowPart1.pidoc` and `SHLazyWorkflowPart2.pidoc` (not
   `SH_Common.pidoc`), then click Run. Errors and warnings appear in the Process Console.
3. Output: `<build>/scripts/SHLazyWorkflowPart1/SHLazyWorkflowPart1.html` (+ `images/`).

Syntax-only check from the Process Console:

    run -a="--no-generate" -a="<path>/SHLazyWorkflowPart1.pidoc" -x=auto "C:/Program Files/PixInsight/src/scripts/PIDocCompiler/pidoc.js"

**Compiled 2026-10-05 with PI 1.9.5's compiler (v1.8.0): no errors.** The only
warnings are "Unreferenced label" (harmless). Output is in
`../../pidoc_build/doc/scripts/SHLazyWorkflowPart{1,2}/`, a private doc system.

How it was built: the connector can't pass arguments to `pidoc.js`, and
`PixInsight.exe -r=...` didn't run scripts on this machine. So
`pidoc_build/flatten_pidoc.py` flattens the compiler into `pidoc_flat.js`
(inlines `#include`, turns `#define` into `var`). That file is run through the
connector with the target forced to `pidoc_build/doc`. `pidoc_build/src/`
holds a copy of these sources. Re-copy them before rebuilding.

Note: the compiler always puts predefined sections (Description, Usage) before
custom ones, so "Requirements and License" comes after Usage.

## Expected warnings
- `\relatedscripts SHLazyWorkflowPart2` / `\sref` warn until both docs are
  in the same target system. Compile both into it.

## Content changes vs. the v1.3 PDF (please confirm)
- **Plate solve is headless in v2.2** ("No dialog is shown"). The PDF's
  "click OK in ImageSolve" and "cancel ImageSolve" text was replaced.
- **PixInsight 1.9.5+** (both scripts call `ensureMinimumVersion(1,9,5)`), not 1.8.9.3.
- Added the v2.2 features: **MLDenoise** (Part 2, mutually exclusive with NXT),
  the BXT **ML Version** dropdown, and the **White Reference** field in Part 1 SPFC.
- Dependency table follows `updateDependencies()`: enabling MGC also enables
  SPFC and Previews, and enabling GC turns Previews on.
- The MTF formula is an image (`images/MTF.png`). `\equation` needs LaTeX,
  which isn't installed.

## To do before shipping
- Re-shoot the four dialog screenshots from v2.2.
- Change the scripts' feature-id to the ID form plus a `browseScriptDocumentation` button (FINDINGS §4–5).
- Package `doc/scripts/SHLazyWorkflowPart{1,2}/` in the release zip (FINDINGS §3).
