"""List mentors; optionally delete those matching test patterns."""
from __future__ import annotations

import argparse
import re
from sqlalchemy import text
from db.session import SessionLocal

TEST_EMAIL_RE = re.compile(
    r"(^|\+|@)(test|demo|example|e2e|qa|dummy|fake|sample)|@(example\.com|test\.com|mailinator\.com|yopmail\.com)",
    re.I,
)
TEST_NAME_RE = re.compile(r"\b(test|demo|dummy|e2e|qa|fake|sample)\b", re.I)


def is_test_mentor(name: str, email: str) -> bool:
    return bool(TEST_EMAIL_RE.search(email or "")) or bool(TEST_NAME_RE.search(name or ""))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delete", action="store_true", help="Delete matching test mentors")
    parser.add_argument("--all-test-patterns", action="store_true", help="Use name/email heuristics")
    parser.add_argument("--email-contains", action="append", default=[], help="Also match emails containing this")
    parser.add_argument("--ids", nargs="*", default=[], help="Explicit mentor IDs to delete")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT id, full_name, email, status, is_approved, created_at
                FROM mentors
                ORDER BY created_at DESC
                """
            )
        ).mappings().all()

        print(f"Total mentors: {len(rows)}")
        print("-" * 120)
        for r in rows:
            flag = "TEST?" if is_test_mentor(r["full_name"], r["email"]) else ""
            print(
                f"{r['created_at']} | {str(r['status']):12} | approved={int(bool(r['is_approved']))} | "
                f"{str(r['email']):45} | {r['full_name']} | {r['id']} {flag}"
            )

        targets = []
        for r in rows:
            if r["id"] in args.ids:
                targets.append(r)
                continue
            if args.all_test_patterns and is_test_mentor(r["full_name"], r["email"]):
                targets.append(r)
                continue
            email = (r["email"] or "").lower()
            if any(s.lower() in email for s in args.email_contains):
                targets.append(r)

        # de-dupe
        seen = set()
        uniq = []
        for r in targets:
            if r["id"] in seen:
                continue
            seen.add(r["id"])
            uniq.append(r)
        targets = uniq

        print()
        print(f"Matched for removal: {len(targets)}")
        for r in targets:
            print(f"  - {r['email']} | {r['full_name']} | {r['id']}")

        if not args.delete:
            print("\nDry run only. Re-run with --delete to remove matched mentors.")
            return

        if not targets:
            print("Nothing to delete.")
            return

        ids = [r["id"] for r in targets]
        # Delete mentors; FK children mostly CASCADE. Promo codes SET NULL.
        for mid in ids:
            db.execute(text("DELETE FROM mentors WHERE id = :id"), {"id": mid})
        db.commit()
        print(f"\nDeleted {len(ids)} mentor(s).")
    finally:
        db.close()


if __name__ == "__main__":
    main()
