import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection

from alembic import context

# Import your models and config
from app.config import settings
from app.models.base import Base

# Import all models so they are registered with Base.metadata
from app.models import (
    Tenant, User, Role, Permission, RolePermission, UserRole,
    Module, TenantModule, RoleModuleAccess, RefreshToken,
    Student, Staff, FeeStructure, FeePayment, FeeDiscount,
    CalendarEvent, Attendance, Message, Report, Course, SchoolClass
)

# this is the Alembic Config object
config = context.config

# Convert async URL to sync URL for alembic
# postgresql+asyncpg://... -> postgresql://...
sync_database_url = settings.DATABASE_URL.replace("+asyncpg", "")
config.set_main_option("sqlalchemy.url", sync_database_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode using sync engine."""
    # Use sync engine for migrations (psycopg2)
    connectable = create_engine(
        sync_database_url,
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
