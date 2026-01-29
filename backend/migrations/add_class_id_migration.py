"""
Migration script to add class_id column to timetable_entries table.
Run this script to update the database schema.
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def run_migration():
    """Apply the migration to add class_id column."""
    
    # Get database connection details from environment
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost/eduerp")
    
    print("Connecting to database...")
    
    # Parse connection string
    if db_url.startswith("postgresql://"):
        # Extract components
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):?(\d+)?/(.+)', db_url)
        if match:
            user, password, host, port, database = match.groups()
            port = port or "5432"
        else:
            print("Error: Could not parse DATABASE_URL")
            return
    else:
        # Default values
        user = "postgres"
        password = "postgres"
        host = "localhost"
        port = "5432"
        database = "eduerp"
    
    try:
        # Connect to database
        conn = await asyncpg.connect(
            user=user,
            password=password,
            database=database,
            host=host,
            port=port
        )
        
        print("Connected successfully!")
        print("\n🔄 Applying migration: Add class_id to timetable_entries...")
        
        # Check if column already exists
        check_query = """
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'timetable_entries' 
        AND column_name = 'class_id';
        """
        
        existing = await conn.fetchval(check_query)
        
        if existing:
            print("✅ Column 'class_id' already exists. Migration not needed.")
        else:
            # Add the column
            await conn.execute("""
                ALTER TABLE timetable_entries 
                ADD COLUMN class_id UUID REFERENCES school_classes(id);
            """)
            print("✅ Added class_id column")
            
            # Create index
            await conn.execute("""
                CREATE INDEX idx_timetable_entries_class_id 
                ON timetable_entries(class_id);
            """)
            print("✅ Created index on class_id")
            
            print("\n🎉 Migration completed successfully!")
        
        await conn.close()
        print("\n✅ Database connection closed")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print(f"\nPlease run this SQL manually in your database:")
        print("=" * 60)
        print("ALTER TABLE timetable_entries ADD COLUMN class_id UUID REFERENCES school_classes(id);")
        print("CREATE INDEX idx_timetable_entries_class_id ON timetable_entries(class_id);")
        print("=" * 60)

if __name__ == "__main__":
    print("=" * 60)
    print("Timetable Migration - Add class_id column")
    print("=" * 60)
    asyncio.run(run_migration())
