"""Build a Space Hunter release for PixInsight 1.9.6+ into build/release-YYYYMMDD/.

Usage (from the repo root, on branch dev):
    python -I tools/make_release.py YYYYMMDD[_HHMM] [--signed]

The release folder holds exactly what branch main gets (main = distribution
only):
    SpaceHunter_Scripts_YYYYMMDD.zip   scripts, manuals, icons (+ .xsgn signatures)
    updates.xri                        one package for PI 1.9.6+, notes from
                                       tools/release_notes.txt
    README.md, LICENSE, CHANGELOG.md, .gitattributes   copied from dev

What goes into the zip: the files git tracks under src/, doc/ and rsc/, plus
the CodeSign signature (.xsgn) next to each tracked script. Untracked files
are never packed. The build stops when any of those files, the release notes
or the copied root files differ from the last commit.

--signed: every script must have a .xsgn newer than the script itself.
Without it, signatures that exist are packed and missing ones are listed.

Afterwards: sign updates.xri in the release folder last (CodeSign, if this is
a signed release), then run tools/stage_main.py on the folder.
"""
import hashlib, os, re, shutil, subprocess, sys, zipfile
import xml.etree.ElementTree as ET

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = "src/scripts/Space_Hunter/"
PI_VERSIONS = "1.9.6:1.9.9"
NOTES = "tools/release_notes.txt"
ROOT_FILES = ["README.md", "LICENSE", "CHANGELOG.md", ".gitattributes"]

# Deleted by PixInsight before the package installs (paths relative to the
# PI install dir). Missing items are skipped with a warning. Only files of
# this package's history: never the whole Space_Hunter folder, which may hold
# other scripts (e.g. the stand-alone SH AASTF).
REMOVE = [P + x for x in [
    "SH_LazyWorkflow_Part1_V8_v2.0.js", "SH_LazyWorkflow_Part1_V8_v2.1.js",
    "SH_LazyWorkflow_Part2_V8_v2.0.js", "SH_LazyWorkflow_Part2_V8_v2.1.js",
    "SH_+Preview_V8_v2.0.js", "SH_KillPreviews_V8_v2.0.js", "SH_NamePreviews_V8_v2.0.js",
    "SH_LazyWorkflow_Part1_Legacy_v1.4.js", "SH_Cog.png", "SH_pdfIcon.png",
    "SH_Workflow_Guide.pdf",
    # Menu icons moved to rsc/icons/script/<script-id>/ (@script_icons_dir)
    "SH_WorkFlow1.svg", "SH_WorkFlow2.svg", "SH_PlusPreviews.svg",
    "SH_KillPreviews.svg", "SH_NamePreviews.svg",
    # Part 2 uses PI's own :/messages/warning.png instead
    "SH_WarningSign.png"]]

XRI_HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">

   <description>
      <p><b>Space Hunter Scripts for PixInsight</b></p>
      <p>A collection of scripts for automated linear image processing of OSC camera images.</p>
      <p>Copyright &copy; 2026 Georg G Albrecht. MIT License.</p>
      <p>Repository: https://github.com/ggalb/SpaceHunter_Scripts</p>
   </description>
"""


def git(*args):
    return subprocess.run(["git", "-C", REPO] + list(args), check=True,
                          capture_output=True, text=True).stdout


def fail(msg):
    sys.exit("ERROR: " + msg)


def check_clean(paths):
    dirty = [l for l in git("status", "--porcelain", "--untracked-files=no", "--", *paths).splitlines()]
    if dirty:
        fail("not committed:\n  " + "\n  ".join(dirty))
    tracked = set(git("ls-files", "--", *paths).splitlines())
    untracked = [p for p in paths if "." in os.path.basename(p) and p not in tracked]
    if untracked:
        fail("not in git: " + ", ".join(untracked))
    if git("rev-parse", "--abbrev-ref", "HEAD").strip() != "dev":
        fail("run on branch dev")


def collect(signed):
    files = [f for f in git("ls-files", "-z", "--", "src", "doc", "rsc").split("\0") if f]
    scripts = [f for f in files if f.startswith(P) and f.endswith(".js")]
    sigs, missing, stale = [], [], []
    for js in scripts:
        sig = js[:-3] + ".xsgn"
        full = os.path.join(REPO, sig)
        if sig in files:
            pass                                   # committed with the script
        elif os.path.exists(full):
            sigs.append(sig)
        else:
            missing.append(sig)
            continue
        if os.path.getmtime(full) < os.path.getmtime(os.path.join(REPO, js)):
            stale.append(sig)
    if stale:
        fail("signature older than its script (re-sign): " + ", ".join(stale))
    if missing and signed:
        fail("--signed, but no signature: " + ", ".join(missing))
    return sorted(files + sigs), scripts, missing


def published_sha1s():
    """SHA-1 of every package ever listed in updates.xri on any branch."""
    shas = set()
    for c in git("log", "--all", "--format=%H", "--", "updates.xri").split():
        try:
            text = git("show", c + ":updates.xri")
        except subprocess.CalledProcessError:
            continue
        shas.update(re.findall(r'sha1="([0-9a-f]{40})"', text))
    return shas


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_xri(name, sha, date, notes):
    desc = "\n".join("            <p>%s</p>" % esc(l) for l in notes)
    rem = ",\n            ".join(REMOVE)
    return XRI_HEAD + """
   <!-- PixInsight 1.9.6 and later. Packages for 1.9.5 and earlier are withdrawn. -->
   <platform os="all" arch="noarch" version="%s">
      <package
         fileName="%s"
         sha1="%s"
         type="script"
         releaseDate="%s"
         title="Space Hunter Scripts %s">
         <description>
%s
         </description>
         <remove>
            %s
         </remove>
      </package>
   </platform>

</xri>
""" % (PI_VERSIONS, name, sha, date[:8], date, desc, rem)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    signed = "--signed" in sys.argv[1:]
    if len(args) != 1 or not re.fullmatch(r"[0-9]{8}(_[0-9]{4})?", args[0]):
        sys.exit("usage: make_release.py YYYYMMDD[_HHMM] [--signed]  (suffix for a 2nd release on one day)")
    date = args[0]

    check_clean(["src", "doc", "rsc", NOTES] + ROOT_FILES)
    notes_path = os.path.join(REPO, NOTES)
    if not os.path.exists(notes_path):
        fail(NOTES + " missing")
    notes = [l.strip() for l in open(notes_path, encoding="utf-8")
             if l.strip() and not l.lstrip().startswith("#")]
    if not notes:
        fail(NOTES + " has no lines")

    out_dir = os.path.join(REPO, "build", "release-" + date)
    if os.path.exists(out_dir):
        fail(out_dir + " exists - delete it or pick another date / suffix")
    files, scripts, missing = collect(signed)

    os.makedirs(out_dir)
    name = "SpaceHunter_Scripts_%s.zip" % date
    out = os.path.join(out_dir, name)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        # The comment makes the checksum unique even if the contents equal an
        # earlier (test) package: PI must never see two packages with one SHA-1.
        z.comment = ("Space Hunter Scripts %s" % date).encode()
        for arc in files:
            z.write(os.path.join(REPO, arc), arc)
    with open(out, "rb") as f:
        sha = hashlib.sha1(f.read()).hexdigest()
    if sha in published_sha1s():
        shutil.rmtree(out_dir)
        fail("SHA-1 %s was already published - change the date or add a suffix" % sha)

    xri = build_xri(name, sha, date, notes)
    ET.fromstring(xri.replace("&copy;", "(c)").encode("utf-8"))     # well-formed?
    with open(os.path.join(out_dir, "updates.xri"), "w", encoding="utf-8", newline="\n") as f:
        f.write(xri)
    for r in ROOT_FILES:
        shutil.copyfile(os.path.join(REPO, r), os.path.join(out_dir, r))

    print("%s  sha1=%s  (%d files, %d scripts)" % (name, sha, len(files), len(scripts)))
    print("Release folder: " + out_dir)
    for f in sorted(os.listdir(out_dir)):
        print("   " + f)
    if missing:
        print("UNSIGNED: " + ", ".join(os.path.basename(m) for m in missing))
    print("\nNext: check updates.xri (notes, remove list); sign it last if this is a "
          "signed release;\nthen: python -I tools/stage_main.py " +
          os.path.relpath(out_dir, REPO).replace("\\", "/"))


if __name__ == "__main__":
    main()
