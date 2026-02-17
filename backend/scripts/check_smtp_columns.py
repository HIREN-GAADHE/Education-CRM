import psycopg2
from psycopg2 import sql
import sys

# Database connection (sync driver)
DATABASE_URL = "postgresql://postgres:admin@localhost:5432/eduerp"

def check_columns():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tenant_settings';
        """)
        
        columns = [row[0] for row in cursor.fetchall()]
        
        required = ["smtp_host", "smtp_port", "smtp_username", "smtp_password", "smtp_from_email", "smtp_from_name", "smtp_security"]
        missing = [col for col in required if col not in columns]
        
        with open("check_result.txt", "w", encoding="utf-8") as f:
            if missing:
                f.write(f"Missing columns: {missing}\n")
                print(f"Missing columns: {missing}")
            else:
                f.write("SUCCESS: All SMTP columns present!\n")
                print("SUCCESS: All SMTP columns present!")

        cursor.close()
        conn.close()
    except Exception as e:
        with open("check_result.txt", "w", encoding="utf-8") as f:
             f.write(f"ERROR: {str(e)}\n")
        print(f"ERROR: {str(e)}")

if __name__ == "__main__":
    check_columns()
