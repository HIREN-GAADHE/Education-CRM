from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
from app.config.settings import settings

# Create async engine
# pool_pre_ping: reconnects if Neon closed an idle connection
# connect_args statement_cache_size=0: required for asyncpg with Neon's pgbouncer
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=min(settings.DATABASE_POOL_SIZE, 5),   # Neon free tier has low connection limit
    max_overflow=min(settings.DATABASE_MAX_OVERFLOW, 5),
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    connect_args={"statement_cache_size": 0},
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
    Verify database connectivity on startup.
    Schema is managed exclusively by 'alembic upgrade head' (run in start.sh before uvicorn).
    We do NOT call create_all here because it conflicts with Alembic's version tracking.
    """
    import logging
    _logger = logging.getLogger(__name__)

    from sqlalchemy import text
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        _logger.info("Database connectivity verified.")
    except Exception as e:
        _logger.error(f"Database connection failed on startup: {e}")
        raise


async def close_db():
    """
    Close database connections.
    Called on application shutdown.
    """
    await engine.dispose()
