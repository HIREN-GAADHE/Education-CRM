from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
from app.config.settings import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    echo=settings.DATABASE_ECHO,
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency that provides a database session.
    Usage: db: AsyncSession = Depends(get_db)
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Initialize database tables.
    Called on application startup.
    """
    async with engine.begin() as conn:
        # Import all models here to ensure they're registered
        from app.models import tenant, user, role, module
        await conn.run_sync(Base.metadata.create_all)

    # Run idempotent migrations for columns that may be missing in production
    # This handles cases where models were updated but ALTER TABLE was never run
    import logging
    _logger = logging.getLogger(__name__)
    
    migration_statements = [
        # fee_payments: SoftDeleteMixin columns
        "ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL",
        "ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
        "ALTER TABLE fee_payments ADD COLUMN IF NOT EXISTS deleted_by UUID",
        # exam_results: is_passed and rank columns
        "ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS is_passed BOOLEAN",
        "ALTER TABLE exam_results ADD COLUMN IF NOT EXISTS rank INTEGER",
    ]
    
    try:
        from sqlalchemy import text
        for stmt in migration_statements:
            try:
                async with engine.begin() as conn:
                    await conn.execute(text(stmt))
                _logger.info(f"Migration OK: {stmt[:60]}...")
            except Exception as e:
                # Non-fatal: table may not exist yet, or column already exists
                _logger.warning(f"Migration skipped: {stmt[:60]}... ({e})")
        _logger.info("Startup migrations completed")
    except Exception as e:
        _logger.warning(f"Startup migrations failed (non-fatal): {e}")


async def close_db():
    """
    Close database connections.
    Called on application shutdown.
    """
    await engine.dispose()
