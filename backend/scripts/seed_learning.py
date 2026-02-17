"""
Script to seed dummy learning modules and content for ALL tenants.
Run this with: python scripts/seed_learning.py
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.config.settings import settings
from app.models.learning import LearningModule, LearningContent, ContentType
from app.models.tenant import Tenant

# Database connection
DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
engine = create_async_engine(DATABASE_URL, echo=True)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Seeding Learning Hub Data for ALL Tenants...")
        
        # 1. Get ALL tenants
        result = await db.execute(select(Tenant))
        tenants = result.scalars().all()
        
        if not tenants:
            print("No tenants found.")
            return

        print(f"Found {len(tenants)} tenants. Starting seed...")

        # 2. Define Learning Content Data (Same for all tenants)
        modules_data = [
            {
                "title": "Python for Data Science",
                "description": "Learn Python from scratch and master data analysis libraries like Pandas and NumPy.",
                "category": "Technical",
                "thumbnail": "https://img.youtube.com/vi/RFmgk7KM8BA/maxresdefault.jpg",
                "contents": [
                    {
                        "title": "Python for Beginners - Full Course",
                        "type": "video",
                        "url": "https://www.youtube.com/watch?v=RFmgk7KM8BA",
                        "order": 1
                    },
                    {
                        "title": "Pandas Tutorial",
                        "type": "video",
                        "url": "https://www.youtube.com/watch?v=vmEHCJofslg",
                        "order": 2
                    },
                    {
                        "title": "Course Slides",
                        "type": "link",
                        "url": "https://google.com",
                        "order": 3
                    }
                ]
            },
            {
                "title": "Effective Communication Skills",
                "description": "Master the art of communication in the workplace. Improve your speaking and listening skills.",
                "category": "Soft Skills",
                "thumbnail": "https://img.youtube.com/vi/HAnw168huqA/maxresdefault.jpg",
                "contents": [
                    {
                        "title": "Build Confidence and Effective Communication",
                        "type": "video",
                        "url": "https://www.youtube.com/watch?v=HAnw168huqA",
                        "order": 1
                    },
                    {
                        "title": "Communication Skills - Deep Dive",
                        "type": "video",
                        "url": "https://www.youtube.com/watch?v=srn5jgp57ts",
                        "order": 2
                    }
                ]
            }
        ]
        
        # 3. Loop through tenants and seed
        for tenant in tenants:
            print(f"Processing Tenant: {tenant.name} ({tenant.id})")
            
            for m_data in modules_data:
                # Check if module already exists to avoid duplicates
                existing_module = await db.execute(
                    select(LearningModule).where(
                        LearningModule.tenant_id == tenant.id,
                        LearningModule.title == m_data["title"]
                    )
                )
                if existing_module.scalar_one_or_none():
                    print(f"  - Module '{m_data['title']}' already exists. Skipping.")
                    continue

                # Create Module
                module = LearningModule(
                    tenant_id=tenant.id,
                    title=m_data["title"],
                    description=m_data["description"],
                    category=m_data["category"],
                    thumbnail=m_data["thumbnail"],
                    is_published=True
                )
                db.add(module)
                await db.commit()
                await db.refresh(module)
                print(f"  + Created Module: {module.title}")
                
                # Create Content
                for c_data in m_data["contents"]:
                    content = LearningContent(
                        tenant_id=tenant.id,
                        module_id=module.id,
                        title=c_data["title"],
                        content_type=ContentType(c_data["type"]),
                        content_url=c_data["url"],
                        order=c_data["order"]
                    )
                    db.add(content)
                await db.commit()
                
        print("\nSeeding completed successfully for all tenants!")

if __name__ == "__main__":
    asyncio.run(seed_data())
