"""
Database Seeder Script

This script populates the database with initial data including:
- Default tenant (for super admin)
- Super admin user
- System roles and permissions
- Core modules

Usage:
    python -m scripts.seed
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
import uuid

from app.config.database import AsyncSessionLocal, init_db
from app.core.security import security
from app.models import (
    Tenant, TenantStatus,
    User, UserStatus,
    Role, RoleLevel, Permission, RolePermission, UserRole,
    Module, ModuleCategory, TenantModule
)


# ============= CONFIGURATION =============

DEFAULT_ADMIN_EMAIL = "admin@gmail.com"
DEFAULT_ADMIN_PASSWORD = "admin123"  # Must be 8+ characters
DEFAULT_TENANT_NAME = "System"
DEFAULT_TENANT_SLUG = "system"


# ============= SEED DATA =============

SYSTEM_PERMISSIONS = [
    # User Management
    {"code": "users:create", "resource": "users", "action": "create", "display_name": "Create Users", "category": "User Management"},
    {"code": "users:read", "resource": "users", "action": "read", "display_name": "View Users", "category": "User Management"},
    {"code": "users:update", "resource": "users", "action": "update", "display_name": "Edit Users", "category": "User Management"},
    {"code": "users:delete", "resource": "users", "action": "delete", "display_name": "Delete Users", "category": "User Management"},
    
    # Role Management
    {"code": "roles:create", "resource": "roles", "action": "create", "display_name": "Create Roles", "category": "Access Control"},
    {"code": "roles:read", "resource": "roles", "action": "read", "display_name": "View Roles", "category": "Access Control"},
    {"code": "roles:update", "resource": "roles", "action": "update", "display_name": "Edit Roles", "category": "Access Control"},
    {"code": "roles:delete", "resource": "roles", "action": "delete", "display_name": "Delete Roles", "category": "Access Control"},
    {"code": "roles:assign", "resource": "roles", "action": "assign", "display_name": "Assign Roles", "category": "Access Control"},
    
    # Tenant Management
    {"code": "tenants:create", "resource": "tenants", "action": "create", "display_name": "Create Tenants", "category": "System"},
    {"code": "tenants:read", "resource": "tenants", "action": "read", "display_name": "View Tenants", "category": "System"},
    {"code": "tenants:update", "resource": "tenants", "action": "update", "display_name": "Edit Tenants", "category": "System"},
    {"code": "tenants:delete", "resource": "tenants", "action": "delete", "display_name": "Delete Tenants", "category": "System"},
    
    # Module Management
    {"code": "modules:read", "resource": "modules", "action": "read", "display_name": "View Modules", "category": "System"},
    {"code": "modules:manage", "resource": "modules", "action": "manage", "display_name": "Manage Modules", "category": "System"},
    
    # Student Management
    {"code": "students:create", "resource": "students", "action": "create", "display_name": "Create Students", "category": "Academic"},
    {"code": "students:read", "resource": "students", "action": "read", "display_name": "View Students", "category": "Academic"},
    {"code": "students:update", "resource": "students", "action": "update", "display_name": "Edit Students", "category": "Academic"},
    {"code": "students:delete", "resource": "students", "action": "delete", "display_name": "Delete Students", "category": "Academic"},
    
    # Course Management
    {"code": "courses:create", "resource": "courses", "action": "create", "display_name": "Create Courses", "category": "Academic"},
    {"code": "courses:read", "resource": "courses", "action": "read", "display_name": "View Courses", "category": "Academic"},
    {"code": "courses:update", "resource": "courses", "action": "update", "display_name": "Edit Courses", "category": "Academic"},
    {"code": "courses:delete", "resource": "courses", "action": "delete", "display_name": "Delete Courses", "category": "Academic"},
    
    # Attendance
    {"code": "attendance:read", "resource": "attendance", "action": "read", "display_name": "View Attendance", "category": "Academic"},
    {"code": "attendance:manage", "resource": "attendance", "action": "manage", "display_name": "Manage Attendance", "category": "Academic"},
    
    # Finance
    {"code": "fees:read", "resource": "fees", "action": "read", "display_name": "View Fees", "category": "Finance"},
    {"code": "fees:manage", "resource": "fees", "action": "manage", "display_name": "Manage Fees", "category": "Finance"},
    
    # Reports
    {"code": "reports:read", "resource": "reports", "action": "read", "display_name": "View Reports", "category": "Analytics"},
    {"code": "reports:export", "resource": "reports", "action": "export", "display_name": "Export Reports", "category": "Analytics"},
]

SYSTEM_ROLES = [
    {
        "name": "SUPER_ADMIN",
        "display_name": "Super Admin",
        "description": "Platform owner with full access to all tenants",
        "level": RoleLevel.SUPER_ADMIN.value,
        "is_system_role": True,
        "is_tenant_admin": True,
        "icon": "admin_panel_settings",
        "color": "#d32f2f"
    },
    {
        "name": "UNIVERSITY_ADMIN",
        "display_name": "University Admin",
        "description": "Institution owner with full access within their tenant",
        "level": RoleLevel.UNIVERSITY_ADMIN.value,
        "is_system_role": True,
        "is_tenant_admin": True,
        "icon": "school",
        "color": "#1976d2"
    },
    {
        "name": "ADMIN",
        "display_name": "Admin",
        "description": "Department or branch administrator",
        "level": RoleLevel.ADMIN.value,
        "is_system_role": True,
        "is_tenant_admin": False,
        "icon": "manage_accounts",
        "color": "#9c27b0"
    },
    {
        "name": "STAFF",
        "display_name": "Staff",
        "description": "Teachers, accountants, librarians, etc.",
        "level": RoleLevel.STAFF.value,
        "is_system_role": True,
        "is_tenant_admin": False,
        "icon": "badge",
        "color": "#2e7d32"
    },
    {
        "name": "USER",
        "display_name": "User",
        "description": "Students, parents, guests",
        "level": RoleLevel.USER.value,
        "is_system_role": True,
        "is_tenant_admin": False,
        "is_default": True,
        "icon": "person",
        "color": "#757575"
    }
]

CORE_MODULES = [
    {
        "code": "CORE",
        "name": "Core System",
        "description": "Core system functionality including authentication and settings",
        "category": ModuleCategory.CORE,
        "is_core": True,
        "icon": "settings",
        "color": "#1976d2",
        "menu_order": 1
    },
    {
        "code": "USER_MGMT",
        "name": "User Management",
        "description": "Manage users, roles, and permissions",
        "category": ModuleCategory.CORE,
        "is_core": True,
        "icon": "people",
        "color": "#9c27b0",
        "menu_order": 2
    },
    {
        "code": "STUDENT_MGMT",
        "name": "Student Management",
        "description": "Manage student records, admissions, and profiles",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "school",
        "color": "#2e7d32",
        "menu_order": 10
    },
    {
        "code": "COURSE_MGMT",
        "name": "Course Management",
        "description": "Manage courses, subjects, and curriculum",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "menu_book",
        "color": "#ed6c02",
        "menu_order": 11
    },
    {
        "code": "ATTENDANCE",
        "name": "Attendance",
        "description": "Track and manage student and staff attendance",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "event_note",
        "color": "#0288d1",
        "menu_order": 12
    },
    {
        "code": "TIMETABLE",
        "name": "Timetable",
        "description": "Manage class schedules, time slots, and room allocation",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "schedule",
        "color": "#00897b",
        "menu_order": 13
    },
    {
        "code": "EXAMINATION",
        "name": "Examinations",
        "description": "Manage exams, grades, and results",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "quiz",
        "color": "#7b1fa2",
        "menu_order": 14
    },
    {
        "code": "CERTIFICATES",
        "name": "Certificates",
        "description": "Generate and manage student certificates",
        "category": ModuleCategory.ACADEMIC,
        "is_core": False,
        "icon": "card_membership",
        "color": "#5d4037",
        "menu_order": 15
    },
    {
        "code": "FINANCE",
        "name": "Finance & Fees",
        "description": "Fee management, payments, and financial reports",
        "category": ModuleCategory.FINANCE,
        "is_core": False,
        "is_premium": True,
        "icon": "payments",
        "color": "#388e3c",
        "menu_order": 20
    },
    {
        "code": "ONLINE_PAYMENTS",
        "name": "Online Payments",
        "description": "Razorpay, Stripe, and other payment gateway integrations",
        "category": ModuleCategory.FINANCE,
        "is_core": False,
        "is_premium": True,
        "icon": "credit_card",
        "color": "#1565c0",
        "menu_order": 21
    },
    {
        "code": "HR",
        "name": "Human Resources",
        "description": "Staff management, payroll, and HR operations",
        "category": ModuleCategory.HR,
        "is_core": False,
        "is_premium": True,
        "icon": "business",
        "color": "#f57c00",
        "menu_order": 30
    },
    {
        "code": "NOTIFICATIONS",
        "name": "Notifications",
        "description": "Email, SMS, and push notifications",
        "category": ModuleCategory.COMMUNICATION,
        "is_core": False,
        "icon": "notifications",
        "color": "#e91e63",
        "menu_order": 35
    },
    {
        "code": "IMPORT_EXPORT",
        "name": "Import/Export",
        "description": "Bulk import and export of data",
        "category": ModuleCategory.CORE,
        "is_core": False,
        "icon": "import_export",
        "color": "#607d8b",
        "menu_order": 36
    },
    {
        "code": "ANALYTICS",
        "name": "Analytics & Reports",
        "description": "Comprehensive reports and data analytics",
        "category": ModuleCategory.ANALYTICS,
        "is_core": False,
        "icon": "assessment",
        "color": "#c2185b",
        "menu_order": 40
    }
]


async def seed_database():
    """Main seeding function."""
    print("🌱 Starting database seeding...")
    
    async with AsyncSessionLocal() as db:
        try:
            # Check if already seeded
            result = await db.execute(select(Tenant).where(Tenant.slug == DEFAULT_TENANT_SLUG))
            if result.scalar_one_or_none():
                print("⚠️  Database already seeded. Skipping...")
                return
            
            # 1. Create system tenant
            print("📦 Creating system tenant...")
            tenant = Tenant(
                name=DEFAULT_TENANT_NAME,
                slug=DEFAULT_TENANT_SLUG,
                email=DEFAULT_ADMIN_EMAIL,
                status=TenantStatus.ACTIVE,
                max_users=9999,
                max_students=99999
            )
            db.add(tenant)
            await db.flush()
            tenant_id = tenant.id
            print(f"   ✅ Tenant created: {tenant.name} (ID: {tenant.id})")
            
            # 2. Create permissions
            print("🔐 Creating permissions...")
            permission_ids = {}
            for perm_data in SYSTEM_PERMISSIONS:
                perm = Permission(**perm_data, is_system=True)
                db.add(perm)
                await db.flush()
                permission_ids[perm.code] = perm.id
            print(f"   ✅ Created {len(SYSTEM_PERMISSIONS)} permissions")
            
            # 3. Create modules
            print("📦 Creating modules...")
            module_ids = {}
            for mod_data in CORE_MODULES:
                module = Module(**mod_data)
                db.add(module)
                await db.flush()
                module_ids[module.code] = module.id
            print(f"   ✅ Created {len(CORE_MODULES)} modules")
            
            # 4. Enable core modules for system tenant
            print("🔗 Enabling modules for system tenant...")
            for code, mod_id in module_ids.items():
                tm = TenantModule(
                    tenant_id=tenant_id,
                    module_id=mod_id,
                    is_enabled=True,
                    enabled_at=datetime.utcnow()
                )
                db.add(tm)
            print(f"   ✅ Enabled all modules")
            
            # 5. Create roles
            print("👥 Creating roles...")
            role_ids = {}
            for role_data in SYSTEM_ROLES:
                role = Role(tenant_id=tenant_id, **role_data)
                db.add(role)
                await db.flush()
                role_ids[role.name] = role.id
            print(f"   ✅ Created {len(SYSTEM_ROLES)} roles")
            
            # 6. Assign all permissions to Super Admin role
            print("🔗 Assigning permissions to Super Admin...")
            for perm_code, perm_id in permission_ids.items():
                rp = RolePermission(
                    role_id=role_ids["SUPER_ADMIN"],
                    permission_id=perm_id,
                    granted=True
                )
                db.add(rp)
            print(f"   ✅ Assigned all permissions to Super Admin")
            
            # 7. Create admin user
            print("👤 Creating admin user...")
            admin_user = User(
                tenant_id=tenant_id,
                email=DEFAULT_ADMIN_EMAIL,
                password_hash=security.hash_password(DEFAULT_ADMIN_PASSWORD),
                first_name="System",
                last_name="Admin",
                status=UserStatus.ACTIVE,
                email_verified=True,
                email_verified_at=datetime.utcnow()
            )
            db.add(admin_user)
            await db.flush()
            print(f"   ✅ Admin user created: {admin_user.email}")
            
            # 8. Assign Super Admin role to admin user
            print("🔗 Assigning Super Admin role...")
            user_role = UserRole(
                user_id=admin_user.id,
                role_id=role_ids["SUPER_ADMIN"],
                is_primary=True
            )
            db.add(user_role)
            
            await db.commit()
            
            print("\n" + "="*50)
            print("🎉 Database seeding completed successfully!")
            print("="*50)
            print(f"\n📧 Admin Email:    {DEFAULT_ADMIN_EMAIL}")
            print(f"🔑 Admin Password: {DEFAULT_ADMIN_PASSWORD}")
            print("\n")
            
        except Exception as e:
            await db.rollback()
            print(f"❌ Error seeding database: {e}")
            raise


async def main():
    """Initialize database and run seeder."""
    print("🔌 Connecting to database...")
    await init_db()
    await seed_database()


if __name__ == "__main__":
    asyncio.run(main())
