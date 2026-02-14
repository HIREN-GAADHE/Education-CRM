import psycopg2

conn = psycopg2.connect("postgresql://postgres:admin@localhost:5432/eduerp")
cur = conn.cursor()

cur.execute("SELECT academic_year, COUNT(*) FROM fee_payments WHERE is_deleted = false GROUP BY academic_year")
print("Fee counts by academic_year:")
for row in cur.fetchall():
    print(f"  '{row[0]}': {row[1]}")

# Check if the JOIN with students filters anything out
cur.execute("""
    SELECT COUNT(*) 
    FROM fee_payments fp 
    JOIN students s ON fp.student_id = s.id 
    WHERE fp.is_deleted = false AND s.is_deleted = false
""")
print(f"\nFees after JOIN with non-deleted students: {cur.fetchone()[0]}")

cur.execute("""
    SELECT COUNT(*) 
    FROM fee_payments fp 
    WHERE fp.is_deleted = false 
    AND fp.student_id NOT IN (SELECT id FROM students WHERE is_deleted = false)
""")
print(f"Orphaned fees (student deleted or missing): {cur.fetchone()[0]}")

cur.close()
conn.close()
