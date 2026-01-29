"""
Direct SQL script to add parent_email column - loads .env file
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
import os
from pathlib import Path

# Load .env file
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Get database URL from environment
DB_URL = os.getenv('DATABASE_URL', 'postgresql+asyncpg://postgres:postgres@localhost:5432/education_erp')
print(f"Using database: {DB_URL.split('@')[1] if '@' in DB_URL else 'unknown'}")

async def fix_schema():
    print(f"\nConnecting to database...")
    engine = create_async_engine(DB_URL, echo=False)
    
    async with engine.begin() as conn:
        try:
            print("\n=== Checking current columns ===")
            result = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'students' AND column_name IN ('parent_email', 'father_email', 'mother_email')"
            ))
            existing_columns = [row[0] for row in result.fetchall()]
            print(f"Existing email columns in students table: {existing_columns}")
            
            # Add parent_email if it doesn't exist
            if 'parent_email' not in existing_columns:
                print("\n=== Adding parent_email column ===")
                await conn.execute(text(
                    "ALTER TABLE students ADD COLUMN parent_email VARCHAR(255)"
                ))
                print("✓ Successfully added parent_email column")
            else:
                print("✓ parent_email column already exists")
            
            # Drop old columns if they exist
            if 'father_email' in existing_columns:
                print("\n=== Dropping father_email column ===")
                await conn.execute(text(
                    "ALTER TABLE students DROP COLUMN father_email"
                ))
                print("✓ Successfully dropped father_email column")
            
            if 'mother_email' in existing_columns:
                print("\n=== Dropping mother_email column ===")
                await conn.execute(text(
                    "ALTER TABLE students DROP COLUMN mother_email"
                ))
                print("✓ Successfully dropped mother_email column")
            
            print("\n" + "="*50)
            print("✅ Schema fix completed successfully!")
            print("="*50)
            print("\nNext steps:")
            print("1. Restart your uvicorn server (kill the old process and start a new one)")
            print("2. Refresh your browser")
            print("3. The Student API should now work correctly")
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(fix_schema())
