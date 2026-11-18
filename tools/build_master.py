"""Build the Master scripts and manual sources from Part 1 and Part 2 (read-only).

Usage:  python -I build_master.py [--src <folder with the two part scripts>] [--force]

Two variants from one template (v0.3.3, PTeam 2026-11-18, CPD rule 5.3):
  release:  src/scripts/Space_Hunter/SH_LazyWorkflow_Master_V8.js and
            pidoc/SHLazyWorkflowMaster.pidoc - NO sound on any system;
  internal: internal/src/scripts/Space_Hunter/SH_LazyWorkflow_Master_Internal_V8.js
            and internal/pidoc/SHLazyWorkflowMasterInternal.pidoc - Georg's own
            copy with sound, own feature-id / menu / icon / manual, v0.x-internal.
            internal/ is git-ignored (dev is pushed to public GitHub) and
            outside src/ doc/ rsc/, so it is never pushed or packaged.
Internal-only code (sound; since v0.3.6 also the TEST "simulate MGC failure"
checkbox) is NOT in the templates: it lives in the git-ignored
internal/master_internal.js and internal/master_internal.pidoc, as named sections
("// @@@ <name>" / "% @@@ <name>"). Template markers (script "//", manual "%"):
  line "[internal:<name>]"        internal: replaced by that section; release: dropped
  line ending in [nosound]        line kept only in the release variant
Without internal/master_internal.* (e.g. a GitHub clone) only the release is built.

Default source (and release output folder): src/scripts/Space_Hunter/ of this repo.
The parts are copied unchanged into master_template.js except for the few
build edits listed in the template header. The master's run hooks are
adapted copies of each part's main(): if a part's main() changed since the
hooks were written, the build stops (review the hooks, then update
MAIN_SHA1 below, or pass --force).
"""
import argparse
import datetime
import hashlib
import os
import re
import sys

# Release line: v0.3.x-test until the first PI push, which is v1.0.0.
# Internal line: stays below v1 for good (never mixed up with a release).
MASTER_VERSION = "v0.3.6-test"
INTERNAL_VERSION = "v0.3.6-internal"

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
# tools/ of the SpaceHunter_Scripts repo (moved here from ScriptsTesting,
# 2026-11-17): the parts and the generated Master sit in src/scripts/Space_Hunter.
DEFAULT_SRC = os.path.normpath(os.path.join(REPO, "src", "scripts", "Space_Hunter"))
PART1 = "SH_LazyWorkflow_Part1_V8.js"
PART2 = "SH_LazyWorkflow_Part2_V8.js"

VARIANTS = [
    {   # what users get
        "name": "release",
        "internal": False,
        "version": MASTER_VERSION,
        "FEATURE_ID": "SHLazyWorkflowMaster",
        "MENU_NAME": "SH Lazy Workflow Master",
        "NAME_SUFFIX": "",
        "ICON": "SH_Master.svg",
        "BUILD_LABEL": "TEST BUILD",
        "script": os.path.join(DEFAULT_SRC, "SH_LazyWorkflow_Master_V8.js"),
        "pidoc": os.path.join(REPO, "pidoc", "SHLazyWorkflowMaster.pidoc"),
    },
    {   # Georg's own copy, never distributed
        "name": "internal",
        "internal": True,
        "version": INTERNAL_VERSION,
        "FEATURE_ID": "SHLazyWorkflowMasterInternal",
        "MENU_NAME": "SH Lazy Workflow Master - Internal",
        "NAME_SUFFIX": " - Internal",
        "ICON": "SH_Master_Internal.svg",
        "BUILD_LABEL": "INTERNAL BUILD - not for distribution",
        "script": os.path.join(REPO, "internal", "src", "scripts", "Space_Hunter",
                               "SH_LazyWorkflow_Master_Internal_V8.js"),
        "pidoc": os.path.join(REPO, "internal", "pidoc", "SHLazyWorkflowMasterInternal.pidoc"),
    },
]
INTERNAL_JS = os.path.join(REPO, "internal", "master_internal.js")
INTERNAL_DOC = os.path.join(REPO, "internal", "master_internal.pidoc")

# Must not appear in the release build's own code (comments are fine).
# SHM_ALARM / sound_Check / shmSim / simFail: left-over uses would be ReferenceErrors at run time.
RELEASE_FORBIDDEN = re.compile(
    r"shmSound|ExternalProcess|powershell|afplay|paplay|SoundPlayer|soundEnabled|"
    r"SHM_ALARM|sound_Check|shmSim|simFail", re.I)

# sha1 of "\nfunction main()\n" ... end of file, LF line ends.
# Written against Part 1 v2.7.31 / Part 2 v2.4.26 (dev 934a335).
MAIN_SHA1 = {
    PART1: "4c0edda3ab7fe88e1fab7650f244acb229263e00",
    PART2: "d29ab97686b61134198376a1af3e185c5bc8bbf3",
}

INCLUDE_BLOCK = (
    "/* beautify ignore:start */\n"
    "#define USE_SOLVER_LIBRARY true\n"
    "#define SETTINGS_MODULE     \"SOLVER\"\n"
    "#include \"../ImageSolver/ImageSolver.js\"\n"
    "/* beautify ignore:end */\n")


def fail(msg):
    sys.exit("build_master: " + msg)


def strip_header(text):
    """Drop #engine / #feature-* lines (incl. backslash continuations)."""
    out, cont = [], False
    for line in text.split("\n"):
        if cont or re.match(r"\s*#(engine|feature-)", line):
            cont = line.rstrip().endswith("\\")
            continue
        out.append(line)
    return "\n".join(out)


def prepare(path, prefix, force):
    with open(path, encoding="utf-8", newline="") as f:
        raw = f.read()
    text = raw.replace("\r\n", "\n")
    name = os.path.basename(path)

    i = text.find("\nfunction main()\n")
    if i < 0 or not text.rstrip().endswith("main();"):
        fail(name + ": main() / final main(); call not found")
    digest = hashlib.sha1(text[i:].encode("utf-8")).hexdigest()
    if digest != MAIN_SHA1[name] and not force:
        fail(name + ": main() changed since the master hooks were written "
             "(sha1 " + digest + "). Port the change into master_template.js, "
             "then update MAIN_SHA1 (or run with --force).")
    text = text[:i + 1]

    m = re.search(r'#define SCRIPT_VERSION "([^"]+)"', text)
    if not m:
        fail(name + ": SCRIPT_VERSION not found")
    version = m.group(1)

    text = strip_header(text)
    if prefix == "P1_":
        if text.count(INCLUDE_BLOCK) != 1:
            fail(name + ": ImageSolver include block not found exactly once")
        text = text.replace(INCLUDE_BLOCK,
                            "// [master build] ImageSolver #include moved to file level\n")
    elif "#include" in text:
        fail(name + ": unexpected #include")

    # PI's preprocessor opens a block comment at "/*" even inside a "//"
    # comment (Part 1: "// (the <pjsr/astrometry/*> library ..."). In the
    # single script the next "*/" was 6 lines below; in the master it was
    # 3000 lines below and swallowed code (2026-11-16: SyntaxError ')').
    text = "\n".join(l.replace("/*", "/ *") if l.lstrip().startswith("//") else l
                     for l in text.split("\n"))
    bad = [l for l in text.split("\n") if re.search(r"//.*/\*", l) and not l.lstrip().startswith("/*")]
    if bad:
        fail(name + ": '/*' after '//' (PI preprocessor opens a comment): " + repr(bad[:3]))

    text = re.sub(r"\bSCRIPT_(NAME|VERSION)\b", prefix + r"SCRIPT_\1", text)
    left = re.findall(r"^\s*#(?!define (P1|P2)_SCRIPT_)\S+.*$", text, re.M)
    if left:
        fail(name + ": unhandled preprocessor lines: " + repr(left[:3]))
    return text.strip("\n"), version, hashlib.sha1(raw.encode("utf-8")).hexdigest()


def read_sections(path, comment):
    """Named sections of internal/master_internal.* (see module doc)."""
    with open(path, encoding="utf-8") as f:
        lines = f.read().replace("\r\n", "\n").split("\n")
    head = re.compile(r"^" + re.escape(comment) + r" @@@ (\w+)\s*$")
    sections, name = {}, None
    for line in lines:
        m = head.match(line)
        if m:
            name = m.group(1)
            if name in sections:
                fail(os.path.basename(path) + ": section " + name + " twice")
            sections[name] = []
        elif name:
            sections[name].append(line)
    for k in sections:                       # one blank line separates sections
        if sections[k] and sections[k][-1] == "":
            sections[k].pop()
    return sections


def select_internal(text, sections, comment, where):
    """sections = dict (internal build) or None (release build)."""
    c = re.escape(comment)
    slot = re.compile(r"^\s*" + c + r" \[internal:(\w+)\]\s*$")
    tail = re.compile(r"\s*" + c + r" \[nosound\]\s*$")
    out, used = [], set()
    for n, line in enumerate(text.split("\n"), 1):
        m = slot.match(line)
        if m:
            if sections is not None:
                if m.group(1) not in sections:
                    fail(where + ":" + str(n) + ": no section '" + m.group(1) + "' in the internal sections file")
                out.extend(sections[m.group(1)])
                used.add(m.group(1))
            continue
        m = tail.search(line)
        if m:
            if sections is None:
                out.append(line[:m.start()])
            continue
        out.append(line)
    if sections is not None and set(sections) - used:
        fail(where + ": unused internal sections " + repr(sorted(set(sections) - used)))
    return "\n".join(out)


def fill(text, v, extra):
    keys = dict(extra)
    keys.update({k: v[k] for k in ("FEATURE_ID", "MENU_NAME", "NAME_SUFFIX", "ICON", "BUILD_LABEL")})
    keys["BUILD_LABEL_LC"] = v["BUILD_LABEL"].lower()
    keys["MASTER_VERSION"] = v["version"]
    for k, val in keys.items():
        text = text.replace("@@" + k + "@@", val)
    return text


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    p1, v1, h1 = prepare(os.path.join(a.src, PART1), "P1_", a.force)
    p2, v2, h2 = prepare(os.path.join(a.src, PART2), "P2_", a.force)

    with open(os.path.join(HERE, "master_template.js"), encoding="utf-8") as f:
        tpl_js = f.read()
    with open(os.path.join(HERE, "master_template.pidoc"), encoding="utf-8") as f:
        tpl_doc = f.read()
    info = ("//   " + PART1 + " " + v1 + "  (sha1 " + h1 + ")\n"
            "//   " + PART2 + " " + v2 + "  (sha1 " + h2 + ")\n"
            # Repo-relative: no local paths in the distributed script.
            "//   source folder: " + os.path.relpath(a.src, REPO).replace(os.sep, "/") + "\n"
            "//   built " + datetime.date.today().isoformat())

    for v in VARIANTS:
        snd_js = snd_doc = None
        if v["internal"]:
            if not (os.path.isfile(INTERNAL_JS) and os.path.isfile(INTERNAL_DOC)):
                print("skipped", v["name"], "- internal/master_internal.js / .pidoc not found")
                continue
            snd_js = read_sections(INTERNAL_JS, "//")
            snd_doc = read_sections(INTERNAL_DOC, "%")
        # Code first: the part sources must not be scanned for @@ markers.
        tpl = select_internal(tpl_js, snd_js, "//", "master_template.js")
        tpl = fill(tpl, v, {"BUILD_INFO": info, "P1_VERSION": v1, "P2_VERSION": v2})
        if tpl.count("@@P1_CODE@@") != 1 or tpl.count("@@P2_CODE@@") != 1:
            fail("template markers missing")
        before, rest = tpl.split("@@P2_CODE@@")
        middle, after = rest.split("@@P1_CODE@@")
        own = before + middle + after
        if "@@" in own:
            fail(v["name"] + ": unreplaced template marker")
        if not v["internal"]:
            code = [l for l in own.split("\n") if not l.lstrip().startswith("//")]
            bad = [l.strip() for l in code if RELEASE_FORBIDDEN.search(l)]
            if bad:
                fail("release build still has internal-only code: " + repr(bad[:3]))
        out = before + p2 + middle + p1 + after
        write(v["script"], out)
        print("wrote", os.path.relpath(v["script"], REPO), "-", v["version"], "-",
              out.count("\n"), "lines; Part 1", v1, "/ Part 2", v2)

        doc = select_internal(tpl_doc, snd_doc, "%", "master_template.pidoc")
        doc = fill(doc, v, {"GENERATED_NOTE": "GENERATED FILE - DO NOT EDIT. Built by tools/build_master.py "
                                              "from tools/master_template.pidoc (" + v["name"] + " variant)."})
        if "@@" in doc:
            fail(v["name"] + ": unreplaced marker in the manual")
        # Body only (from the \script line on): the header comment may say "sound".
        body = doc.split("\n" + chr(92) + "script {", 1)[1]
        if not v["internal"] and re.search(r"sound|powershell|afplay|paplay", body, re.I):
            fail("release manual still mentions sound")
        write(v["pidoc"], doc)
        print("wrote", os.path.relpath(v["pidoc"], REPO))


if __name__ == "__main__":
    main()
