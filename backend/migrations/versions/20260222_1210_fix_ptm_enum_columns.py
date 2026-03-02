"""Convert ptm_sessions.status and fix ptm_remarks missing columns

Revision ID: fix_ptm_enum_columns
Revises: fix_ptm_table_columns
Create Date: 2026-02-22
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'fix_ptm_enum_columns'
down_revision: Union[str, None] = 'fix_ptm_table_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ptm_sessions: convert status column from PG ENUM to VARCHAR
    op.execute("""
        ALTER TABLE ptm_sessions
            ALTER COLUMN status TYPE VARCHAR(20) USING status::TEXT
    """)
    op.execute("ALTER TABLE ptm_sessions ALTER COLUMN status SET DEFAULT 'scheduled'")

    # ptm_remarks: add any columns that may be missing
    op.execute("""
        ALTER TABLE ptm_remarks
            ADD COLUMN IF NOT EXISTS author_type VARCHAR(10) NOT NULL DEFAULT 'teacher',
            ADD COLUMN IF NOT EXISTS content TEXT,
            ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
    """)

    # Drop now-unused PG enum types (CASCADE because status column may still ref them)
    op.execute("DROP TYPE IF EXISTS ptmsessionstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS ptmreviewertype CASCADE")


def downgrade() -> None:
    pass
