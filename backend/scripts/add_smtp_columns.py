"""
Script to add SMTP configuration columns to tenant_settings table
Run this with: python scripts/add_smtp_columns.py
"""
import psycopg2
from psycopg2 import sql

import os

# Database connection (sync driver)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:admin@localhost:5432/eduerp")

def add_smtp_columns():
    # Fix for asyncpg connection string which psycopg2 doesn't understand
    db_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    
    print("Adding SMTP columns to tenant_settings table...")
    
    columns = [
        ("smtp_host", "VARCHAR(255)"),
        ("smtp_port", "INTEGER"),
        ("smtp_username", "VARCHAR(255)"),
        ("smtp_password", "VARCHAR(255)"),
        ("smtp_from_email", "VARCHAR(255)"),
        ("smtp_from_name", "VARCHAR(255)"),
        ("smtp_security", "VARCHAR(10) DEFAULT 'tls'"),
    ]
    
    for col_name, col_type in columns:
        try:
            query = sql.SQL("ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS {} {}").format(
                sql.Identifier(col_name),
                sql.SQL(col_type)
            )
            cursor.execute(query)
            print(f"✓ Added {col_name}")
        except Exception as e:
            print(f"Failed to add {col_name}: {e}")
    
    cursor.close()
    conn.close()
    print("\nDone! Please restart uvicorn.")

if __name__ == "__main__":
    add_smtp_columns()
