import asyncio
import logging
from app.config.database import async_session_factory
from app.models import Module, ModuleCategory
from sqlalchemy import select

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Module definitions
MODULES = [
    {"key": "dashboard", "name": "Dashboard", "icon": "Dashboard", "category": ModuleCategory.CORE},
    {"key": "calendar", "name": "Calendar", "icon": "CalendarMonth", "category": ModuleCategory.CORE},
    {"key": "students", "name": "Students", "icon": "School", "category": ModuleCategory.ACADEMIC},
    {"key": "courses", "name": "Courses", "icon": "MenuBook", "category": ModuleCategory.ACADEMIC},
    {"key": "attendance", "name": "Attendance", "icon": "EventNote", "category": ModuleCategory.ACADEMIC},
    {"key": "timetable", "name": "Timetable", "icon": "Schedule", "category": ModuleCategory.ACADEMIC},
    {"key": "examinations", "name": "Examinations", "icon": "Quiz", "category": ModuleCategory.ACADEMIC},
    {"key": "certificates", "name": "Certificates", "icon": "CardMembership", "category": ModuleCategory.ACADEMIC},
    {"key": "staff", "name": "Staff", "icon": "Badge", "category": ModuleCategory.ADMINISTRATIVE},
    {"key": "fees", "name": "Fees & Finance", "icon": "Payments", "category": ModuleCategory.FINANCE},
    {"key": "payments", "name": "Online Payments", "icon": "CreditCard", "category": ModuleCategory.FINANCE},
    {"key": "communication", "name": "Messages", "icon": "Chat", "category": ModuleCategory.COMMUNICATION},
    {"key": "reports", "name": "Reports", "icon": "Assessment", "category": ModuleCategory.ANALYTICS},
    {"key": "library", "name": "Library", "icon": "LocalLibrary", "category": "ACADEMIC"},  # Using closest match if SERVICE not available
    {"key": "transport", "name": "Transport", "icon": "DirectionsBus", "category": "administrative"}, # Service -> Administrative
    {"key": "hostel", "name": "Hostel", "icon": "Hotel", "category": "administrative"},
    {"key": "users", "name": "Users", "icon": "People", "category": ModuleCategory.ADMINISTRATIVE},
    {"key": "roles", "name": "Roles & Access", "icon": "Security", "category": ModuleCategory.ADMINISTRATIVE},
    {"key": "settings", "name": "Settings", "icon": "Settings", "category": ModuleCategory.ADMINISTRATIVE},
    {"key": "marketplace", "name": "Marketplace", "icon": "Storefront", "category": ModuleCategory.INTEGRATION},
]

async def seed_modules():
    async with async_session_factory() as db:
        logger.info("Checking modules...")
        
        for mod_data in MODULES:
            # Check if exists
            result = await db.execute(select(Module).where(Module.code == mod_data["key"]))
            existing = result.scalar_one_or_none()
            
            if not existing:
                logger.info(f"Creating module: {mod_data['name']}")
                
                # Handle category enum mapping
                category = mod_data["category"]
                if isinstance(category, str):
                    # Try to map string to enum if possible, or default to CORE
                    try:
                        category = ModuleCategory(category)
                    except ValueError:
                        category = ModuleCategory.ADMINISTRATIVE 
                
                new_module = Module(
                    code=mod_data["key"],
                    name=mod_data["name"],
                    icon=mod_data["icon"],
                    category=category,
                    description=f"{mod_data['name']} module",
                    is_active=True,
                    is_core=mod_data["key"] in ["dashboard", "calendar"]
                )
                db.add(new_module)
            else:
                logger.info(f"Module exists: {mod_data['name']}")
                
        await db.commit()
        logger.info("Module seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_modules())
