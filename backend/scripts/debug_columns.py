import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
import sys

# Add backend to sys path
sys.path.append(os.path.join(os.getcwd()))

from app.core.config import settings

async def inspect_db():
    engine = create_async_engine(settings.SQLALCHEMY_DATABASE_URI)
    async with engine.connect() as conn:
        print("Checking 'students' table columns...")
        result = await conn.execute(text(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'students'"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"- {row[0]}: {row[1]}")

        print("\nChecking alembic_version...")
        result_ver = await conn.execute(text("SELECT * FROM alembic_version"))
        print(f"Current Revision: {result_ver.fetchall()}")

if __name__ == "__main__":
    asyncio.run(inspect_db())
