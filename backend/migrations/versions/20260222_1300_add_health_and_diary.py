"""Create student_health_records, nurse_visits, vaccinations, and daily_diary tables

Revision ID: add_health_and_diary_tables
Revises: fix_ptm_enum_columns
Create Date: 2026-02-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_health_and_diary_tables'
down_revision: Union[str, None] = 'fix_ptm_enum_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── student_health_records ─────────────────────────────────────────────
    op.create_table(
        'student_health_records',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('blood_group', sa.String(10), nullable=True),
        sa.Column('height_cm', sa.Float, nullable=True),
        sa.Column('weight_kg', sa.Float, nullable=True),
        sa.Column('vision_left', sa.String(20), nullable=True),
        sa.Column('vision_right', sa.String(20), nullable=True),
        sa.Column('allergies', sa.Text, nullable=True),
        sa.Column('chronic_conditions', sa.Text, nullable=True),
        sa.Column('current_medications', sa.Text, nullable=True),
        sa.Column('dietary_restrictions', sa.Text, nullable=True),
        sa.Column('special_needs', sa.Text, nullable=True),
        sa.Column('emergency_contact_name', sa.String(200), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(20), nullable=True),
        sa.Column('emergency_contact_relation', sa.String(50), nullable=True),
        sa.Column('family_doctor_name', sa.String(200), nullable=True),
        sa.Column('family_doctor_phone', sa.String(20), nullable=True),
        sa.Column('health_insurance_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_student_health_records_student_id', 'student_health_records', ['student_id'])
    op.create_index('ix_student_health_records_tenant_id', 'student_health_records', ['tenant_id'])

    # ── nurse_visits ───────────────────────────────────────────────────────
    op.create_table(
        'nurse_visits',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('health_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('student_health_records.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('visit_date', sa.DateTime, nullable=False),
        sa.Column('symptoms', sa.Text, nullable=True),
        sa.Column('diagnosis', sa.Text, nullable=True),
        sa.Column('treatment_given', sa.Text, nullable=True),
        sa.Column('medication_given', sa.Text, nullable=True),
        sa.Column('sent_home', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('parent_notified', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('follow_up_required', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('follow_up_date', sa.Date, nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_nurse_visits_student_id', 'nurse_visits', ['student_id'])
    op.create_index('ix_nurse_visits_health_record_id', 'nurse_visits', ['health_record_id'])

    # ── vaccinations ───────────────────────────────────────────────────────
    op.create_table(
        'vaccinations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('health_record_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('student_health_records.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('vaccine_name', sa.String(200), nullable=False),
        sa.Column('dose_number', sa.Integer, server_default=sa.text('1')),
        sa.Column('administered_date', sa.Date, nullable=True),
        sa.Column('administered_by', sa.String(200), nullable=True),
        sa.Column('next_due_date', sa.Date, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default=sa.text("'completed'")),
        sa.Column('batch_number', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text, nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_vaccinations_student_id', 'vaccinations', ['student_id'])
    op.create_index('ix_vaccinations_health_record_id', 'vaccinations', ['health_record_id'])

    # ── daily_diary ────────────────────────────────────────────────────────
    op.create_table(
        'daily_diary',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=True),
        sa.Column('student_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('students.id', ondelete='CASCADE'), nullable=False),
        sa.Column('teacher_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('staff.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recorded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('entry_date', sa.Date, nullable=False),
        sa.Column('mood', sa.String(20), nullable=True),
        sa.Column('behavior_score', sa.Integer, nullable=True),
        sa.Column('attendance_status', sa.String(20), nullable=True),
        sa.Column('academic_notes', sa.Text, nullable=True),
        sa.Column('behavior_notes', sa.Text, nullable=True),
        sa.Column('homework_status', sa.String(50), nullable=True),
        sa.Column('homework_notes', sa.Text, nullable=True),
        sa.Column('is_shared_with_parent', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('parent_acknowledged', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('parent_acknowledged_at', sa.DateTime, nullable=True),
        sa.Column('is_deleted', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_daily_diary_student_id', 'daily_diary', ['student_id'])
    op.create_index('ix_daily_diary_entry_date', 'daily_diary', ['entry_date'])
    op.create_index('ix_daily_diary_tenant_id', 'daily_diary', ['tenant_id'])


def downgrade() -> None:
    op.drop_table('daily_diary')
    op.drop_table('vaccinations')
    op.drop_table('nurse_visits')
    op.drop_table('student_health_records')
