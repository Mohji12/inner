from db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    r = conn.execute(text("SHOW COLUMNS FROM mentors WHERE Field='id'"))
    print("mentors.id:", r.fetchone())
