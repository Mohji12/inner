"""Export all tables from the configured MySQL database to JSON + summary."""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pymysql

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
OUT_DIR = ROOT / "dumps"


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip('"').strip("'")
    return env


def serialize(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, timedelta):
        return str(obj)
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, bytes):
        return obj.hex()
    return obj


def main() -> None:
    env = load_env(ENV_PATH)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    json_path = OUT_DIR / f"therapy_full_{stamp}.json"
    summary_path = OUT_DIR / f"therapy_summary_{stamp}.txt"

    conn = pymysql.connect(
        host=env["DB_HOST"],
        port=int(env.get("DB_PORT", 3306)),
        user=env["DB_USER"],
        password=env["DB_PASSWORD"],
        database=env["DB_NAME"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=30,
        read_timeout=600,
    )

    with conn.cursor() as cur:
        cur.execute("SHOW TABLES")
        key = f"Tables_in_{env['DB_NAME']}"
        tables = [row[key] for row in cur.fetchall()]

    dump = {
        "_meta": {
            "database": env["DB_NAME"],
            "host": env["DB_HOST"],
            "exported_at_utc": datetime.utcnow().isoformat() + "Z",
            "table_count": len(tables),
        },
        "tables": {},
    }
    lines = [f"Database: {env['DB_NAME']}", f"Tables: {len(tables)}", ""]
    total_rows = 0

    for table in tables:
        with conn.cursor() as cur:
            cur.execute(f"SELECT COUNT(*) AS c FROM `{table}`")
            count = int(cur.fetchone()["c"])
            cur.execute(f"SELECT * FROM `{table}`")
            rows = cur.fetchall()
        clean = [{k: serialize(v) for k, v in row.items()} for row in rows]
        dump["tables"][table] = {"row_count": count, "rows": clean}
        total_rows += count
        lines.append(f"{table}: {count} rows")
        print(f"{table}: {count} rows")

    dump["_meta"]["total_rows"] = total_rows
    lines.extend(["", f"Total rows: {total_rows}"])

    json_path.write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding="utf-8")
    summary_path.write_text("\n".join(lines), encoding="utf-8")
    conn.close()

    print(f"\nWrote {json_path}")
    print(f"Wrote {summary_path}")
    print(f"Total rows: {total_rows}")


if __name__ == "__main__":
    main()
