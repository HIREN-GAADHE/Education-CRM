"""
Script to add is_passed and rank columns to exam_results table.
Run with: python migrations/add_is_passed_rank_migration.py
"""
import asyncio
import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

load_dotenv()

async def run_migration():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not found in environment")
        return
    
    # Ensure we're using asyncpg
    if database_url.startswith("postgresql://"):
        database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(database_url, echo=True)
    
    async with engine.begin() as conn:
        # Add is_passed column if it doesn't exist
        try:
            await conn.execute(text("""
                ALTER TABLE exam_results 
                ADD COLUMN IF NOT EXISTS is_passed BOOLEAN DEFAULT NULL
            """))
            print("Added is_passed column")
        except Exception as e:
            print(f"is_passed column may already exist or error: {e}")
        
        # Add rank column if it doesn't exist
        try:
            await conn.execute(text("""
                ALTER TABLE exam_results 
                ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT NULL
            """))
            print("Added rank column")
        except Exception as e:
            print(f"rank column may already exist or error: {e}")
    
    await engine.dispose()
    print("Migration completed!")

if __name__ == "__main__":
    asyncio.run(run_migration())
