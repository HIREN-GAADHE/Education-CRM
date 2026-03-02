"""Add ptm_slots, ptm_sessions, ptm_remarks tables

Revision ID: add_ptm_tables
Revises: d749cb483cbf
Create Date: 2026-02-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_ptm_tables'
down_revision: Union[str, None] = 'add_tenant_fee_reminder_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ptm_slots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('is_booked', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_ptm_slots_tenant_id', 'ptm_slots', ['tenant_id'])
    op.create_index('ix_ptm_slots_teacher_id', 'ptm_slots', ['teacher_id'])
    op.create_index('ix_ptm_slots_date', 'ptm_slots', ['date'])

    op.create_table(
        'ptm_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('slot_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ptm_slots.id', ondelete='SET NULL'), nullable=True),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(), nullable=True),
        sa.Column('duration_minutes', sa.Integer(), server_default=sa.text('15')),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'scheduled'")),
        sa.Column('meeting_link', sa.String(500), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_ptm_sessions_tenant_id', 'ptm_sessions', ['tenant_id'])
    op.create_index('ix_ptm_sessions_teacher_id', 'ptm_sessions', ['teacher_id'])
    op.create_index('ix_ptm_sessions_student_id', 'ptm_sessions', ['student_id'])
    op.create_index('ix_ptm_sessions_parent_user_id', 'ptm_sessions', ['parent_user_id'])

    op.create_table(
        'ptm_remarks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('session_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ptm_sessions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_type', sa.String(10), nullable=False, server_default=sa.text("'teacher'")),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_ptm_remarks_tenant_id', 'ptm_remarks', ['tenant_id'])
    op.create_index('ix_ptm_remarks_session_id', 'ptm_remarks', ['session_id'])


def downgrade() -> None:
    op.drop_table('ptm_remarks')
    op.drop_table('ptm_sessions')
    op.drop_table('ptm_slots')
