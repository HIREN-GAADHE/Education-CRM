"""
Verify pincode column length
"""
import psycopg2
import sys

DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

def verify_pincode():
    """Check current pincode column definition"""
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT column_name, data_type, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'students' AND column_name = 'pincode';
    """)
    
    result = cursor.fetchone()
    if result:
        col_name, data_type, max_length = result
        print(f"Column: {col_name}")
        print(f"Type: {data_type}")
        print(f"Max Length: {max_length}")
        
        if max_length == 20:
            print("\n✓ SUCCESS: Pincode column is correctly set to VARCHAR(20)")
            sys.exit(0)
        else:
            print(f"\n✗ ISSUE: Pincode column is VARCHAR({max_length}), should be VARCHAR(20)")
            sys.exit(1)
    else:
        print("✗ ERROR: Pincode column not found!")
        sys.exit(1)
    
    cursor.close()
    conn.close()

if __name__ == "__main__":
    verify_pincode()
