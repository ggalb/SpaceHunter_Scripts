"""Stage a release folder as the new content of branch main.

Usage (from the repo root):
    python -I tools/stage_main.py build/release-YYYYMMDD

main holds only the distribution (updates.xri, the current zip, README.md,
LICENSE, CHANGELOG.md, .gitattributes); the sources live on dev. This script
works in a separate worktree, build/main-worktree (build/ is git-ignored), so
the dev checkout never switches branches:

  1. creates the worktree on main if it doesn't exist (it must be clean),
  2. removes every tracked file there and copies the release folder in,
  3. stages the result (git add -A) and shows what changes.

It does not commit, tag or push: those follow on Georg's go, with the
commands printed at the end.
"""
import os, shutil, subprocess, sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WT = os.path.join(REPO, "build", "main-worktree")
EXPECTED = {"updates.xri", "README.md", "LICENSE", "CHANGELOG.md", ".gitattributes"}


def git(cwd, *args):
    return subprocess.run(["git", "-C", cwd] + list(args), check=True,
                          capture_output=True, text=True).stdout


def fail(msg):
    sys.exit("ERROR: " + msg)


def main():
    if len(sys.argv) != 2:
        sys.exit("usage: stage_main.py build/release-YYYYMMDD")
    rel = os.path.abspath(os.path.join(REPO, sys.argv[1]))
    if not os.path.isdir(rel):
        fail(rel + " not found")
    names = set(os.listdir(rel))
    zips = [n for n in names if n.startswith("SpaceHunter_Scripts_") and n.endswith(".zip")]
    if len(zips) != 1 or names != EXPECTED | set(zips):
        fail("release folder must hold exactly one zip plus " + ", ".join(sorted(EXPECTED)) +
             "; found: " + ", ".join(sorted(names)))
    date = zips[0][len("SpaceHunter_Scripts_"):-4]
    xri = open(os.path.join(rel, "updates.xri"), encoding="utf-8").read()
    if 'fileName="%s"' % zips[0] not in xri:
        fail("updates.xri does not name " + zips[0])

    if not os.path.isdir(WT):
        git(REPO, "worktree", "add", WT, "main")
    if git(WT, "rev-parse", "--abbrev-ref", "HEAD").strip() != "main":
        fail(WT + " is not on main")
    if git(WT, "status", "--porcelain"):
        fail(WT + " has uncommitted changes - check or reset them first")

    for f in git(WT, "ls-files", "-z").split("\0"):
        if f:
            os.remove(os.path.join(WT, f))
    for n in names:
        shutil.copyfile(os.path.join(rel, n), os.path.join(WT, n))
    # Remove folders emptied above (git doesn't track empty ones).
    for root, dirs, files in os.walk(WT, topdown=False):
        if ".git" in root.split(os.sep) or root == WT:
            continue
        if not os.listdir(root):
            os.rmdir(root)

    git(WT, "add", "-A")
    print(git(WT, "status", "--short"))
    print(git(WT, "diff", "--cached", "--stat").splitlines()[-1] if
          git(WT, "diff", "--cached", "--stat") else "no changes")
    wt = os.path.relpath(WT, REPO).replace("\\", "/")
    print("""
Staged in %s. Review, then on Georg's go:
   git -C %s commit -m "Release %s (PI 1.9.6+)"
   git -C %s tag -a release-%s -m "Release %s (PI 1.9.6+)"
   git push origin main --tags
   git push origin dev""" % (wt, wt, date, wt, date, date))


if __name__ == "__main__":
    main()
