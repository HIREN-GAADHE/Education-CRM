from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
import ssl
from app.config.settings import settings

# ── Build the database URL and SSL connect_args ───────────────────────────────
# asyncpg does NOT accept sslmode/channel_binding as URL query params.
# Strip those params and pass ssl=True via connect_args instead.
_raw_url = settings.DATABASE_URL

# Strip Neon-specific/psycopg2-only params that asyncpg rejects
_db_url = (
    _raw_url
    .replace("&channel_binding=require", "")
    .replace("?channel_binding=require&", "?")
    .replace("?channel_binding=require", "")
    .replace("&sslmode=require", "")
    .replace("?sslmode=require&", "?")
    .replace("?sslmode=require", "")
    .replace("&sslmode=prefer", "")
    .replace("?sslmode=prefer", "")
)

# Determine if SSL is needed (Neon always requires it)
_needs_ssl = "sslmode=require" in _raw_url or "neon.tech" in _raw_url

_connect_args: dict = {
    "statement_cache_size": 0,  # Required for Neon pgbouncer pooler
}
if _needs_ssl:
    # asyncpg requires ssl context, not sslmode string
    _ssl_ctx = ssl.create_default_context()
    _connect_args["ssl"] = _ssl_ctx

# Create async engine
# pool_pre_ping: reconnects if Neon closed an idle connection
engine = create_async_engine(
    _db_url,
    pool_size=min(settings.DATABASE_POOL_SIZE, 5),   # Neon free tier: low connection limit
    max_overflow=min(settings.DATABASE_MAX_OVERFLOW, 5),
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
    connect_args=_connect_args,
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
