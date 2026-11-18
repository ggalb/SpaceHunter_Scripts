# PIDoc sources — Space Hunter manuals

Manual sources in PixInsight's documentation format. Compiled pages are in
`../doc/scripts/<menu name>/` and ship in the release package.
Current as of Part 1 v2.7.32 / Part 2 v2.4.27 / Master v0.3.3-test, PixInsight 1.9.6 (compiler 1.8.1).

| File | What it is |
|---|---|
| `SHLazyWorkflowPart1.pidoc` | Manual of SH Lazy Workflow Part 1 |
| `SHLazyWorkflowPart2.pidoc` | Manual of SH Lazy Workflow Part 2 |
| `SHPlusPreviews.pidoc` | Manual of SH +Previews |
| `SHLazyWorkflowMaster.pidoc` | **Generated** (edit `../tools/master_template.pidoc`, run `tools/build_master.py`). Manual of SH Lazy Workflow Master (runs Part 1 + Part 2; own Requirements/Files/License, does not include `SH_Common.pidoc`). No sound. |
| `SHLazyWorkflowMasterInternal.pidoc` | **Generated**, same template. Manual of Georg's internal Master (with sound). Compile it into `../internal/doc/scripts/SH Lazy Workflow Master - Internal/`, **never** into `../doc/` (everything tracked under doc/ ships). |
| `SH_Common.pidoc` | Shared include (Requirements, Files/Programs/Internet Access, Button Bar, License, Bonus Scripts). Starts with `!<` so it can't be compiled alone |
| `images/` | Screenshots, cropped to the dialog frame (PixInsight 1.9.6) |
| `trim_images.py` | Old crop tool for screenshots with a dark desktop border |

The manual folder must be named after the script's **menu name**
(e.g. `doc/scripts/SH Lazy Workflow Part 1/`): `Dialog.browseScriptDocumentation()`
looks it up by that name.

## Compile (don't target Program Files)

1. Script > Development > DocumentationCompiler. Check **Generate new PIDoc
   system** and pick a writable folder outside PixInsight's installation.
2. Add the four script `.pidoc` files (not `SH_Common.pidoc`), then click Run.
   Errors and warnings appear in the Process Console. "Unreferenced label"
   warnings are harmless.
3. Copy `<build>/doc/scripts/<menu name>/` into `../doc/scripts/`.

The author's builds run a flattened copy of PixInsight's compiler (all
`#include`s inlined) through a PixInsight connector, with the output folder
forced to a private build folder; the result is the same as step 1–3.

Note: the compiler always puts predefined sections (Description, Usage) before
custom ones, so "Requirements and License" comes after Usage.
