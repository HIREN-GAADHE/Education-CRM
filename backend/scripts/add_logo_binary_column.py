import asyncio
from sqlalchemy import text
from app.config.database import engine

async def update_schema():
    async with engine.begin() as conn:
        print("Adding logo_binary column...")
        await conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_binary BYTEA;"))
        print("Adding logo_content_type column...")
        await conn.execute(text("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_content_type VARCHAR(50);"))
        print("Done.")

if __name__ == "__main__":
    asyncio.run(update_schema())
