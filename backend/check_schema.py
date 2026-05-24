from sqlalchemy import create_engine, inspect
from core.config import settings

engine = create_engine(settings.database_url)
inspector = inspect(engine)

print("Tables in database:")
tables = inspector.get_table_names()
for table_name in tables:
    print(f"- {table_name}")

for table_name in ["users", "mentors", "notifications", "password_reset_tokens"]:
    if table_name not in tables:
        print(f"\nTable {table_name} does not exist.")
        continue
    print(f"\nTable: {table_name}")
    options = inspector.get_table_options(table_name)
    print(f"  Options: {options}")
    for column in inspector.get_columns(table_name):
        collation = column.get('collation')
        print(f"  Column: {column['name']}, Type: {column['type']}, Collation: {collation}, Nullable: {column['nullable']}")
