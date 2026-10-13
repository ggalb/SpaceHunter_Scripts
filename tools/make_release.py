"""Build the PixInsight 1.9.5+ release zip from src/ and doc/.

Usage (from the repo root):  python -I tools/make_release.py YYYYMMDD [out_dir]

Writes SpaceHunter_Scripts_YYYYMMDD.zip (to out_dir, default: repo root) and
prints its SHA-1 plus a <package> block to paste into updates.xri.
Refuses to overwrite an existing zip: two packages must never share a name.
"""
import hashlib, os, sys, zipfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = "src/scripts/Space_Hunter/"

# Deleted by PixInsight before the package installs (paths relative to the
# PI install dir). Missing items are skipped with a warning.
REMOVE = [P + x for x in [
    "SH_LazyWorkflow_Part1_V8_v2.0.js", "SH_LazyWorkflow_Part1_V8_v2.1.js",
    "SH_LazyWorkflow_Part2_V8_v2.0.js", "SH_LazyWorkflow_Part2_V8_v2.1.js",
    "SH_+Preview_V8_v2.0.js", "SH_KillPreviews_V8_v2.0.js", "SH_NamePreviews_V8_v2.0.js",
    "SH_LazyWorkflow_Part1_Legacy_v1.4.js", "SH_Cog.png", "SH_pdfIcon.png",
    "SH_Workflow_Guide.pdf"]]

def collect():
    files = []
    for top in ("src", "doc"):
        for root, _, names in os.walk(os.path.join(REPO, top)):
            for n in names:
                full = os.path.join(root, n)
                files.append(os.path.relpath(full, REPO).replace("\\", "/"))
    return sorted(files)

def main():
    if len(sys.argv) < 2 or not (len(sys.argv[1]) == 8 and sys.argv[1].isdigit()):
        sys.exit("usage: make_release.py YYYYMMDD [out_dir]")
    date = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else REPO
    name = "SpaceHunter_Scripts_%s.zip" % date
    out = os.path.join(out_dir, name)
    if os.path.exists(out):
        sys.exit("%s already exists - pick another name (add a time suffix)." % out)
    files = collect()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        # The comment makes the checksum unique even if the contents equal an
        # earlier (test) package: PI must never see two packages with one SHA-1.
        z.comment = ("Space Hunter Scripts %s" % date).encode()
        for arc in files:
            z.write(os.path.join(REPO, arc), arc)
    with open(out, "rb") as f:
        sha = hashlib.sha1(f.read()).hexdigest()
    sep = ",\n            "
    print("%s  sha1=%s  (%d files)" % (name, sha, len(files)))
    print('''
      <package
         fileName="%s"
         sha1="%s"
         type="script"
         releaseDate="%s"
         title="Space Hunter Scripts %s">
         <description>
            <p>TODO release notes</p>
         </description>
         <remove>
            %s
         </remove>
      </package>''' % (name, sha, date, date, sep.join(REMOVE)))

if __name__ == "__main__":
    main()
