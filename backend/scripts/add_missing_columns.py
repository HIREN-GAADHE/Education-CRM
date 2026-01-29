"""
Script to add missing database columns
Run this with: python scripts/add_missing_columns.py
"""
import psycopg2
from psycopg2 import sql

# Database connection (sync driver)
DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

def add_missing_columns():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Adding missing columns to database...")
    
    # 1. Add class_id to students table
    try:
        cursor.execute("""
            ALTER TABLE students 
            ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES school_classes(id);
        """)
        print("✓ Added class_id to students table")
    except Exception as e:
        print(f"class_id: {e}")
    
    # 2. Create index on class_id
    try:
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS ix_students_class_id ON students(class_id);
        """)
        print("✓ Created index on students.class_id")
    except Exception as e:
        print(f"index: {e}")
    
    # 3. Add soft delete columns to messages table
    try:
        cursor.execute("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
        """)
        print("✓ Added is_deleted to messages table")
    except Exception as e:
        print(f"is_deleted: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
        """)
        print("✓ Added deleted_at to messages table")
    except Exception as e:
        print(f"deleted_at: {e}")
    
    try:
        cursor.execute("""
            ALTER TABLE messages 
            ADD COLUMN IF NOT EXISTS deleted_by UUID;
        """)
        print("✓ Added deleted_by to messages table")
    except Exception as e:
        print(f"deleted_by: {e}")
    
    cursor.close()
    conn.close()
    print("\nDone! Please restart uvicorn.")

if __name__ == "__main__":
    add_missing_columns()
