"""fix_pincode_length

Revision ID: 370bb61270ac
Revises: 20260117_1940_single_parent_email
Create Date: 2026-01-18 05:54:04.645747+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '370bb61270ac'
down_revision: Union[str, None] = '20260117_1940_single_parent_email'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Alter pincode column to VARCHAR(20)
    op.alter_column('students', 'pincode',
                   existing_type=sa.VARCHAR(length=10),
                   type_=sa.String(length=20),
                   existing_nullable=True)
    
    # Alter blood_group column to VARCHAR(20)
    op.alter_column('students', 'blood_group',
                   existing_type=sa.VARCHAR(length=10),
                   type_=sa.String(length=20),
                   existing_nullable=True)


def downgrade() -> None:
    # Revert pincode column back to VARCHAR(10)
    op.alter_column('students', 'pincode',
                   existing_type=sa.VARCHAR(length=20),
                   type_=sa.String(length=10),
                   existing_nullable=True)
    
    # Revert blood_group column back to VARCHAR(10)
    op.alter_column('students', 'blood_group',
                   existing_type=sa.VARCHAR(length=20),
                   type_=sa.String(length=10),
                   existing_nullable=True)


