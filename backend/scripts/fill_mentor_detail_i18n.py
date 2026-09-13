"""One-shot: DeepL-fill missing mentorDetail.* UI keys into deeplGeneratedOverrides.ts."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from services.deepl_service import deepl_configured, translate_text  # noqa: E402

EXTRACT = BACKEND / "scripts" / "_extract_ts_strings.mjs"
APP_BASE = ROOT / "src" / "i18n" / "appBase.ts"
APP_OVERRIDES = ROOT / "src" / "i18n" / "appOverrides.ts"
GENERATED = ROOT / "src" / "i18n" / "deeplGeneratedOverrides.ts"
LANGS = ["nl", "fr", "de", "es", "it", "ar", "zh", "ru", "ro"]

# Optional: python fill_mentor_detail_i18n.py nl,fr
if len(sys.argv) > 1:
    LANGS = [x.strip().lower() for x in sys.argv[1].split(",") if x.strip()]


def run_extract(path: Path, name: str) -> dict[str, str]:
    proc = subprocess.run(
        ["node", str(EXTRACT), str(path), name],
        capture_output=True,
        cwd=str(ROOT),
        check=False,
    )
    stdout = (proc.stdout or b"").decode("utf-8", errors="replace")
    stderr = (proc.stderr or b"").decode("utf-8", errors="replace")
    if proc.returncode != 0:
        raise SystemExit(stderr or stdout or "extract failed")
    data = json.loads(stdout or "{}")
    return {str(k): str(v) for k, v in data.items() if isinstance(v, str)}


def extract_locale_block(file_path: Path, lang: str) -> dict[str, str]:
    if not file_path.exists():
        return {}
    source = file_path.read_text(encoding="utf-8")
    match = re.search(rf"(?m)^  {re.escape(lang)}: \{{", source)
    if not match:
        return {}
    start = match.end() - 1
    depth = 0
    end = None
    for i in range(start, len(source)):
        ch = source[i]
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end is None:
        return {}
    block = source[start:end]
    tmp = BACKEND / "scripts" / f"_tmp_md_{lang}.ts"
    tmp.write_text(f"export const _tmp = {block};\n", encoding="utf-8")
    try:
        return run_extract(tmp, "_tmp")
    finally:
        tmp.unlink(missing_ok=True)


def unflatten(flat: dict[str, str]) -> dict:
    root: dict = {}
    for path, value in sorted(flat.items()):
        parts = path.split(".")
        cur = root
        for part in parts[:-1]:
            cur = cur.setdefault(part, {})
        cur[parts[-1]] = value
    return root


def ts_string(value: str) -> str:
    if '"' not in value and "\n" not in value:
        return json.dumps(value, ensure_ascii=False)
    escaped = value.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    return f"`{escaped}`"


def emit_object(obj: dict, indent: int = 2) -> str:
    pad = " " * indent
    lines = ["{"]
    items = list(obj.items())
    for i, (key, value) in enumerate(items):
        comma = "," if i < len(items) - 1 else ""
        if isinstance(value, dict):
            nested = emit_object(value, indent + 2)
            lines.append(f"{pad}{key}: {nested}{comma}")
        else:
            lines.append(f"{pad}{key}: {ts_string(str(value))}{comma}")
    lines.append((" " * (indent - 2)) + "}")
    return "\n".join(lines)


def main() -> None:
    if not deepl_configured():
        raise SystemExit("DEEPL_AUTH_KEY not set")

    en_all = run_extract(APP_BASE, "appEn")
    en = {k: v for k, v in en_all.items() if k.startswith("mentorDetail.")}
    print(f"EN mentorDetail keys: {len(en)}")

    by_lang: dict[str, dict[str, str]] = {}
    for lang in LANGS:
        hand = {
            k: v
            for k, v in extract_locale_block(APP_OVERRIDES, lang).items()
            if k.startswith("mentorDetail.")
        }
        prior_all = extract_locale_block(GENERATED, lang)
        prior_md = {k: v for k, v in prior_all.items() if k.startswith("mentorDetail.")}
        covered = dict(prior_md)
        covered.update(hand)
        missing = [k for k in en if k not in covered or not (covered.get(k) or "").strip()]
        print(f"{lang}: missing {len(missing)} / {len(en)}")
        filled = dict(prior_md)
        for key in missing:
            src = en[key]
            try:
                filled[key] = translate_text(src, lang, source_lang="en")
                print(f"  {lang} {key.split('.', 1)[1]} OK")
            except Exception as exc:  # noqa: BLE001
                print(f"  {lang} {key} FAIL: {exc}")
        merged = {k: v for k, v in prior_all.items() if not k.startswith("mentorDetail.")}
        merged.update(filled)
        by_lang[lang] = merged

    chunks = [
        "/**",
        " * Auto-generated DeepL fills for missing app UI strings.",
        " * Generated for mentorDetail via DeepL — review before commit.",
        " * Merged in appOverrides via withLocaleExtras (does not replace hand-written copy).",
        " */",
        'import type { AppCopy } from "./appBase";',
        'import type { Language } from "./translations";',
        'import type { DeepPartial } from "./mergeDeep";',
        "",
        "export const deeplGeneratedOverrides: Partial<Record<Language, DeepPartial<AppCopy>>> = {",
    ]
    for lang in sorted(by_lang.keys()):
        if not by_lang[lang]:
            continue
        tree = unflatten(by_lang[lang])
        body = emit_object(tree, 4)
        chunks.append(f"  {lang}: {body},")
    chunks.append("};")
    chunks.append("")
    GENERATED.write_text("\n".join(chunks), encoding="utf-8")
    print(f"Wrote {GENERATED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
