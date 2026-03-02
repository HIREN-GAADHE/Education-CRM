import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, create_engine
from sqlalchemy.engine import Connection

from alembic import context

# Import your models and config
from app.config import settings
from app.models.base import Base

# ── Import ALL models so they are registered with Base.metadata ──────────────
# This ensures alembic tracks every table for autogenerate and upgrade head.
from app.models import (
    # Core
    Tenant, User, Role, Permission, RolePermission, UserRole,
    Module, TenantModule, RoleModuleAccess, RefreshToken,
    # Academic
    Student, Staff, FeeStructure, FeePayment, FeeDiscount,
    CalendarEvent, Attendance, Message, Report, Course, SchoolClass,
    # Notifications, Timetable, Examinations
    Notification, NotificationTemplate, NotificationPreference,
    TimeSlot, Room, TimetableEntry, TimetableConflict,
    Examination, ExamResult, GradeScale, GradeLevel, StudentGPA,
    # Payments and parent
    PaymentGatewayConfig, PaymentOrder, PaymentTransaction,
    PaymentRefund, PaymentNotification,
    ParentStudent,
    # Transport
    Vehicle, TransportRoute, RouteStop, StudentTransport, TransportFee,
    # Settings and reminders
    TenantSettings,
    ReminderSettings, ReminderTemplate, ReminderLog,
    # PTM, Health, Daily Diary, Payroll
    PTMSlot, PTMSession, PTMRemark,
    StudentHealthRecord, NurseVisit, Vaccination,
    DailyDiary,
    SalaryStructure, StaffSalaryAssignment, Payslip,
)

# this is the Alembic Config object
config = context.config

# Convert async URL to sync URL for alembic.
# Also strip Neon-specific params that psycopg2 doesn't understand.
_db_url = settings.DATABASE_URL
sync_database_url = (
    _db_url
    .replace("+asyncpg", "")
    .replace("&channel_binding=require", "")
    .replace("?channel_binding=require&", "?")
    .replace("?channel_binding=require", "")
)
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
