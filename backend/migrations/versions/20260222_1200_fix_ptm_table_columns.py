"""Add missing columns to existing PTM tables (is_deleted, notes, etc.)

Revision ID: fix_ptm_table_columns
Revises: add_ptm_tables
Create Date: 2026-02-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'fix_ptm_table_columns'
down_revision: Union[str, None] = 'add_ptm_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── ptm_slots ──────────────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE ptm_slots
            ADD COLUMN IF NOT EXISTS notes TEXT,
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE,
            ADD COLUMN IF NOT EXISTS deleted_by UUID
    """)

    # ── ptm_sessions ───────────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE ptm_sessions
            ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITHOUT TIME ZONE,
            ADD COLUMN IF NOT EXISTS deleted_by UUID
    """)

    # ── ptm_remarks ────────────────────────────────────────────────────────
    # ptm_remarks doesn't use SoftDeleteMixin but ensure updated_at exists
    op.execute("""
        ALTER TABLE ptm_remarks
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE
                NOT NULL DEFAULT now()
    """)


def downgrade() -> None:
    pass
