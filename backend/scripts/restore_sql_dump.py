"""One-off restore of a full .sql dump into MySQL via PyMySQL."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pymysql
from pymysql.constants import CLIENT


def split_sql(sql: str) -> list[str]:
    """Split dump into statements, respecting simple quoted strings."""
    stmts: list[str] = []
    buf: list[str] = []
    i = 0
    n = len(sql)
    in_single = False
    in_double = False
    in_backtick = False
    in_line_comment = False
    in_block_comment = False

    while i < n:
        ch = sql[i]
        nxt = sql[i + 1] if i + 1 < n else ""

        if in_line_comment:
            buf.append(ch)
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            buf.append(ch)
            if ch == "*" and nxt == "/":
                buf.append(nxt)
                in_block_comment = False
                i += 2
                continue
            i += 1
            continue

        if not in_single and not in_double and not in_backtick:
            if ch == "-" and nxt == "-":
                in_line_comment = True
                buf.append(ch)
                i += 1
                continue
            if ch == "/" and nxt == "*":
                in_block_comment = True
                buf.append(ch)
                i += 1
                continue
            if ch == "#":
                in_line_comment = True
                buf.append(ch)
                i += 1
                continue

        if ch == "'" and not in_double and not in_backtick:
            # handle escaped '' or \'
            if in_single and nxt == "'":
                buf.append(ch)
                buf.append(nxt)
                i += 2
                continue
            in_single = not in_single
            buf.append(ch)
            i += 1
            continue

        if ch == '"' and not in_single and not in_backtick:
            in_double = not in_double
            buf.append(ch)
            i += 1
            continue

        if ch == "`" and not in_single and not in_double:
            in_backtick = not in_backtick
            buf.append(ch)
            i += 1
            continue

        if ch == "\\" and in_single:
            buf.append(ch)
            if i + 1 < n:
                buf.append(sql[i + 1])
                i += 2
                continue

        if ch == ";" and not in_single and not in_double and not in_backtick:
            stmt = "".join(buf).strip()
            if stmt:
                stmts.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        stmts.append(tail)
    return stmts


def is_executable(stmt: str) -> bool:
    cleaned = re.sub(r"(?s)/\*.*?\*/", "", stmt)
    cleaned = re.sub(r"(?m)^\s*--.*?$", "", cleaned)
    cleaned = re.sub(r"(?m)^\s*#.*?$", "", cleaned).strip()
    return bool(cleaned)


def main() -> int:
    parser = argparse.ArgumentParser(description="Restore MySQL dump")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, default=3306)
    parser.add_argument("--user", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--file", required=True, type=Path)
    args = parser.parse_args()

    sql_text = args.file.read_text(encoding="utf-8")
    statements = [s for s in split_sql(sql_text) if is_executable(s)]
    print(f"Loaded {args.file.name}: {len(statements)} statements")

    conn = pymysql.connect(
        host=args.host,
        port=args.port,
        user=args.user,
        password=args.password,
        charset="utf8mb4",
        connect_timeout=30,
        read_timeout=600,
        write_timeout=600,
        autocommit=True,
        client_flag=CLIENT.MULTI_STATEMENTS,
    )

    ok = 0
    try:
        with conn.cursor() as cur:
            for idx, stmt in enumerate(statements, 1):
                preview = " ".join(stmt.split())[:120]
                try:
                    cur.execute(stmt)
                    # drain multi-result sets if any
                    while cur.nextset():
                        pass
                    ok += 1
                    if idx % 25 == 0 or idx == len(statements):
                        print(f"  [{idx}/{len(statements)}] ok")
                except Exception as exc:  # noqa: BLE001
                    print(f"FAILED at statement {idx}: {preview}")
                    print(f"  error: {exc}")
                    return 1

        with conn.cursor() as cur:
            cur.execute(f"USE `{args.database}`")
            cur.execute("SHOW TABLES")
            tables = [r[0] for r in cur.fetchall()]
            print(f"Restore complete. Tables in `{args.database}`: {len(tables)}")
            cur.execute("SELECT version_num FROM alembic_version")
            print("Alembic version:", cur.fetchone())
    finally:
        conn.close()

    print(f"Executed {ok}/{len(statements)} statements successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
