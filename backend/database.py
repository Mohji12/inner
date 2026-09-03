"""Backward compatibility — prefer `from db.session import ...` in new code."""

from db.session import Base, SessionLocal, engine, get_db

__all__ = ["Base", "SessionLocal", "engine", "get_db"]
