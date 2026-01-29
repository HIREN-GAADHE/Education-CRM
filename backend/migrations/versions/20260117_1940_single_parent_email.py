"""Replace father_email and mother_email with parent_email

Revision ID: 20260117_1940_single_parent_email
Revises: 20260117_1930_add_parent_emails
Create Date: 2026-01-17 19:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260117_1940_single_parent_email'
down_revision = '20260117_1930_add_parent_emails'
branch_labels = None
depends_on = None


def upgrade():
    # Add new parent_email column
    op.add_column('students', sa.Column('parent_email', sa.String(length=255), nullable=True))
    
    # Drop old columns
    op.drop_column('students', 'mother_email')
    op.drop_column('students', 'father_email')


def downgrade():
    # Add back old columns
    op.add_column('students', sa.Column('father_email', sa.String(length=255), nullable=True))
    op.add_column('students', sa.Column('mother_email', sa.String(length=255), nullable=True))
    
    # Drop parent_email column
    op.drop_column('students', 'parent_email')
