"""add_restricted_modules

Revision ID: 8899d25e1281
Revises: cf8532ea6247
Create Date: 2025-12-28 11:51:29.508021+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8899d25e1281'
down_revision: Union[str, None] = 'cf8532ea6247'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('restricted_modules', postgresql.ARRAY(sa.String()), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'restricted_modules')
