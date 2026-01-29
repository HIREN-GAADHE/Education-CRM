"""
Fix pincode column length from VARCHAR(10) to VARCHAR(20)
"""
import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

def fix_pincode_length():
    """Alter pincode column to allow VARCHAR(20)"""
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Fixing pincode column length...")
    
    try:
        # Alter pincode column in students table
        cursor.execute("""
            ALTER TABLE students 
            ALTER COLUMN pincode TYPE VARCHAR(20);
        """)
        print("✓ Successfully updated pincode column to VARCHAR(20)")
        
    except Exception as e:
        print(f"✗ Error: {e}")
    
    # Verify the change
    try:
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'pincode';
        """)
        
        result = cursor.fetchone()
        if result:
            print(f"✓ Verified: {result[0]} is now {result[1]}({result[2]})")
            
    except Exception as e:
        print(f"✗ Verification error: {e}")
    
    cursor.close()
    conn.close()
    print("\nDone! Column fixed.")


if __name__ == "__main__":
    fix_pincode_length()
