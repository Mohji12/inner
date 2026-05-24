from sqlalchemy import create_engine, text
from core.config import settings

engine = create_engine(settings.database_url)
with engine.connect() as connection:
    connection.execute(text("DROP TABLE IF EXISTS notifications"))
    connection.execute(text("DROP TABLE IF EXISTS password_reset_tokens"))
    connection.commit()
print("Dropped orphan tables.")
