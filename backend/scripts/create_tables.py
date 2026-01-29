"""
Database initialization script.

Creates all tables from SQLAlchemy models.
This is a simpler alternative to running migrations for initial setup.

Usage:
    python -m scripts.create_tables
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from app.config import settings
from app.models.base import Base

# Import all models to register them with Base
from app.models import (
    Tenant, User, Role, Permission, RolePermission, UserRole,
    Module, TenantModule, RoleModuleAccess, RefreshToken,
    Student, FeePayment, FeeStructure, FeeDiscount,
    Staff, CalendarEvent, Attendance,
    Message, Report
)


async def create_tables():
    """Create all database tables."""
    print("🔌 Connecting to database...")
    print(f"   Database URL: {settings.DATABASE_URL}")
    
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True
    )
    
    try:
        async with engine.begin() as conn:
            print("\n📦 Creating tables...")
            await conn.run_sync(Base.metadata.create_all)
            print("\n✅ All tables created successfully!")
            
    except Exception as e:
        print(f"\n❌ Error creating tables: {e}")
        raise
    finally:
        await engine.dispose()


async def drop_tables():
    """Drop all database tables."""
    print("🔌 Connecting to database...")
    
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=True
    )
    
    try:
        async with engine.begin() as conn:
            print("\n🗑️  Dropping tables...")
            await conn.run_sync(Base.metadata.drop_all)
            print("\n✅ All tables dropped successfully!")
            
    except Exception as e:
        print(f"\n❌ Error dropping tables: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database table management")
    parser.add_argument("--drop", action="store_true", help="Drop all tables first")
    args = parser.parse_args()
    
    if args.drop:
        print("⚠️  WARNING: This will drop ALL tables!")
        confirm = input("Type 'yes' to confirm: ")
        if confirm.lower() == 'yes':
            asyncio.run(drop_tables())
        else:
            print("Cancelled.")
            sys.exit(0)
    
    asyncio.run(create_tables())
