"""Dummy migration placeholder — allows alembic stamp to work

Revision ID: add_tenant_fee_reminder_cols
Revises: d749cb483cbf
"""
from typing import Sequence, Union

revision: str = 'add_tenant_fee_reminder_cols'
down_revision: Union[str, None] = 'd749cb483cbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
