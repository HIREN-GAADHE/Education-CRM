import psycopg2

DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

with open('pincode_fix_log.txt', 'w') as log:
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cursor = conn.cursor()
        
        log.write("Connected to database\n")
        log.flush()
        
        # Check current length
        cursor.execute("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'pincode';
        """)
        current = cursor.fetchone()
        log.write(f"Current pincode length: {current[0]}\n")
        log.flush()
        
        # Alter column
        cursor.execute("ALTER TABLE students ALTER COLUMN pincode TYPE VARCHAR(20);")
        log.write("Executed ALTER TABLE command\n")
        log.flush()
        
        # Check new length
        cursor.execute("""
            SELECT character_maximum_length 
            FROM information_schema.columns 
            WHERE table_name = 'students' AND column_name = 'pincode';
        """)
        new = cursor.fetchone()
        log.write(f"New pincode length: {new[0]}\n")
        log.flush()
        
        cursor.close()
        conn.close()
        log.write("SUCCESS!\n")
        
    except Exception as e:
        log.write(f"ERROR: {e}\n")
        raise

print("Check pincode_fix_log.txt for results")
