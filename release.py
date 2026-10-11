"""Prepare exact GitHub release assets and deterministic source/install ZIPs."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

base = Path(__file__).resolve().parent
out = base / "release"
out.mkdir(exist_ok=True)
for name in ["main.js", "manifest.json", "styles.css"]:
    shutil.copyfile(base / name, out / name)
files = ["package.json", "package-lock.json", "tsconfig.json", "build.mjs", "release.mjs", "release.py", "eslint.config.mjs", "quality/package.json", "quality/eslint.config.mjs", "quality/run-lint.mjs", "README.md", "PRIVACY.md", "LICENSE", "CHANGELOG.md", "manifest.json", "versions.json", "styles.css", "main.js"]
for folder in ["src", "tests", "examples"]:
    files += [p.relative_to(base).as_posix() for p in (base / folder).rglob("*") if p.is_file()]
source_archive = out / "sewlore-measurement-revisions-1.0.1-source.zip"
install_archive = out / "sewlore-measurement-revisions-1.0.1-install.zip"
def write_zip(target, names, prefix=""):
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name in sorted(set(names)):
            info = zipfile.ZipInfo(prefix + name, date_time=(2026, 10, 11, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, (base / name).read_bytes())
write_zip(source_archive, files)
write_zip(install_archive, ["main.js", "manifest.json", "styles.css", "LICENSE", "README.md", "PRIVACY.md"], "sewlore-measurement-revisions/")
artifacts = [source_archive, install_archive, *[out / n for n in ["main.js", "manifest.json", "styles.css"]]]
receipt = {"version": "1.0.1", "nativeAppInstalledTested": False, "mobileTested": False, "externallyPublished": False, "artifacts": [{"path": p.relative_to(base).as_posix(), "bytes": p.stat().st_size, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in artifacts]}
(out / "artifact-hashes.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
print(json.dumps(receipt))
