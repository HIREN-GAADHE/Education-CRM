"""
Seed script to create test users for each role level.
Run this script to populate the database with test users.

Usage:
    cd backend
    python scripts/seed_test_users.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.config.database import AsyncSessionLocal
from app.models import User, UserStatus, Tenant
from app.models.role import Role, RoleLevel, UserRole
from app.core.security import security


# Test users to create
TEST_USERS = [
    {
        "email": "superadmin@eduerp.com",
        "password": "SuperAdmin@123",
        "first_name": "Super",
        "last_name": "Admin",
        "role_level": RoleLevel.SUPER_ADMIN,
        "role_name": "Super Administrator",
        "is_system_role": True,
    },
    {
        "email": "universityadmin@eduerp.com",
        "password": "UniAdmin@123",
        "first_name": "University",
        "last_name": "Admin",
        "role_level": RoleLevel.UNIVERSITY_ADMIN,
        "role_name": "University Administrator",
        "is_tenant_admin": True,
    },
    {
        "email": "admin@eduerp.com",
        "password": "Admin@123",
        "first_name": "Department",
        "last_name": "Admin",
        "role_level": RoleLevel.ADMIN,
        "role_name": "Administrator",
    },
    {
        "email": "staff@eduerp.com",
        "password": "Staff@123",
        "first_name": "Test",
        "last_name": "Staff",
        "role_level": RoleLevel.STAFF,
        "role_name": "Staff Member",
    },
    {
        "email": "user@eduerp.com",
        "password": "User@123",
        "first_name": "Test",
        "last_name": "User",
        "role_level": RoleLevel.USER,
        "role_name": "User",
    },
]


async def seed_users():
    """Create test users for each role level."""
    async with AsyncSessionLocal() as db:
        try:
            # Get or create default tenant
            result = await db.execute(select(Tenant).limit(1))
            tenant = result.scalar_one_or_none()
            
            if not tenant:
                print("No tenant found! Please create a tenant first.")
                return
            
            print(f"Using tenant: {tenant.name} (ID: {tenant.id})")
            print("-" * 50)
            
            for user_data in TEST_USERS:
                # Check if user already exists
                result = await db.execute(
                    select(User).where(User.email == user_data["email"])
                )
                existing_user = result.scalar_one_or_none()
                
                if existing_user:
                    print(f"✓ User already exists: {user_data['email']}")
                    continue
                
                # Create user
                user = User(
                    tenant_id=tenant.id,
                    email=user_data["email"],
                    password_hash=security.hash_password(user_data["password"]),
                    first_name=user_data["first_name"],
                    last_name=user_data["last_name"],
                    status=UserStatus.ACTIVE,
                    email_verified=True,
                )
                db.add(user)
                await db.flush()  # Get user ID
                
                # Create or get role
                role_name_key = user_data["role_name"].lower().replace(" ", "_")
                result = await db.execute(
                    select(Role).where(
                        Role.name == role_name_key,
                        Role.tenant_id == tenant.id
                    )
                )
                role = result.scalar_one_or_none()
                
                if not role:
                    role = Role(
                        tenant_id=tenant.id,
                        name=user_data["role_name"].lower().replace(" ", "_"),
                        display_name=user_data["role_name"],
                        description=f"Test role for {user_data['role_name']}",
                        level=user_data["role_level"].value,
                        is_system_role=user_data.get("is_system_role", False),
                        is_tenant_admin=user_data.get("is_tenant_admin", False),
                        is_active=True,
                    )
                    db.add(role)
                    await db.flush()
                
                # Assign role to user
                user_role = UserRole(
                    user_id=user.id,
                    role_id=role.id,
                    assigned_by=user.id,  # Self-assigned for seed
                    is_primary=True,
                )
                db.add(user_role)
                
                print(f"✓ Created: {user_data['email']} (Role: {user_data['role_name']}, Level: {user_data['role_level'].value})")
            
            await db.commit()
            print("-" * 50)
            print("✓ All test users created successfully!")
            print("\nSee users.txt for login credentials.")
            
        except Exception as e:
            print(f"Error: {e}")
            await db.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(seed_users())
