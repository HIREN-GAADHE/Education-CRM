import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

with open('fix_all_varchar_log.txt', 'w') as log:
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        log.write("Connected to database\n")
        
        # Check all VARCHAR(10) columns in students table
        cursor.execute("""
            SELECT column_name, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'students' 
            AND data_type = 'character varying'
            AND character_maximum_length = 10;
        """)
        
        cols = cursor.fetchall()
        log.write(f"Found {len(cols)} columns with VARCHAR(10):\n")
        for col in cols:
            log.write(f"  - {col[0]}: VARCHAR({col[1]})\n")
        
        # Fix blood_group column
        log.write("\nFixing blood_group column...\n")
        cursor.execute("ALTER TABLE students ALTER COLUMN blood_group TYPE VARCHAR(20);")
        log.write("✓ blood_group fixed to VARCHAR(20)\n")
        
        # Verify
        cursor.execute("""
            SELECT column_name, character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'students' 
            AND data_type = 'character varying'
            AND character_maximum_length = 10;
        """)
        
        remaining = cursor.fetchall()
        log.write(f"\nRemaining VARCHAR(10) columns: {len(remaining)}\n")
        for col in remaining:
            log.write(f"  - {col[0]}: VARCHAR({col[1]})\n")
        
        cursor.close()
        conn.close()
        log.write("\nSUCCESS!\n")
        
    except Exception as e:
        log.write(f"ERROR: {e}\n")
        raise

print("Check fix_all_varchar_log.txt for results")
