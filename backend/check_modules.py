import asyncio
from sqlalchemy import select
from app.config.database import async_session_factory, get_db
from app.models import Module

# Available modules used in our logic
EXPECTED_MODULE_KEYS = [
    "dashboard", "calendar", "students", "courses", "attendance", "timetable",
    "examinations", "certificates", "staff", "fees", "payments", "communication",
    "reports", "library", "transport", "hostel", "users", "roles", "settings",
    "marketplace"
]

async def check_modules():
    async with async_session_factory() as db:
        result = await db.execute(select(Module))
        modules = result.scalars().all()
        
        print(f"Total modules in DB: {len(modules)}")
        
        existing_codes = {m.code for m in modules}
        missing = [key for key in EXPECTED_MODULE_KEYS if key not in existing_codes]
        
        if missing:
            print(f"MISSING MODULES: {missing}")
        else:
            print("ALL MODULES PRESENT!")

if __name__ == "__main__":
    asyncio.run(check_modules())
