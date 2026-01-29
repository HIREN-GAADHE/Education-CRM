"""Add courses table

Revision ID: cf8532ea6247
Revises: 
Create Date: 2025-12-28 08:00:54.069622+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cf8532ea6247'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the coursestatus enum type
    coursestatus = postgresql.ENUM('active', 'inactive', 'upcoming', 'completed', 'archived', name='coursestatus', create_type=False)
    coursestatus.create(op.get_bind(), checkfirst=True)
    
    # Create courses table
    op.create_table('courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('department', sa.String(length=100), nullable=True),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('duration_months', sa.Integer(), nullable=True),
        sa.Column('credits', sa.Integer(), nullable=True),
        sa.Column('max_students', sa.Integer(), nullable=True),
        sa.Column('enrolled_count', sa.Integer(), nullable=True),
        sa.Column('fee_amount', sa.Float(), nullable=True),
        sa.Column('status', sa.Enum('active', 'inactive', 'upcoming', 'completed', 'archived', name='coursestatus'), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('instructor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('instructor_name', sa.String(length=255), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_mandatory', sa.Boolean(), nullable=True),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(['instructor_id'], ['staff.id'], ),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_courses_code'), 'courses', ['code'], unique=False)
    op.create_index(op.f('ix_courses_tenant_id'), 'courses', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_courses_tenant_id'), table_name='courses')
    op.drop_index(op.f('ix_courses_code'), table_name='courses')
    op.drop_table('courses')
    
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS coursestatus')
