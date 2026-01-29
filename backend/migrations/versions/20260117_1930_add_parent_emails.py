"""Add father_email and mother_email

Revision ID: 20260117_1930_add_parent_emails
Revises: 91c67cbe234c
Create Date: 2026-01-17 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260117_1930_add_parent_emails'
down_revision = '91c67cbe234c'
branch_labels = None
depends_on = None


def upgrade():
    # Add father_email column
    op.add_column('students', sa.Column('father_email', sa.String(length=255), nullable=True))
    # Add mother_email column
    op.add_column('students', sa.Column('mother_email', sa.String(length=255), nullable=True))


def downgrade():
    # Remove mother_email column
    op.drop_column('students', 'mother_email')
    # Remove father_email column
    op.drop_column('students', 'father_email')
