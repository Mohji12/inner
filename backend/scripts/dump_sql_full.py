"""Export full MySQL schema + data as a .sql file (CREATE TABLE + INSERT)."""
from __future__ import annotations

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


def sql_literal(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return "'" + value.strftime("%Y-%m-%d %H:%M:%S") + "'"
    if isinstance(value, date):
        return "'" + value.isoformat() + "'"
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        hours, rem = divmod(abs(total), 3600)
        minutes, seconds = divmod(rem, 60)
        sign = "-" if total < 0 else ""
        return f"'{sign}{hours}:{minutes:02d}:{seconds:02d}'"
    if isinstance(value, (bytes, bytearray)):
        return "0x" + value.hex()
    # strings / json-ish
    text = str(value)
    text = (
        text.replace("\\", "\\\\")
        .replace("\0", "\\0")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t")
        .replace("'", "\\'")
    )
    return f"'{text}'"


def main() -> None:
    env = load_env(ENV_PATH)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    sql_path = OUT_DIR / f"therapy_full_{stamp}.sql"

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

    db = env["DB_NAME"]
    with conn.cursor() as cur:
        cur.execute("SHOW TABLES")
        key = f"Tables_in_{db}"
        tables = [row[key] for row in cur.fetchall()]

    lines: list[str] = [
        "-- MySQL dump generated for Mijn Levenspad",
        f"-- Database: `{db}`",
        f"-- Host: {env['DB_HOST']}",
        f"-- Exported at (UTC): {datetime.utcnow().isoformat()}Z",
        f"-- Tables: {len(tables)}",
        "",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "SET UNIQUE_CHECKS = 0;",
        "SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';",
        f"CREATE DATABASE IF NOT EXISTS `{db}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
        f"USE `{db}`;",
        "",
    ]

    total_rows = 0
    for table in tables:
        print(f"Exporting `{table}`…")
        with conn.cursor() as cur:
            cur.execute(f"SHOW CREATE TABLE `{table}`")
            create_row = cur.fetchone()
            create_sql = create_row["Create Table"]

            cur.execute(f"SELECT * FROM `{table}`")
            rows = cur.fetchall()
            columns = list(rows[0].keys()) if rows else []

        lines.append(f"-- ------------------------------------------------------------")
        lines.append(f"-- Table: `{table}`")
        lines.append(f"-- ------------------------------------------------------------")
        lines.append(f"DROP TABLE IF EXISTS `{table}`;")
        lines.append(create_sql + ";")
        lines.append("")

        if not rows:
            lines.append(f"-- `{table}`: 0 rows")
            lines.append("")
            print(f"  0 rows")
            continue

        col_list = ", ".join(f"`{c}`" for c in columns)
        batch_size = 100
        for i in range(0, len(rows), batch_size):
            batch = rows[i : i + batch_size]
            values_sql = []
            for row in batch:
                vals = ", ".join(sql_literal(row[c]) for c in columns)
                values_sql.append(f"({vals})")
            lines.append(f"INSERT INTO `{table}` ({col_list}) VALUES")
            lines.append(",\n".join(values_sql) + ";")
            lines.append("")

        total_rows += len(rows)
        print(f"  {len(rows)} rows")

    lines.append("SET FOREIGN_KEY_CHECKS = 1;")
    lines.append("SET UNIQUE_CHECKS = 1;")
    lines.append("")
    lines.append(f"-- Done. Total data rows inserted: {total_rows}")

    sql_path.write_text("\n".join(lines), encoding="utf-8")
    conn.close()
    print(f"\nWrote {sql_path}")
    print(f"Total rows: {total_rows}")


if __name__ == "__main__":
    main()
